// Apex — per-seat todo/checklist (J90, the operator's right-rail tracker). App-level
// like artifacts.js: the ENGINE is untouched — this module watches the seat
// event stream from outside and speaks to seats through host.handle().
//
// Truth lives in ONE JSON file per chat under app/state/todo/ (gitignored
// local state). Both writers converge on it:
//   - the SEAT edits the file directly with its normal file tools (the path
//     rides an <apex-todo-brief> tag prepended to the first user turn — the
//     same invisible lane the engine's env brief uses; '<'-prefixed messages
//     stay out of transcript backfills);
//   - KEITH edits through the panel (todoAdd/todoUpdate/todoRemove bus verbs),
//     which writes the file here and NOTIFIES the seat with an
//     <apex-todo-update> user turn — deferred while the seat is mid-turn,
//     coalesced, and never sent before the seat's first real message (a
//     pre-first-turn send would wake the CLI and get auto-titled; the brief
//     already tells the seat to read the file).
// A directory watcher catches the seat's direct writes and refreshes the
// panel; self-writes are recognized by content and not re-broadcast.
//
// File identity must survive relaunch (new seat id, same session) and app
// restart (resume): files are named by a minted token, and index.json maps
// sessionId -> token once init reveals the session.
'use strict';

const fs = require('fs');
const path = require('path');

const TYPES = new Set(['task', 'item']);
const STATUSES = new Set(['todo', 'in-progress', 'done', 'blocked']);

let deps = null;            // {host, bus, stateDir, log}
const seats = new Map();    // seatId -> {file, sessionId, busy, briefed, dead,
                            //            pendingNotify, lastWrite}
let entrySeq = 1;

const indexFile = () => path.join(deps.stateDir, 'index.json');
function readIndex() {
  try { return JSON.parse(fs.readFileSync(indexFile(), 'utf8')) || {}; }
  catch { return {}; }
}
function writeIndex(ix) {
  try { fs.writeFileSync(indexFile(), JSON.stringify(ix, null, 2)); }
  catch (e) { deps.log('todo index write failed: ' + e.message); }
}

const mintToken = () =>
  't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

function fileFor(sessionId) {
  const ix = readIndex();
  let token = sessionId && ix[sessionId];
  if (!token) {
    token = mintToken();
    if (sessionId) { ix[sessionId] = token; writeIndex(ix); }
  }
  return { token, file: path.join(deps.stateDir, token + '.json') };
}

function sanitizeEntry(raw, existing) {
  const e = existing || {};
  const str = (v, max) => typeof v === 'string' ? v.trim().slice(0, max) : undefined;
  const out = {
    id: e.id || 'e' + Date.now().toString(36) + (entrySeq++),
    type: TYPES.has(raw.type) ? raw.type : (e.type || 'item'),
    title: str(raw.title, 120) !== undefined ? str(raw.title, 120) : (e.title || ''),
    ts: e.ts || Date.now(),
  };
  if (out.type === 'task') {
    out.delegate = str(raw.delegate, 40) !== undefined ? str(raw.delegate, 40) : (e.delegate || 'self');
    out.status = STATUSES.has(raw.status) ? raw.status : (e.status || 'todo');
  }
  const notes = str(raw.notes, 1000);
  if (notes !== undefined ? notes : e.notes) out.notes = notes !== undefined ? notes : e.notes;
  return out.title ? out : null;
}

// Read is lenient (the seat writes this file by hand): a parse failure is
// reported to the panel, never thrown; unknown fields survive round-trips only
// through sanitize, which is fine — the schema IS the contract.
function loadList(file) {
  let text = null;
  try { text = fs.readFileSync(file, 'utf8'); }
  catch { return { entries: [] }; }              // no file yet = empty list
  try {
    const parsed = JSON.parse(text);
    const list = Array.isArray(parsed) ? parsed : (parsed && parsed.entries);
    if (!Array.isArray(list)) return { entries: [], error: 'no "entries" array' };
    return { entries: list.map((r) => sanitizeEntry(r || {}, r || {})).filter(Boolean) };
  } catch {
    return { entries: [], error: 'file is not valid JSON (mid-edit?)' };
  }
}

function saveList(entry, entries) {
  const text = JSON.stringify({ entries }, null, 2);
  entry.lastWrite = text;
  fs.writeFileSync(entry.file, text);
}

function broadcast(seatId) {
  const s = seats.get(seatId);
  if (!s) return;
  const { entries, error } = loadList(s.file);
  deps.bus.post('todoList', { id: seatId, entries, error: error || '', file: s.file });
}

// ---- seat lifecycle (fed by seats.js's emit hook) ----
function track(seatId, sessionId) {
  const { file } = fileFor(sessionId);
  // A seat created WITH a session id is resumed/restored — mid-conversation,
  // already carrying an earlier turn's brief (and the notification text names
  // the file anyway). Holding notifications for a "first send" there silently
  // ate the user's panel edits after every app restart (the 2026-07-15 miss).
  seats.set(seatId, { file, sessionId: sessionId || null, busy: false,
                      briefed: !!sessionId, dead: false, pendingNotify: false,
                      lastWrite: null });
}

