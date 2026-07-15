// Persona Builder — runtime workspace selection and read-only status.
// Persona package creation arrives in a later slice; this module writes only
// its own ignored shell state after an explicit directory-picker action.
'use strict';

const fs = require('fs');
const path = require('path');
const foundation = require('./lib/foundation');
const drafts = require('./lib/drafts');
const { CARDS } = require('./lib/interview');
const previewRenderer = require('./lib/render');

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

function interviewWorkspace(stateDir) {
  const workspace = selectedWorkspace(stateDir);
  if (!foundation.inspectFoundation(workspace).exists)
    throw new Error('Create the shared foundation before starting a persona draft.');
  return workspace;
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
  const publishDraftList = () => {
    try {
      const workspace = interviewWorkspace(ctx.stateDir);
      const listed = drafts.listDrafts(ctx.stateDir, workspace);
      ctx.bus.post('personaDraftList', { workspace, cards: CARDS, ...listed, error: null });
    } catch (err) {
      ctx.bus.post('personaDraftList', {
        workspace: null,
        cards: CARDS,
        drafts: [],
        warnings: [],
        error: err.message,
      });
    }
  };
  const draftFailure = (action, err) => {
    ctx.bus.post('personaDraftResult', {
      ok: false,
      action,
      conflict: err.code === 'DRAFT_CONFLICT',
      error: err.message,
    });
    ctx.bus.post('toast', { text: 'Persona draft was not changed: ' + err.message });
  };
  const postDraftStatus = (draft) => ctx.bus.post('personaDraftStatus', {
    draft,
    cards: CARDS,
    suggestedPersonaId: previewRenderer.normalizePersonaId(draft.name),
  });
  const previewFailure = (action, err, extra) => {
    ctx.bus.post('personaPreviewResult', { ok: false, action, error: err.message, ...(extra || {}) });
    if (!extra || !extra.needsConfirmation)
      ctx.bus.post('toast', { text: 'Persona preview was not changed: ' + err.message });
  };
  const currentWorkspaceDraft = (id) => {
    const workspace = interviewWorkspace(ctx.stateDir);
    const draft = drafts.readDraft(ctx.stateDir, id);
    if (path.resolve(draft.workspace) !== path.resolve(workspace))
      throw new Error('Draft belongs to a different workspace.');
    return draft;
  };

  ctx.bus.on('personaWorkspaceGet', publishStatus);
  ctx.bus.on('personaFoundationGet', publishFoundation);
  ctx.bus.on('personaDraftListGet', publishDraftList);
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

  ctx.bus.on('personaDraftCreate', (message) => {
    try {
      const draft = drafts.createDraft(ctx.stateDir, interviewWorkspace(ctx.stateDir), {
        name: message && message.name,
        useCase: message && message.useCase,
      });
      ctx.bus.post('personaDraftResult', { ok: true, action: 'created' });
      postDraftStatus(draft);
    } catch (err) { draftFailure('create', err); }
  });

  ctx.bus.on('personaDraftOpen', (message) => {
    try {
      const draft = currentWorkspaceDraft(message && message.id);
      postDraftStatus(draft);
    } catch (err) { draftFailure('open', err); }
  });

  ctx.bus.on('personaDraftSave', (message) => {
    try {
      const current = currentWorkspaceDraft(message && message.id);
      const draft = drafts.updateDraft(
        ctx.stateDir,
        current.id,
        message && message.expectedRevision,
        message && message.changes
      );
      ctx.bus.post('personaDraftResult', { ok: true, action: 'saved' });
      postDraftStatus(draft);
    } catch (err) { draftFailure('save', err); }
  });

  ctx.bus.on('personaDraftDelete', (message) => {
    try {
      if (!message || message.confirmed !== true)
        throw new Error('Draft deletion requires explicit confirmation.');
      const workspace = interviewWorkspace(ctx.stateDir);
      drafts.deleteDraft(ctx.stateDir, message.id, workspace);
      ctx.bus.post('personaDraftResult', { ok: true, action: 'deleted' });
      publishDraftList();
    } catch (err) { draftFailure('delete', err); }
  });

  ctx.bus.on('personaPreviewGenerate', (message) => {
    try {
      const current = currentWorkspaceDraft(message && message.id);
      const stale = current.preview &&
        current.preview.sourceHash !== previewRenderer.draftSourceHash(current);
      if (current.preview && (current.preview.canonicalDrift || stale) &&
          (!message || message.confirmedOverwrite !== true)) {
        const err = new Error('Regenerating everything will replace manual canonical edits or newer interview work.');
        previewFailure('generate', err, { needsConfirmation: true });
        return;
      }
      const bundle = previewRenderer.renderBundle(current, {
        personaId: message && message.personaId,
        mode: message && message.mode,
        actions: message && message.actions,
        collaboration: message && message.collaboration,
      });
      const draft = drafts.updateDraft(ctx.stateDir, current.id,
        message && message.expectedRevision, { preview: bundle });
      ctx.bus.post('personaPreviewResult', { ok: true, action: 'generated' });
      ctx.bus.post('personaPreviewStatus', { draft, bundle: draft.preview, stale: false });
    } catch (err) { previewFailure('generate', err); }
  });

  ctx.bus.on('personaPreviewOpen', (message) => {
    try {
      const draft = currentWorkspaceDraft(message && message.id);
      if (!draft.preview) throw new Error('Generate a preview first.');
      ctx.bus.post('personaPreviewStatus', {
        draft,
        bundle: draft.preview,
        stale: draft.preview.sourceHash !== previewRenderer.draftSourceHash(draft),
      });
    } catch (err) { previewFailure('open', err); }
  });

  ctx.bus.on('personaPreviewSaveCanonical', (message) => {
    try {
      const current = currentWorkspaceDraft(message && message.id);
      const bundle = previewRenderer.withCanonicalEdit(current.preview, message && message.canonical);
      const draft = drafts.updateDraft(ctx.stateDir, current.id,
        message && message.expectedRevision, { preview: bundle });
      ctx.bus.post('personaPreviewResult', { ok: true, action: 'canonical-saved' });
      ctx.bus.post('personaPreviewStatus', {
        draft,
        bundle: draft.preview,
        stale: draft.preview.sourceHash !== previewRenderer.draftSourceHash(draft),
      });
    } catch (err) { previewFailure('canonical-save', err); }
  });

  ctx.bus.on('personaPreviewRegenerateSection', (message) => {
    try {
      const current = currentWorkspaceDraft(message && message.id);
      if (!current.preview) throw new Error('Generate a preview first.');
      const key = message && message.key;
      const area = current.preview.blueprint && current.preview.blueprint[key];
      if (!area || typeof area.response !== 'string')
        throw new Error('Blueprint section is unavailable: ' + key);
      const bundle = previewRenderer.regenerateSection(current.preview, key, area.response);
      const draft = drafts.updateDraft(ctx.stateDir, current.id,
        message && message.expectedRevision, { preview: bundle });
      ctx.bus.post('personaPreviewResult', { ok: true, action: 'section-regenerated' });
      ctx.bus.post('personaPreviewStatus', {
        draft,
        bundle: draft.preview,
        stale: draft.preview.sourceHash !== previewRenderer.draftSourceHash(draft),
      });
    } catch (err) { previewFailure('section-regenerate', err); }
  });
}

module.exports = {
  register,
  readWorkspaceConfig,
  writeWorkspaceConfig,
  workspaceStatus,
  selectedWorkspace,
  foundationStatus,
  interviewWorkspace,
};
