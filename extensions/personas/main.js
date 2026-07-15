// Persona Builder — runtime workspace selection and read-only status.
// Persona package creation arrives in a later slice; this module writes only
// its own ignored shell state after an explicit directory-picker action.
'use strict';

const fs = require('fs');
const path = require('path');
const foundation = require('./lib/foundation');

const CONFIG_FILE = 'workspace.json';

function configPath(stateDir) {
  if (typeof stateDir !== 'string' || !path.isAbsolute(stateDir))
    throw new Error('Persona Builder state directory must be absolute.');
  return path.join(stateDir, CONFIG_FILE);
}

function readWorkspaceConfig(stateDir) {
  const file = configPath(stateDir);
  if (!fs.existsSync(file)) return { workspace: null, error: null };
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!parsed || parsed.schema !== 1)
      throw new Error('schema must be 1');
    if (typeof parsed.workspace !== 'string' || !path.isAbsolute(parsed.workspace))
      throw new Error('workspace must be an absolute path');
    return { workspace: path.resolve(parsed.workspace), error: null };
  } catch (err) {
    return { workspace: null, error: 'Saved workspace setting is invalid: ' + err.message };
  }
}

function writeWorkspaceConfig(stateDir, workspace) {
  if (typeof workspace !== 'string' || !path.isAbsolute(workspace))
    throw new Error('Persona workspace must be an absolute path.');
  const resolved = path.resolve(workspace);
  const stat = fs.statSync(resolved);
  if (!stat.isDirectory()) throw new Error('Persona workspace must be a directory.');

  fs.mkdirSync(stateDir, { recursive: true });
  const destination = configPath(stateDir);
  const temporary = path.join(
    stateDir,
    `.${CONFIG_FILE}.${process.pid}.${Date.now()}.tmp`
  );
  try {
    fs.writeFileSync(temporary, JSON.stringify({ schema: 1, workspace: resolved }, null, 2) + '\n', {
      encoding: 'utf8',
      flag: 'wx',
    });
    fs.renameSync(temporary, destination);
  } finally {
    try { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); } catch { /* best effort */ }
  }
  return resolved;
}

function workspaceStatus(stateDir) {
  const saved = readWorkspaceConfig(stateDir);
  const status = {
    configured: false,
    workspace: saved.workspace,
    exists: false,
    foundationReady: false,
    personasReady: false,
    personaCount: 0,
    error: saved.error,
  };
  if (!saved.workspace) return status;

  try {
    if (!fs.existsSync(saved.workspace)) return status;
    status.exists = fs.statSync(saved.workspace).isDirectory();
    if (!status.exists) return status;
    status.configured = true;
    status.foundationReady = fs.existsSync(path.join(saved.workspace, 'foundation.md'));
    const personasDir = path.join(saved.workspace, 'personas');
    status.personasReady = fs.existsSync(personasDir) && fs.statSync(personasDir).isDirectory();
    if (status.personasReady) {
      status.personaCount = fs.readdirSync(personasDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory()).length;
    }
  } catch (err) {
    status.error = 'Could not inspect the persona workspace: ' + err.message;
  }
  return status;
}

function selectedWorkspace(stateDir) {
  const saved = readWorkspaceConfig(stateDir);
  if (saved.error) throw new Error(saved.error);
  if (!saved.workspace) throw new Error('Choose a persona workspace first.');
  return saved.workspace;
}

function foundationStatus(stateDir) {
  let workspace = null;
  try {
    workspace = selectedWorkspace(stateDir);
    return { ...foundation.inspectFoundation(workspace), error: null };
  } catch (err) {
    return { workspace, exists: false, content: '', revision: null, error: err.message };
  }
}

function register(ctx) {
  if (!ctx || !ctx.bus || typeof ctx.bus.on !== 'function' || typeof ctx.bus.post !== 'function')
    throw new Error('Persona Builder requires the extension bus.');
  if (typeof ctx.pickDirectory !== 'function')
    throw new Error('Persona Builder requires the directory-picker service.');
  configPath(ctx.stateDir); // validate once at load, before registering handlers

  const publishStatus = () => ctx.bus.post('personaWorkspaceStatus', workspaceStatus(ctx.stateDir));
  const publishFoundation = () =>
    ctx.bus.post('personaFoundationStatus', foundationStatus(ctx.stateDir));

  ctx.bus.on('personaWorkspaceGet', publishStatus);
  ctx.bus.on('personaFoundationGet', publishFoundation);
  ctx.bus.on('personaWorkspaceChoose', async () => {
    try {
      const current = readWorkspaceConfig(ctx.stateDir).workspace;
      const selected = await ctx.pickDirectory({
        title: 'Choose a Persona Builder workspace',
        defaultPath: current || undefined,
      });
      if (selected) writeWorkspaceConfig(ctx.stateDir, selected);
      publishStatus();
    } catch (err) {
      ctx.bus.post('toast', { text: 'Persona workspace was not changed: ' + err.message });
      publishStatus();
    }
  });

  ctx.bus.on('personaFoundationCreate', (message) => {
    try {
      foundation.createFoundation(selectedWorkspace(ctx.stateDir), message && message.content);
      ctx.bus.post('personaFoundationResult', { ok: true, action: 'created' });
      publishFoundation();
      publishStatus();
    } catch (err) {
      ctx.bus.post('personaFoundationResult', { ok: false, action: 'create', error: err.message });
      ctx.bus.post('toast', { text: 'Shared foundation was not created: ' + err.message });
    }
  });

  ctx.bus.on('personaFoundationSave', (message) => {
    try {
      foundation.saveFoundation(
        selectedWorkspace(ctx.stateDir),
        message && message.content,
        message && message.expectedRevision
      );
      ctx.bus.post('personaFoundationResult', { ok: true, action: 'saved' });
      publishFoundation();
      publishStatus();
    } catch (err) {
      ctx.bus.post('personaFoundationResult', {
        ok: false,
        action: 'save',
        conflict: err.code === 'FOUNDATION_CONFLICT',
        error: err.message,
      });
      ctx.bus.post('toast', { text: 'Shared foundation was not saved: ' + err.message });
    }
  });
}

module.exports = {
  register,
  readWorkspaceConfig,
  writeWorkspaceConfig,
  workspaceStatus,
  selectedWorkspace,
  foundationStatus,
};
