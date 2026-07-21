// Apex Shell — Seams: live multi-party channels between seats. A seam is a
// titled conversation lane joining two or more participants — existing
// sessions or fresh persona seats — plus the operator. Same bones as todo.js:
// truth lives in ONE JSON file per seam under state/seams/ (gitignored local
// state); both writers converge:
//   - a PARTICIPANT SEAT appends to the file's messages[] with its normal
//     file tools (its join brief carries the path + shape + its own label);
//   - the OPERATOR drives through the bus verbs (seamCreate/seamSend/...),
//     which a UI wires to; this minimal port ships the mechanism, not a panel.
// A directory watcher catches seat writes; the module fans every new message
// out to every OTHER participant as an <apex-seam-msg> user turn (deferred
// while a seat is mid-turn, coalesced — the todo notify discipline).
//
// Participants are durable by SESSION id (survives relaunch + app restart);
// the live seat id is re-bound from seat events. Names: the panel is global
// (not per-seat) — every open chat shows the same seams.
'use strict';

const fs = require('fs');
const path = require('path');

const STATUSES = new Set(['active', 'closed']);
const MAX_MSG = 8000;
const MAX_TITLE = 80;
const MAX_LABEL = 40;

let deps = null;        // {host, bus, stateDir, log, createSeat}
const seatState = new Map();   // seatId -> {busy, dead, sessionId}
const lastWrite = new Map();   // file -> text (self-write echo suppression)
const pendingFiles = new Map();// filename -> debounce timer
let delivering = false;        // re-entrancy guard (deliver -> write -> watcher)

// ---------- file truth ----------
const mintId = () =>
  'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const fileFor = (seamId) => path.join(deps.stateDir, seamId + '.json');

function listFiles() {
  try {
    return fs.readdirSync(deps.stateDir)
      .filter((f) => f.endsWith('.json') && f !== 'index.json' && !f.startsWith('_'));
  } catch { return []; }
}

const str = (v, max) => typeof v === 'string' ? v.trim().slice(0, max) : '';

function sanitizeSeam(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const s = {
    id: str(raw.id, 40) || mintId(),
    title: str(raw.title, MAX_TITLE) || '(untitled seam)',
    status: STATUSES.has(raw.status) ? raw.status : 'active',
    created: typeof raw.created === 'number' ? raw.created : Date.now(),
    participants: [], messages: [],
  };
  const seen = new Set();
  for (const p of Array.isArray(raw.participants) ? raw.participants : []) {
    if (!p || typeof p !== 'object') continue;
    const label = str(p.label, MAX_LABEL);
    if (!label || seen.has(label.toLowerCase())) continue;
    seen.add(label.toLowerCase());
    const part = {
      label,
      persona: str(p.persona, MAX_LABEL),
      sessionId: str(p.sessionId, 80),
      seen: Number.isInteger(p.seen) && p.seen >= 0 ? p.seen : 0,
    };
    // module bookkeeping fields must survive the load/save round trip
    if (typeof p.pendingSeatId === 'string' && p.pendingSeatId)
      part.pendingSeatId = p.pendingSeatId;
    if (Array.isArray(p.briefedSeatIds))
      part.briefedSeatIds = p.briefedSeatIds.filter((x) => typeof x === 'string').slice(-4);
    s.participants.push(part);
  }
  for (const m of Array.isArray(raw.messages) ? raw.messages : []) {
    if (!m || typeof m !== 'object') continue;
    const text = str(m.text, MAX_MSG);
    if (!text) continue;
    s.messages.push({
      ts: typeof m.ts === 'number' ? m.ts : Date.now(),
      from: str(m.from, MAX_LABEL) || '(unknown)',
      text,
    });
  }
  return s;
}

function loadSeam(seamId) {
  try {
    return sanitizeSeam(JSON.parse(fs.readFileSync(fileFor(seamId), 'utf8')));
  } catch { return null; }
}