function onSeatEvent(m) {
  if (!deps) return;
  if (m.type === 'seatNew') {
    if (m.pty || m.local) return;
    track(m.id, m.sessionId);
    broadcast(m.id);        // restored/resumed lists paint without waiting
    return;
  }
  if (m.type !== 'seatEvt') return;
  const s = seats.get(m.id);
  if (!s) return;
  switch (m.m.type) {
    case 'init': {
      if (m.m.local) { seats.delete(m.id); return; }   // local lane, no list
      if (!s.sessionId && m.m.sessionId) {
        s.sessionId = m.m.sessionId;
        const ix = readIndex();
        // the file existed before the session id did — bind them now
        ix[s.sessionId] = path.basename(s.file, '.json');
        writeIndex(ix);
      }
      break;
    }
    case 'block': case 'delta': case 'tool': case 'thinkingTick':
      s.busy = true; break;
    case 'result':
      s.busy = false;
      if (s.pendingNotify) { s.pendingNotify = false; notifySeat(m.id); }
      break;
    case 'dead':
      s.dead = true; s.pendingNotify = false; break;
  }
}

function seatClosed(seatId) { seats.delete(seatId); }   // file stays — history

// ---- the invisible first-turn brief (path + schema + duties) ----
function briefText(file) {
  return '<apex-todo-brief>\n' +
    'Seat todo list — the user watches it live in a panel beside this chat: ' + file + '\n' +
    'Shape: {"entries":[{"id":"e1","type":"task","title":"fix printer",' +
    '"delegate":"self","status":"todo","notes":""}]}\n' +
    '- type "task": needs delegate (self | User | qwen | <model>) + status ' +
    '(todo | in-progress | done | blocked). type "item": a plain list line, title only.\n' +
    '- Register tasks when work starts; keep status current by editing the file ' +
    'directly as you go; titles stay 1-4 words.\n' +
    '- The [delegate] field is the delegation decision. In chat, one summary line at ' +
    'work start: "Delegation: none" or "Delegation: 2 tasks -> qwen".\n' +
    '- An <apex-todo-update> message means the user changed the list: re-read the file ' +
    'and adjust before continuing.\n' +
    '</apex-todo-brief>\n\n';
}

/** seats.js routes every renderer seatSend through here. */
function briefOnFirstSend(msg) {
  const s = seats.get(msg.id);
  if (!s || s.dead || s.briefed) return msg;
  s.briefed = true;
  return Object.assign({}, msg, { text: briefText(s.file) + (msg.text || '') });
}

// ---- the user's panel edits -> file write + seat notification ----
function notifySeat(seatId) {
  const s = seats.get(seatId);
  if (!s || s.dead || !s.briefed) return;   // pre-first-turn: the brief covers it
  if (s.busy) { s.pendingNotify = true; return; }
  s.busy = true;                            // the send starts a turn
  deps.host.handle({ type: 'seatSend', id: seatId,
    text: '<apex-todo-update>The user updated the seat todo list. Re-read ' + s.file +
          ' and adjust your plan and statuses before continuing.</apex-todo-update>' });
}

function handlePanel(msg, verb) {
  const s = seats.get(msg.id);
  if (!s) return;
  const { entries } = loadList(s.file);
  if (verb === 'add') {
    const e = sanitizeEntry(msg.entry || {});
    if (!e) return;
    entries.push(e);
  } else if (verb === 'update') {
    const i = entries.findIndex((e) => e.id === msg.entryId);
    if (i < 0) return;
    const e = sanitizeEntry(Object.assign({}, entries[i], msg.patch || {}), entries[i]);
    if (!e) return;
    entries[i] = e;
  } else if (verb === 'remove') {
    const i = entries.findIndex((e) => e.id === msg.entryId);
    if (i < 0) return;
    entries.splice(i, 1);
  }
  try { saveList(s, entries); }
  catch (e) { deps.log('todo write failed: ' + e.message); return; }
  broadcast(msg.id);
  notifySeat(msg.id);
}

// ---- watcher: the seat's own file edits refresh the panel ----
const pendingFiles = new Map();   // filename -> debounce timer
function onDirChange(_evt, filename) {
  if (!filename || !filename.endsWith('.json') || filename === 'index.json') return;
  clearTimeout(pendingFiles.get(filename));
  pendingFiles.set(filename, setTimeout(() => {
    pendingFiles.delete(filename);
    // every seat bound to this file, not just the first — a relaunch can leave
    // an old id and the LIVE one behind it; stopping early starved the live pane
    for (const [seatId, s] of seats) {
      if (path.basename(s.file) !== filename) continue;
      let text = null;
      try { text = fs.readFileSync(s.file, 'utf8'); } catch { /* deleted/mid-write */ }
      if (text !== null && text === s.lastWrite) continue;   // our own write echoing
      broadcast(seatId);
    }
  }, 200));
}

function register(d) {
  deps = Object.assign({ log: () => {} }, d);
  fs.mkdirSync(deps.stateDir, { recursive: true });
  try { fs.watch(deps.stateDir, { persistent: false }, onDirChange); }
  catch (e) { deps.log('todo watch failed (panel loses live seat-edit refresh): ' + e.message); }
  deps.bus.on('todoGet', (msg) => broadcast(msg.id));
  deps.bus.on('todoAdd', (msg) => handlePanel(msg, 'add'));
  deps.bus.on('todoUpdate', (msg) => handlePanel(msg, 'update'));
  deps.bus.on('todoRemove', (msg) => handlePanel(msg, 'remove'));
}

module.exports = { register, onSeatEvent, seatClosed, briefOnFirstSend,
                   _drill: { loadList, sanitizeEntry, onDirChange, seats } };
