// Apex - built-in dock terminal. One lazy-started shell session owned by the
// main process so collapsing the dock (or reloading its renderer projection)
// never kills the PTY. The actual terminal driver stays the shared, Electron-
// free engine/ptySeat.js; this module only maps it onto typed bus verbs.
'use strict';

const os = require('os');
const path = require('path');
const bus = require('./bus');
const store = require('./store');
const { startPtySeat } = require('./engine/ptySeat');

const BUFFER_LIMIT = 256 * 1024;

let getCwd = () => os.homedir();
let term = null;
let alive = false;
let transcript = '';
let generation = 0;
let cols = 120;
let rows = 30;
let log = () => {};

function shellSpec() {
  if (process.platform === 'win32')
    return { command: 'powershell.exe', args: ['-NoLogo'], title: 'PowerShell' };
  const command = process.env.SHELL || '/bin/sh';
  return { command, args: [], title: path.basename(command) || 'Terminal' };
}

function postState(title, cwd) {
  bus.post('terminalState', { alive, title: title || 'Terminal', cwd: cwd || '' });
}

function append(data) {
  transcript += data;
  if (transcript.length > BUFFER_LIMIT)
    transcript = transcript.slice(transcript.length - BUFFER_LIMIT);
  bus.post('terminalData', { data });
}

function stop() {
  generation++;
  const old = term;
  term = null;
  alive = false;
  if (old) old.dispose();
}

function start() {
  stop();
  const myGeneration = generation;
  transcript = '';
  bus.post('terminalReset', {});

  const spec = shellSpec();
  const cwd = getCwd();
  try {
    term = startPtySeat({
      command: spec.command,
      args: spec.args,
      cwd,
      cols,
      rows,
      log,
      onEvent: (evt) => {
        if (myGeneration === generation && evt.type === 'ptyData') append(evt.data);
      },
      onExit: (code) => {
        if (myGeneration !== generation) return;
        term = null;
        alive = false;
        postState(spec.title, cwd);
        log('dock terminal exit: ' + code);
      },
    });
    alive = true;
    postState(spec.title, cwd);
  } catch (e) {
    term = null;
    alive = false;
    append('\r\n  Could not start the terminal: ' + e.message + '\r\n');
    postState(spec.title, cwd);
    log('dock terminal start failed: ' + e.message);
  }
}

function announce() {
  if (!term) { start(); return; }
  bus.post('terminalReset', {});
  if (transcript) bus.post('terminalData', { data: transcript });
  postState(shellSpec().title, getCwd());
}

function register(opts) {
  if (opts && typeof opts.cwd === 'function') getCwd = opts.cwd;
  log = store.openLog('terminal');
  bus.on('terminalAttach', announce);
  bus.on('terminalRestart', start);
  bus.on('terminalInput', (m) => { if (alive && term) term.write(String(m.data || '')); });
  bus.on('terminalResize', (m) => {
    const c = Math.max(2, Number(m.cols) || cols);
    const r = Math.max(2, Number(m.rows) || rows);
    cols = c; rows = r;
    if (alive && term) term.resize(c, r);
  });
}

function dispose() { stop(); }

module.exports = { register, dispose };
