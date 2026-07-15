// Apex — live source awareness + seat-safe process restart. Renderer changes
// can be applied in-place; main/preload changes require relaunching the app.
'use strict';

const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const bus = require('./bus');
const seats = require('./seats');

const APP_DIR = path.resolve(__dirname, '..');
const RESTORE_FILE = path.join(APP_DIR, 'state', 'restart-restore.json');
const RESTORE_MAX_AGE = 5 * 60 * 1000;

let registered = false;
let restoreConsumed = false;
let restarting = false;
let getWindow = () => null;
let watchers = [];
let debounce = null;
let burstKind = '';
let pendingKind = '';
let pendingNotice = null;

function escalate(a, b) {
  return a === 'restart' || b === 'restart' ? 'restart' : (a || b);
}

function announce() {
  if (pendingKind) bus.post('codeChanged', { kind: pendingKind });
}

function excluded(rel) {
  const parts = String(rel || '').replace(/\\/g, '/').toLowerCase().split('/').filter(Boolean);
  // app/.gitignore currently excludes these two top-level trees. They are not
  // watch roots, but keep the filter explicit so a recursive rename event
  // cannot turn local state into a source notification.
  if (parts[0] === 'state' || parts[0] === 'node_modules') return true;
  return parts.length === 1 && (parts[0] === 'theme.json' || parts[0] === 'seatconfig.json');
}

function flushChanges() {
  debounce = null;
  if (!burstKind) return;
  pendingKind = escalate(pendingKind, burstKind);
  burstKind = '';
  announce();
}

function changed(kind) {
  burstKind = escalate(burstKind, kind);
  clearTimeout(debounce);
  debounce = setTimeout(flushChanges, 450);
}

// Windows fs.watch also fires on attribute/access-metadata churn (indexer,
// Defender) — observed live 2026-07-13: a smoke showed the badge with zero
// real edits. The badge must not lie, so an event only counts as a change
// when the file's CONTENT fingerprint (mtime+size) differs from what we last
// saw. The map seeds at boot; a vanished file (delete/rename) counts too.
const prints = new Map();
function fingerprint(abs) {
  try { const s = fs.statSync(abs); return s.isDirectory() ? null : s.mtimeMs + ':' + s.size; }
  catch { return 'gone'; }
}

function seedPrints(dir, prefix) {
  let names;
  try { names = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of names) {
    const rel = prefix + '/' + e.name;
    if (excluded(rel)) continue;
    if (e.isDirectory()) seedPrints(path.join(dir, e.name), rel);
    else prints.set(rel, fingerprint(path.join(dir, e.name)));
  }
}

function reallyChanged(rel) {
  const abs = path.join(APP_DIR, ...rel.split('/'));
  const fp = fingerprint(abs);
  if (fp === null) return false;              // a directory event, not a file
  if (prints.get(rel) === fp) return false;   // metadata noise — content identical
  if (fp === 'gone') prints.delete(rel); else prints.set(rel, fp);
  return true;
}

function watchTree(dir, prefix, kind) {
  seedPrints(dir, prefix);
  try {
    const watcher = fs.watch(dir, { recursive: true }, (_event, filename) => {
      if (!filename) return;                  // unattributable — refuse to guess
      const rel = prefix + '/' + String(filename).replace(/\\/g, '/');
      if (!excluded(rel) && reallyChanged(rel))
        changed(typeof kind === 'function' ? kind(rel) : kind);
    });
    watcher.on('error', (e) => console.warn('[live-update] watch error:', e.message));
    watchers.push(watcher);
  } catch (e) {
    console.warn('[live-update] cannot watch ' + dir + ':', e.message);
  }
}

