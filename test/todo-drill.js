'use strict';

// Headless drill for main/todo.js (J90): fake bus + fake host, real temp
// state dir. Proves the file lifecycle (mint → bind → resume), the first-send
// brief, user-edit notifications with busy deferral, and external-edit
// detection — without Electron or a live seat.

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const todo = require('../main/todo');

const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-todo-drill-'));
const busHandlers = {};
const busPosts = [];
const bus = {
  on: (t, fn) => { busHandlers[t] = fn; },
  post: (t, m) => busPosts.push({ t, m }),
};
const hostSends = [];
const host = { handle: (m) => hostSends.push(m) };

todo.register({ host, bus, stateDir, log: () => {} });

// ---- 1. fresh seat: tracked on seatNew, list broadcast empty ----
todo.onSeatEvent({ type: 'seatNew', id: 's1', pty: false, local: false, sessionId: null });
const first = busPosts.filter((p) => p.t === 'todoList').pop();
assert.ok(first && first.m.id === 's1' && first.m.entries.length === 0);
const file = todo._drill.seats.get('s1').file;
assert.ok(file.startsWith(stateDir));

// pty/local seats are never tracked
todo.onSeatEvent({ type: 'seatNew', id: 'p1', pty: true, local: true });
assert.ok(!todo._drill.seats.has('p1'));

// ---- 2. the brief rides the FIRST send only, and carries the path ----
const briefed = todo.briefOnFirstSend({ type: 'seatSend', id: 's1', text: 'hello' });
assert.ok(briefed.text.startsWith('<apex-todo-brief>'));
assert.ok(briefed.text.includes(file));
assert.ok(briefed.text.endsWith('hello'));
const second = todo.briefOnFirstSend({ type: 'seatSend', id: 's1', text: 'again' });
assert.equal(second.text, 'again');

// ---- 3. the user adds via the panel: file written, list posted, seat notified ----
busHandlers.todoAdd({ id: 's1', entry: { type: 'task', title: 'fix printer', delegate: 'qwen' } });
const onDisk = JSON.parse(fs.readFileSync(file, 'utf8'));
assert.equal(onDisk.entries.length, 1);
assert.equal(onDisk.entries[0].title, 'fix printer');
assert.equal(onDisk.entries[0].status, 'todo');           // default
const listed = busPosts.filter((p) => p.t === 'todoList').pop();
assert.equal(listed.m.entries.length, 1);
assert.equal(hostSends.length, 1);
assert.ok(hostSends[0].text.startsWith('<apex-todo-update>'));
assert.ok(hostSends[0].text.includes(file));

// ---- 4. busy seats defer + coalesce; result flushes exactly one ----
todo.onSeatEvent({ type: 'seatEvt', id: 's1', m: { type: 'block', kind: 'text' } });
const entryId = onDisk.entries[0].id;
busHandlers.todoUpdate({ id: 's1', entryId, patch: { status: 'in-progress' } });
busHandlers.todoUpdate({ id: 's1', entryId, patch: { status: 'blocked' } });
assert.equal(hostSends.length, 1);                        // both deferred
todo.onSeatEvent({ type: 'seatEvt', id: 's1', m: { type: 'result', ok: true } });
assert.equal(hostSends.length, 2);                        // one coalesced flush
assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).entries[0].status, 'blocked');
todo.onSeatEvent({ type: 'seatEvt', id: 's1', m: { type: 'result', ok: true } });
assert.equal(hostSends.length, 2);                        // nothing pending → no send

// ---- 5. init binds sessionId → token in the index ----
todo.onSeatEvent({ type: 'seatEvt', id: 's1', m: { type: 'init', sessionId: 'sess-abc' } });
const ix = JSON.parse(fs.readFileSync(path.join(stateDir, 'index.json'), 'utf8'));
assert.equal(ix['sess-abc'], path.basename(file, '.json'));

// ---- 6. resume: a new seat id on the same session finds the same file ----
todo.seatClosed('s1');
assert.ok(!todo._drill.seats.has('s1'));
todo.onSeatEvent({ type: 'seatNew', id: 's2', pty: false, local: false, sessionId: 'sess-abc' });
assert.equal(todo._drill.seats.get('s2').file, file);
const resumed = busPosts.filter((p) => p.t === 'todoList').pop();
assert.equal(resumed.m.entries.length, 1);                // list survives the resume

// resumed seats are BRIEFED from birth (the 2026-07-15 restart miss): no
// duplicate brief rides the next send, and user edits notify immediately
assert.equal(todo._drill.seats.get('s2').briefed, true);
const resumedSend = todo.briefOnFirstSend({ type: 'seatSend', id: 's2', text: 'resumed work' });
assert.equal(resumedSend.text, 'resumed work');
busHandlers.todoUpdate({ id: 's2', entryId, patch: { status: 'in-progress' } });
assert.ok(hostSends[hostSends.length - 1].text.startsWith('<apex-todo-update>'));
todo.onSeatEvent({ type: 'seatEvt', id: 's2', m: { type: 'result', ok: true } });

// ---- 7. seat's own file edit (the watcher path): panel refresh, NO notify ----
const sendsBefore = hostSends.length;
fs.writeFileSync(file, JSON.stringify({ entries: [
  { id: entryId, type: 'task', title: 'fix printer', delegate: 'qwen', status: 'done' },
  { type: 'item', title: 'buy toner' },
] }));
todo._drill.onDirChange(null, path.basename(file));
setTimeout(() => {
  const refreshed = busPosts.filter((p) => p.t === 'todoList').pop();
  assert.equal(refreshed.m.entries.length, 2);
  assert.equal(refreshed.m.entries[0].status, 'done');
  assert.equal(refreshed.m.entries[1].type, 'item');
  assert.equal(hostSends.length, sendsBefore);            // no seat notification

  // ---- 8. malformed JSON reports, never throws; task defaults delegate ----
  fs.writeFileSync(file, '{ not json');
  const bad = todo._drill.loadList(file);
  assert.ok(bad.error && bad.entries.length === 0);
  const t = todo._drill.sanitizeEntry({ type: 'task', title: 'x' });
  assert.equal(t.delegate, 'self');
  assert.equal(t.status, 'todo');
  const noTitle = todo._drill.sanitizeEntry({ type: 'item' });
  assert.equal(noTitle, null);

  fs.rmSync(stateDir, { recursive: true, force: true });
  console.log('todo drill: PASS');
}, 350);