function loadAll() {
  const out = [];
  for (const f of listFiles()) {
    const s = loadSeam(path.basename(f, '.json'));
    if (s) out.push(s);
  }
  out.sort((a, b) => b.created - a.created);
  return out;
}

function saveSeam(seam) {
  const file = fileFor(seam.id);
  const text = JSON.stringify(seam, null, 2);
  lastWrite.set(file, text);
  fs.writeFileSync(file, text);
}

function broadcast() {
  deps.bus.post('seamList', { seams: loadAll().map((s) => ({
    id: s.id, title: s.title, status: s.status, created: s.created,
    participants: s.participants.map((p) => ({
      label: p.label, persona: p.persona, sessionId: p.sessionId,
      open: !!liveSeatFor(p),
    })),
    messages: s.messages,
  })) });
}

// ---------- seat resolution ----------
function liveSeatFor(participant) {
  if (!participant.sessionId) return null;
  for (const [seatId, st] of seatState) {
    if (!st.dead && st.sessionId === participant.sessionId) return seatId;
  }
  return null;
}

// ---------- delivery ----------
function seamBrief(seam, participant) {
  const others = seam.participants.filter((p) => p !== participant)
    .map((p) => p.label).join(', ');
  return '<apex-seam-brief>\n' +
    'You have been joined to a SEAM — a live channel between seats — titled "' +
    seam.title + '". Participants besides you: ' + (others || '(none yet)') +
    '; the operator can write into it too. Your label in this seam is "' +
    participant.label + '".\n' +
    'Channel file: ' + fileFor(seam.id) + '\n' +
    'To SEND into the seam: edit that file and append ONE object to its ' +
    '"messages" array: {"from":"' + participant.label + '","text":"..."} — ' +
    'the app fans it out to every other participant. Do not edit other ' +
    'fields, do not remove messages, never impersonate another label.\n' +
    'Incoming turns arrive as <apex-seam-msg> messages naming the seam and ' +
    'sender. Treat them as teammate input on the shared task: reply into the ' +
    'seam when you have something for the OTHER participants. Separately, in ' +
    'your OWN chat, keep a running over-the-shoulder summary for your operator ' +
    '— what you are thinking, contributing, and where you agree or push back ' +
    'in the seam — so they can watch and steer from your session without ' +
    'joining the seam themselves. That narration is for your operator; your ' +
    'seam messages are for the other participants — keep them distinct. Keep ' +
    'seam messages substantive and terse — no acknowledgment-only chatter; ' +
    'end the back-and-forth when the work is done.\n' +
    '</apex-seam-brief>';
}

function deliverTo(seam, participant) {
  const seatId = liveSeatFor(participant);
  if (!seatId) return false;                      // session not open — piles up
  const st = seatState.get(seatId);
  if (!st || st.dead) return false;
  const fresh = seam.messages.slice(participant.seen)
    .filter((m) => m.from.toLowerCase() !== participant.label.toLowerCase());
  if (!fresh.length) { participant.seen = seam.messages.length; return true; }
  if (st.busy) { st.pending = true; return false; }
  const body = fresh.map((m) =>
    '<apex-seam-msg seam="' + seam.title + '" from="' + m.from + '">\n' +
    m.text + '\n</apex-seam-msg>').join('\n');
  const alreadyBriefed = Array.isArray(participant.briefedSeatIds) &&
    participant.briefedSeatIds.includes(seatId);
  const brief = alreadyBriefed ? '' : seamBrief(seam, participant) + '\n\n';
  st.busy = true;                                 // the send starts a turn
  deps.host.handle({ type: 'seatSend', id: seatId, text: brief + body });
  participant.briefedSeatIds = (participant.briefedSeatIds || []).concat(
    alreadyBriefed ? [] : [seatId]).slice(-4);
  participant.seen = seam.messages.length;
  return true;
}

