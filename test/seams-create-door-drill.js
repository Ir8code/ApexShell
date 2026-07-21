// Seams seat-facing creation door drill. A persona has only file tools, so it
// cannot post the seamCreate bus verb a UI would use. This exercises the file
// door that closes that gap: a `_new-*.json` request routes through the same
// handleCreate a UI drives, spawning REAL seats (not a channel faked inside one
// chat) and stamping the opening message. Runs the real module against a
// throwaway state dir — no Electron, no window.
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const seams = require('../main/seams');

const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-seams-drill-'));
const spawned = [];        // every createSeat call = a real seat a UI shows
const posts = [];          // bus posts (toasts, seamList)
let seatSeq = 0;

seams.register({
  host: { list: () => [], handle: () => {} },
  bus: { on: () => {}, post: (verb, msg) => posts.push({ verb, msg }) },
  stateDir,
  log: () => {},
  createSeat: (persona, title) => {
    spawned.push({ persona, title });
    return 'seat-' + persona.toLowerCase() + '-' + (++seatSeq);
  },
});

const seamFiles = () => fs.readdirSync(stateDir)
  .filter((f) => f.endsWith('.json') && f !== 'index.json' && !f.startsWith('_'));
const onlySeam = () => {
  const files = seamFiles();
  assert.strictEqual(files.length, 1, 'exactly one seam file expected');
  return JSON.parse(fs.readFileSync(path.join(stateDir, files[0]), 'utf8'));
};

// --- 1. a directive with two fresh personas spawns two real seats ----------
seams._drill.handleSeatCreate({
  title: 'Kickoff',
  recipients: [{ persona: 'Ada' }, { persona: 'Ben' }],
  text: 'Ada: open the review. Ben: stand by for her handoff.',
});
assert.deepStrictEqual(spawned.map((s) => s.persona), ['Ada', 'Ben'],
  'each fresh-persona recipient must spawn a real seat, not a simulated one');
const seam = onlySeam();
assert.strictEqual(seam.title, 'Kickoff');
assert.strictEqual(seam.status, 'active');
assert.strictEqual(seam.participants.length, 2, 'both recipients must join the seam');
assert.deepStrictEqual(seam.participants.map((p) => p.persona), ['Ada', 'Ben']);
assert.strictEqual(seam.messages.length, 1, 'the opening directive must seed the channel');
assert.strictEqual(seam.messages[0].from, 'Operator');
assert.match(seam.messages[0].text, /handoff/);
console.log('PASS: a seat directive spawns real seats and seeds the seam');

// --- 2. the `_new-` request file is consumed and never read as a seam -------
const reqName = '_new-abc123.json';
fs.writeFileSync(path.join(stateDir, reqName), JSON.stringify({
  title: 'Second channel', recipients: [{ persona: 'Cass' }], text: 'kick it off',
}));
assert.ok(!seamFiles().includes(reqName), 'a request file must not count as a seam');
seams._drill.handleSeatCreateFile(reqName);
assert.ok(!fs.existsSync(path.join(stateDir, reqName)), 'the request file must be removed after processing');
assert.strictEqual(spawned.at(-1).persona, 'Cass', 'the file door must spawn through the same path');
assert.strictEqual(seams._drill.loadAll().length, 2, 'both seams must now load');
console.log('PASS: a _new- request file is processed then removed, never mistaken for a seam');

// --- 3. a request with no valid recipients creates nothing ------------------
const before = seamFiles().length;
seams._drill.handleSeatCreate({ title: 'Empty', recipients: [], text: 'nobody' });
assert.strictEqual(seamFiles().length, before, 'a recipient-less request must not create a seam');
assert.ok(posts.some((p) => p.verb === 'toast'), 'the empty request must surface a toast, not a silent drop');
console.log('PASS: a recipient-less request creates nothing and surfaces a toast');

fs.rmSync(stateDir, { recursive: true, force: true });
console.log('SEAMS CREATE-DOOR DRILL: 3/3 PASS');
