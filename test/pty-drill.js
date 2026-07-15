// Apex — Phase-3 escape-hatch drill (plan §4): a REAL interactive `claude`
// TUI driven through the engine's PTY lane, headless. If the programmatic
// lane ever flips to metered, seats flip to this mode — so it must be proven
// BEFORE it's load-bearing. Exit gate: the TUI paints, a typed turn completes
// (distinctive marker in the response bytes), clean disposal.
// Usage: node app/test/pty-drill.js

const fs = require('fs');
const os = require('os');
const path = require('path');
const { startPtySeat, ptyAvailable } = require('../main/engine/ptySeat');

if (!ptyAvailable()) { console.error('FAIL: node-pty not loadable'); process.exit(2); }

const SCRATCH = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-pty-'));
// The response marker is a word the PROMPT never contains — echo can't fake it.
const PROMPT = 'Reply with the word apex then the word drill then the word ok, ' +
               'concatenated together in capital letters, and nothing else.';
const MARKER = 'APEXDRILLOK';

let bytes = '';
let painted = false;
let promptSent = false;
let trustAnswered = false;
let done = false;

const seat = startPtySeat({
  command: 'claude',
  args: ['--model', 'haiku'],
  cwd: SCRATCH,                       // outside the Apex tree: no chain load,
  cols: 120, rows: 30,                // downstream project filters skip scratch cwd
  log: () => {},
  onEvent: (e) => {
    if (e.type !== 'ptyData') return;
    bytes += e.data;
    if (!painted && bytes.length > 200) {
      painted = true;
      console.log('PASS  TUI painting (interactive claude is alive in the ConPTY)');
    }
    // Fresh scratch dir → the trust prompt may appear; accept its default.
    if (!trustAnswered && /trust/i.test(bytes)) {
      trustAnswered = true;
      setTimeout(() => seat.write('\r'), 400);
    }
    if (!done && promptSent && bytes.includes(MARKER)) {
      done = true;
      console.log('PASS  typed turn completed — response marker found');
      seat.write('/exit\r');
      setTimeout(() => { seat.dispose(); }, 2500);
    }
  },
  onExit: (code) => {
    console.log(done
      ? `PASS  clean exit (${code})\n\nESCAPE-HATCH DRILL: PASS`
      : `FAIL  exited before the turn completed (${code})\n\nESCAPE-HATCH DRILL: FAIL`);
    process.exit(done ? 0 : 1);
  },
});

// Give the TUI time to draw (and the trust prompt to be answered), then type.
setTimeout(() => {
  promptSent = true;
  seat.write(PROMPT);
  setTimeout(() => seat.write('\r'), 300);   // Enter separately — paste-vs-type quirks
}, 6000);

setTimeout(() => {
  console.error('FAIL: timeout. Last 600 bytes:\n' +
    bytes.slice(-600).replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, ''));
  seat.dispose();
  setTimeout(() => process.exit(1), 1000);
}, 120000);