function deliverAll() {
  if (delivering) return;
  delivering = true;
  try {
    let changed = false;
    for (const seam of loadAll()) {
      if (seam.status !== 'active') continue;
      const before = JSON.stringify(seam.participants.map((p) => [p.seen, p.briefedSeatIds]));
      for (const p of seam.participants) deliverTo(seam, p);
      if (JSON.stringify(seam.participants.map((p) => [p.seen, p.briefedSeatIds])) !== before) {
        saveSeam(seam); changed = true;
      }
    }
    if (changed) broadcast();
  } finally { delivering = false; }
}

// ---------- participants ----------
function addParticipant(seam, recipient) {
  // recipient: {persona} = open a FRESH persona seat; {seatId} = join existing
  if (recipient && recipient.seatId) {
    const entry = deps.host.list().find((s) => s.id === recipient.seatId);
    if (!entry || entry.pty || entry.local) return null;
    const label = uniqueLabel(seam, entry.persona || entry.title || 'Seat');
    const p = { label, persona: entry.persona || '', sessionId: entry.sessionId || '', seen: 0 };
    if (!p.sessionId) {
      // session id not minted yet — bind by seat id until init reveals it
      p.pendingSeatId = recipient.seatId;
    }
    seam.participants.push(p);
    return p;
  }
  if (recipient && recipient.persona) {
    const seatId = deps.createSeat(recipient.persona, recipient.persona + ' — ' + seam.title);
    if (!seatId) return null;
    const p = { label: uniqueLabel(seam, recipient.persona),
                persona: recipient.persona, sessionId: '', seen: 0,
                pendingSeatId: seatId };
    seam.participants.push(p);
    return p;
  }
  return null;
}

function uniqueLabel(seam, base) {
  const taken = new Set(seam.participants.map((p) => p.label.toLowerCase()));
  let label = base || 'Seat', n = 2;
  while (taken.has(label.toLowerCase())) label = base + ' ' + (n++);
  return label;
}

// bind pending participants once their seat's session id exists
function resolvePending() {
  let changed = false;
  for (const seam of loadAll()) {
    let dirty = false;
    for (const p of seam.participants) {
      if (!p.pendingSeatId || p.sessionId) continue;
      const st = seatState.get(p.pendingSeatId);
      if (st && st.sessionId) {
        p.sessionId = st.sessionId;
        delete p.pendingSeatId;
        dirty = true;
      }
    }
    if (dirty) { saveSeam(seam); changed = true; }
  }
  if (changed) broadcast();
}

// ---------- seat lifecycle (fed from seats.js's emit hook) ----------
function onSeatEvent(m) {
  if (!deps) return;
  if (m.type === 'seatNew') {
    if (m.pty || m.local) return;
    seatState.set(m.id, { busy: false, dead: false, sessionId: m.sessionId || null });
    if (m.sessionId) deliverAll();     // restored seat — flush anything owed
    return;
  }
  if (m.type !== 'seatEvt') return;
  const st = seatState.get(m.id);
  if (!st) return;
  switch (m.m.type) {
    case 'init':
      if (m.m.local) { seatState.delete(m.id); return; }
      if (m.m.sessionId && !st.sessionId) {
        st.sessionId = m.m.sessionId;
        resolvePending();
        deliverAll();
      }
      break;
    case 'block': case 'delta': case 'tool': case 'thinkingTick':
      st.busy = true; break;
    case 'result':
      st.busy = false;
      if (st.pending) { st.pending = false; deliverAll(); }
      break;
    case 'dead':
      st.dead = true; st.pending = false; break;
  }
}

function seatClosed(seatId) { seatState.delete(seatId); }

// ---------- panel verbs ----------
function handleCreate(msg) {
  const title = str(msg.title, MAX_TITLE);
  if (!title) return;
  const seam = { id: mintId(), title, status: 'active', created: Date.now(),
                 participants: [], messages: [] };
  for (const r of Array.isArray(msg.recipients) ? msg.recipients.slice(0, 6) : [])
    addParticipant(seam, r);
  if (!seam.participants.length) {
    deps.bus.post('toast', { text: 'seam needs at least one recipient' });
    return;
  }
  const text = str(msg.text, MAX_MSG);
  if (text) seam.messages.push({ ts: Date.now(), from: 'Operator', text });
  saveSeam(seam);
  broadcast();
  resolvePending();
  deliverAll();
}

