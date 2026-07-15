// Apex — theme module (main side). Owns the token set and its persistence.
// Tokens are CSS custom properties; the renderer applies them, so changing a
// color touches nothing but paint. The Theme panel writes theme.json as local
// per-install state; the repository carries presets and factory defaults.
'use strict';

const fs = require('fs');
const path = require('path');
const bus = require('./bus');
const background = require('./background');

const FILE = path.join(__dirname, '..', 'theme.json');
const PRESETS_FILE = path.join(__dirname, '..', 'themes.json');

// Apex Shell's Slate factory palette. User choices persist to theme.json,
// which stays local to the installation.
const DEFAULTS = {
  bg:       '#171617',
  surface:  '#2a2d32',
  edge:     '#39414b',
  scroll:   '#46505c',
  text:     '#d3d7dd',
  dim:      '#6b7686',
  faint:    '#324157',
  accent:   '#50abf1',
  good:     '#16a34a',
  warning:  '#d97706',
  critical: '#dc2626'
};

const COLOR = /^#[0-9a-fA-F]{3,8}$/;
const RESERVED_NAMES = new Set(['__proto__', 'constructor', 'prototype']);

function cleanTokens(tokens) {
  const clean = {};
  for (const k of Object.keys(DEFAULTS)) {
    const v = String((tokens || {})[k] || DEFAULTS[k]);
    clean[k] = COLOR.test(v) ? v.toLowerCase() : DEFAULTS[k];
  }
  // scroll is new (2026-07-13): a theme/preset saved before it existed painted
  // scrollbars with `edge` — inherit that, not the factory default, so nobody's
  // look shifts on update. Only a missing/invalid scroll inherits.
  if (!COLOR.test(String((tokens || {}).scroll || ''))) clean.scroll = clean.edge;
  return clean;
}

function load() {
  try { return cleanTokens(JSON.parse(fs.readFileSync(FILE, 'utf8'))); }
  catch { return Object.assign({}, DEFAULTS); }
}

function save(tokens) {
  const clean = cleanTokens(tokens);
  fs.writeFileSync(FILE, JSON.stringify(clean, null, 2) + '\n');
  return clean;
}

function validName(name) {
  return typeof name === 'string' &&
    name.trim().length > 0 &&
    name.trim().length <= 48 &&
    !/[\u0000-\u001f]/.test(name) &&
    !RESERVED_NAMES.has(name.trim());
}

function loadPresets() {
  let raw;
  try { raw = JSON.parse(fs.readFileSync(PRESETS_FILE, 'utf8')); }
  catch { return {}; }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};

  const presets = {};
  for (const [name, tokens] of Object.entries(raw)) {
    if (validName(name)) presets[name.trim()] = cleanTokens(tokens);
  }
  return presets;
}

function savePresets(presets) {
  fs.writeFileSync(PRESETS_FILE, JSON.stringify(presets, null, 2) + '\n');
  return presets;
}

function postTheme(tokens, selected) {
  bus.post('theme', {
    tokens,
    defaults: Object.assign({}, DEFAULTS),
    presets: loadPresets(),
    selected: selected || ''
  });
}

function register() {
  background.register();

  bus.on('themeGet', () => postTheme(load()));
  bus.on('themeSet', (m) => postTheme(save(m.tokens)));

  bus.on('themeReset', () => {
    try { fs.unlinkSync(FILE); } catch {}
    postTheme(Object.assign({}, DEFAULTS));
  });

  bus.on('themePresetSave', (m) => {
    const name = typeof m.name === 'string' ? m.name.trim() : '';
    if (!validName(name)) {
      bus.post('toast', { text: 'Theme names need 1–48 visible characters' });
      return;
    }

    const tokens = save(m.tokens);
    const presets = loadPresets();
    presets[name] = tokens;
    savePresets(presets);
    postTheme(tokens, name);
    bus.post('toast', { text: 'Saved theme “' + name + '”' });
  });

  bus.on('themePresetApply', (m) => {
    const name = typeof m.name === 'string' ? m.name.trim() : '';
    const presets = loadPresets();
    if (!Object.prototype.hasOwnProperty.call(presets, name)) {
      bus.post('toast', { text: 'Saved theme not found' });
      postTheme(load());
      return;
    }
    postTheme(save(presets[name]), name);
  });

  bus.on('themePresetDelete', (m) => {
    const name = typeof m.name === 'string' ? m.name.trim() : '';
    const presets = loadPresets();
    if (!Object.prototype.hasOwnProperty.call(presets, name)) return;
    delete presets[name];
    savePresets(presets);
    postTheme(load());
    bus.post('toast', { text: 'Deleted theme “' + name + '”' });
  });
}

module.exports = { register, load, DEFAULTS };
