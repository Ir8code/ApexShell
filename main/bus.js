// Apex — the message bus (main side). ONE channel ('apex:msg'), typed
// messages, EXACT-type routing (J23 law: no prefix claims, no silent
// swallows — an unknown type logs loudly). Modules register their verbs;
// nothing else touches ipcMain.
// MULTI-HANDLER per type (2026-07-12): the original Map held ONE handler and
// silently last-wins'd — seats' 'ready' clobbered monitors' 'ready' and the
// tracker went dark. Same defect class J23 named, one layer down.
'use strict';

const { ipcMain } = require('electron');

const handlers = new Map();   // type -> [fn(payload, ctx), ...]
let target = null;            // the window's webContents

function route(msg) {
  const fns = handlers.get(msg && msg.type);
  if (fns && fns.length) fns.forEach((fn) => fn(msg, { post }));
  else console.warn('[bus] unhandled message type:', msg && msg.type);
}

function init(win) {
  target = win.webContents;
  ipcMain.removeAllListeners('apex:msg');
  ipcMain.on('apex:msg', (_e, msg) => route(msg));
}

// register('action', fn) — exact type match; multiple modules may share a type
function on(type, fn) {
  if (!handlers.has(type)) handlers.set(type, []);
  handlers.get(type).push(fn);
}

// post('data', {...}) — main -> renderer
function post(type, payload) {
  if (target && !target.isDestroyed()) target.send('apex:msg', Object.assign({ type }, payload));
}

// TEST AFFORDANCE (smoke only): drive a message through the exact routing a
// renderer post would take — proves main-side handling without a renderer.
function inject(msg) { route(msg); }

module.exports = { init, on, post, inject };