function startWatchers() {
  watchTree(path.join(APP_DIR, 'main'), 'main', 'restart');
  watchTree(path.join(APP_DIR, 'renderer'), 'renderer', 'renderer');
  // extensions: the renderer half (renderer.js, stylesheets) reloads in
  // place; the main half (main.js, manifests, anything else) needs a restart
  if (fs.existsSync(path.join(APP_DIR, 'extensions')))
    watchTree(path.join(APP_DIR, 'extensions'), 'extensions',
      (rel) => /renderer\.js$|\.css$/i.test(rel) ? 'renderer' : 'restart');

  // Watch the containing directory instead of the file itself: editors often
  // save preload.js by renaming a replacement over it, which retires a
  // file-bound watcher on Windows.
  prints.set('preload.js', fingerprint(path.join(APP_DIR, 'preload.js')));
  try {
    const watcher = fs.watch(APP_DIR, (_event, filename) => {
      if (filename && String(filename).replace(/\\/g, '/').toLowerCase() === 'preload.js'
          && reallyChanged('preload.js'))
        changed('restart');
    });
    watcher.on('error', (e) => console.warn('[live-update] preload watch error:', e.message));
    watchers.push(watcher);
  } catch (e) {
    console.warn('[live-update] cannot watch preload.js:', e.message);
  }
}

function saveRestore(snapshot) {
  const dir = path.dirname(RESTORE_FILE);
  const tmp = RESTORE_FILE + '.tmp';
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify({
    createdAt: new Date().toISOString(),
    chats: snapshot.chats,
    notRestored: snapshot.notRestored,
  }, null, 2), 'utf8');
  fs.rmSync(RESTORE_FILE, { force: true });
  fs.renameSync(tmp, RESTORE_FILE);
}

function updateAndRestart() {
  if (restarting) return;
  const snapshot = seats.snapshotForRestart();
  try {
    saveRestore(snapshot);
  } catch (e) {
    bus.post('toast', {
      text: 'Update & restart stopped — could not save open chats: ' + e.message,
    });
    return;
  }
  restarting = true;
  app.relaunch();
  // before-quit marks window closes as app-initiated; window-all-closed still
  // runs the existing dispose path before the process releases its lock.
  app.quit();
}

function register(windowGetter) {
  if (registered) return;
  registered = true;
  getWindow = windowGetter;
  startWatchers();

  bus.on('updateRestart', updateAndRestart);
  bus.on('ready', () => {
    announce();
    if (!pendingNotice) return;
    const n = pendingNotice.restored;
    let text = 'Restarted — restored ' + n + ' chat' + (n === 1 ? '' : 's');
    if (pendingNotice.notRestored.length)
      text += '; not restored: ' + pendingNotice.notRestored.join(', ');
    pendingNotice = null;
    bus.post('toast', { text });
  });
}

function consumeRestore() {
  if (restoreConsumed) return;
  restoreConsumed = true;
  if (!fs.existsSync(RESTORE_FILE)) return;

  let raw;
  let stat;
  try {
    stat = fs.statSync(RESTORE_FILE);
    raw = fs.readFileSync(RESTORE_FILE, 'utf8');
    // Consume before spawning anything. A crash during restore cannot replay
    // the same file on every subsequent boot.
    fs.unlinkSync(RESTORE_FILE);
  } catch (e) {
    console.warn('[live-update] cannot consume restart restore:', e.message);
    return;
  }

  let saved;
  try {
    saved = JSON.parse(raw);
  } catch (e) {
    console.warn('[live-update] invalid restart restore:', e.message);
    return;
  }

  const written = Date.parse(saved.createdAt) || stat.mtimeMs;
  if (!Number.isFinite(written) || Date.now() - written > RESTORE_MAX_AGE) return;

  const restored = seats.restoreChats(Array.isArray(saved.chats) ? saved.chats : []);
  pendingNotice = {
    restored,
    notRestored: Array.isArray(saved.notRestored)
      ? saved.notRestored.filter((s) => typeof s === 'string' && s)
      : [],
  };
}

function reload(windowOverride) {
  const mustRestart = pendingKind === 'restart' || burstKind === 'restart';
  clearTimeout(debounce);
  debounce = null;
  if (mustRestart) {
    pendingKind = 'restart';
    burstKind = '';
    announce();
  } else {
    pendingKind = '';
    burstKind = '';
    bus.post('codeChanged', { kind: '' });
  }

  const target = windowOverride || getWindow();
  if (target && !target.isDestroyed()) target.webContents.reload();
}

function dispose() {
  clearTimeout(debounce);
  debounce = null;
  for (const watcher of watchers) {
    try { watcher.close(); } catch { /* already closed */ }
  }
  watchers = [];
}

module.exports = { register, consumeRestore, reload, dispose };