function handleSend(msg) {
  const seam = loadSeam(str(msg.seamId, 40));
  const text = str(msg.text, MAX_MSG);
  if (!seam || !text || seam.status !== 'active') return;
  seam.messages.push({ ts: Date.now(), from: 'Operator', text });
  saveSeam(seam);
  broadcast();
  deliverAll();
}

function handleAdd(msg) {
  const seam = loadSeam(str(msg.seamId, 40));
  if (!seam || seam.status !== 'active') return;
  if (addParticipant(seam, msg.recipient)) {
    saveSeam(seam);
    broadcast();
    resolvePending();
    deliverAll();
  }
}

function handleStatus(msg, status) {
  const seam = loadSeam(str(msg.seamId, 40));
  if (!seam) return;
  seam.status = status;
  saveSeam(seam);
  broadcast();
}

// ---------- seat-facing creation door ----------
// A seat has only file tools — it cannot post the seamCreate bus verb a UI
// uses, which is why a persona asked to "open a seam" had no lever and either
// handed the work back to the operator or faked the channel inside its own
// chat. This is the missing door: the seat drops a request file named
// `_new-<anything>.json` into the state dir carrying
//   { title, recipients: [ {persona:"Ada"} | {seatId:"..."} ], text }
// and the watcher routes it through the SAME handleCreate the panel drives —
// real seats get spawned, the opening message is delivered — then removes the
// request. The leading `_` keeps it out of listFiles() so a request is never
// mistaken for a seam.
function handleSeatCreate(req) {
  if (!req || typeof req !== 'object') return;
  handleCreate({ title: req.title, recipients: req.recipients, text: req.text });
}
function handleSeatCreateFile(filename) {
  const file = path.join(deps.stateDir, filename);
  let req = null;
  try { req = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return; }                     // deleted / mid-write / bad JSON
  try { fs.unlinkSync(file); } catch { /* already gone */ }
  lastWrite.delete(file);
  handleSeatCreate(req);
}

// ---------- watcher: seat file edits -> fan-out + panel ----------
function onDirChange(_evt, filename) {
  if (!filename || !filename.endsWith('.json')) return;
  clearTimeout(pendingFiles.get(filename));
  pendingFiles.set(filename, setTimeout(() => {
    pendingFiles.delete(filename);
    if (filename.startsWith('_new-')) { handleSeatCreateFile(filename); return; }
    const file = path.join(deps.stateDir, filename);
    let text = null;
    try { text = fs.readFileSync(file, 'utf8'); } catch { /* deleted/mid-write */ }
    if (text !== null && text === lastWrite.get(file)) return;   // our own echo
    broadcast();
    deliverAll();
  }, 250));
}

function register(d) {
  deps = Object.assign({ log: () => {} }, d);
  fs.mkdirSync(deps.stateDir, { recursive: true });
  try { fs.watch(deps.stateDir, { persistent: false }, onDirChange); }
  catch (e) { deps.log('seams watch failed (no live seat-edit refresh): ' + e.message); }
  deps.bus.on('seamGet', () => broadcast());
  deps.bus.on('seamCreate', handleCreate);
  deps.bus.on('seamSend', handleSend);
  deps.bus.on('seamAdd', handleAdd);
  deps.bus.on('seamClose', (msg) => handleStatus(msg, 'closed'));
  deps.bus.on('seamReopen', (msg) => handleStatus(msg, 'active'));
}

module.exports = { register, onSeatEvent, seatClosed,
                   _drill: { sanitizeSeam, loadAll, seatState,
                             handleSeatCreate, handleSeatCreateFile } };
