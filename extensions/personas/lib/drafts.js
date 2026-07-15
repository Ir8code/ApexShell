// Persona Builder — crash-safe runtime draft store. Drafts are not portable
// persona packages and remain under the extension's ignored state directory.
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { KEYS } = require('./interview');

const SCHEMA = 1;
const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const MAX_DRAFT_BYTES = 256 * 1024;

function draftsDir(stateDir) {
  if (typeof stateDir !== 'string' || !path.isAbsolute(stateDir))
    throw new Error('Persona Builder state directory must be absolute.');
  return path.join(stateDir, 'drafts');
}

function draftPath(stateDir, id) {
  if (typeof id !== 'string' || !ID_RE.test(id)) throw new Error('Draft ID is invalid.');
  return path.join(draftsDir(stateDir), id + '.json');
}

function ensureDraftsDir(stateDir, create) {
  const dir = draftsDir(stateDir);
  try {
    const stat = fs.lstatSync(dir);
    if (stat.isSymbolicLink() || !stat.isDirectory())
      throw new Error('Draft store must be a regular directory, not a link.');
  } catch (err) {
    if (!err || err.code !== 'ENOENT') throw err;
    if (!create) return null;
    fs.mkdirSync(dir);
  }
  return dir;
}

function cleanText(value, label, max) {
  if (typeof value !== 'string') throw new Error(label + ' must be text.');
  const text = value.trim();
  if (!text) throw new Error(label + ' is required.');
  if (text.length > max) throw new Error(`${label} exceeds ${max} characters.`);
  return text;
}

function atomicWrite(stateDir, file, value) {
  ensureDraftsDir(stateDir, true);
  const temporary = path.join(
    path.dirname(file),
    `.${path.basename(file)}.${process.pid}.${crypto.randomUUID()}.tmp`
  );
  try {
    fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', {
      encoding: 'utf8',
      flag: 'wx',
    });
    fs.renameSync(temporary, file);
  } finally {
    try { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); } catch { /* best effort */ }
  }
}

function validateDraft(value, expectedId) {
  if (!value || value.schema !== SCHEMA) throw new Error('Draft schema must be 1.');
  if (!ID_RE.test(value.id) || (expectedId && value.id !== expectedId))
    throw new Error('Draft ID does not match its file.');
  if (typeof value.workspace !== 'string' || !path.isAbsolute(value.workspace))
    throw new Error('Draft workspace must be absolute.');
  cleanText(value.name, 'Persona name', 80);
  cleanText(value.useCase, 'Use case', 240);
  if (!Number.isInteger(value.revision) || value.revision < 1)
    throw new Error('Draft revision is invalid.');
  if (!Number.isInteger(value.currentCard) || value.currentCard < 0 || value.currentCard >= KEYS.length)
    throw new Error('Draft card position is invalid.');
  if (typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt)) ||
      typeof value.updatedAt !== 'string' || !Number.isFinite(Date.parse(value.updatedAt)))
    throw new Error('Draft timestamps are invalid.');
  if (!value.answers || typeof value.answers !== 'object' || Array.isArray(value.answers))
    throw new Error('Draft answers are invalid.');
  for (const key of KEYS) {
    if (typeof value.answers[key] !== 'string' || value.answers[key].length > 12000)
      throw new Error(`Draft answer ${key} is invalid.`);
  }
  return value;
}

function readDraft(stateDir, id) {
  ensureDraftsDir(stateDir, false);
  const file = draftPath(stateDir, id);
  const stat = fs.lstatSync(file);
  if (stat.isSymbolicLink() || !stat.isFile())
    throw new Error('Draft file must be a regular file, not a link.');
  if (stat.size > MAX_DRAFT_BYTES) throw new Error('Draft file exceeds the 256 KB limit.');
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  return validateDraft(parsed, id);
}

function createDraft(stateDir, workspace, starter) {
  if (typeof workspace !== 'string' || !path.isAbsolute(workspace))
    throw new Error('Choose a persona workspace first.');
  const root = path.resolve(workspace);
  if (!fs.statSync(root).isDirectory()) throw new Error('Persona workspace is unavailable.');
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const draft = {
    schema: SCHEMA,
    id,
    workspace: root,
    name: cleanText(starter && starter.name, 'Persona name', 80),
    useCase: cleanText(starter && starter.useCase, 'Use case', 240),
    revision: 1,
    currentCard: 0,
    answers: Object.fromEntries(KEYS.map((key) => [key, ''])),
    createdAt: now,
    updatedAt: now,
  };
  validateDraft(draft, id);
  const dir = ensureDraftsDir(stateDir, true);
  if (fs.readdirSync(dir).filter((name) => name.endsWith('.json')).length >= 100)
    throw new Error('Draft limit reached; remove an older draft first.');
  const file = draftPath(stateDir, id);
  if (fs.existsSync(file)) throw new Error('Draft ID collision; try again.');
  atomicWrite(stateDir, file, draft);
  return draft;
}

function updateDraft(stateDir, id, expectedRevision, changes) {
  const current = readDraft(stateDir, id);
  if (!Number.isInteger(expectedRevision) || expectedRevision !== current.revision) {
    const conflict = new Error('Draft changed since it was loaded; reopen it before editing.');
    conflict.code = 'DRAFT_CONFLICT';
    throw conflict;
  }
  const next = { ...current, answers: { ...current.answers } };
  if (changes && Object.prototype.hasOwnProperty.call(changes, 'currentCard')) {
    if (!Number.isInteger(changes.currentCard) || changes.currentCard < 0 || changes.currentCard >= KEYS.length)
      throw new Error('Draft card position is invalid.');
    next.currentCard = changes.currentCard;
  }
  if (changes && changes.answers !== undefined) {
    if (!changes.answers || typeof changes.answers !== 'object' || Array.isArray(changes.answers))
      throw new Error('Draft answer patch is invalid.');
    for (const [key, value] of Object.entries(changes.answers)) {
      if (!KEYS.includes(key)) throw new Error('Unknown draft answer: ' + key);
      if (typeof value !== 'string' || value.length > 12000)
        throw new Error(`Draft answer ${key} is invalid.`);
      next.answers[key] = value;
    }
  }
  next.revision += 1;
  next.updatedAt = new Date().toISOString();
  validateDraft(next, id);
  atomicWrite(stateDir, draftPath(stateDir, id), next);
  return next;
}

function listDrafts(stateDir, workspace) {
  const dir = ensureDraftsDir(stateDir, false);
  if (!dir) return { drafts: [], warnings: [] };
  const root = path.resolve(workspace);
  const drafts = [];
  const warnings = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const id = entry.name.slice(0, -5);
    try {
      const draft = readDraft(stateDir, id);
      if (path.resolve(draft.workspace) !== root) continue;
      drafts.push(draft);
    } catch (err) {
      warnings.push(`${entry.name}: ${err.message}`);
    }
  }
  drafts.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return { drafts, warnings };
}

function deleteDraft(stateDir, id, workspace) {
  const draft = readDraft(stateDir, id);
  if (path.resolve(draft.workspace) !== path.resolve(workspace))
    throw new Error('Draft belongs to a different workspace.');
  fs.unlinkSync(draftPath(stateDir, id));
}

module.exports = {
  SCHEMA,
  ID_RE,
  draftsDir,
  draftPath,
  validateDraft,
  readDraft,
  createDraft,
  updateDraft,
  listDrafts,
  deleteDraft,
};
