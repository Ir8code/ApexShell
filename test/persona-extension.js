// Persona Builder workspace onboarding — deterministic headless gate.
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { stateDirFor, chooseDirectory } = require('../main/extensionServices');
const persona = require('../extensions/personas/main');
const foundation = require('../extensions/personas/lib/foundation');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-persona-extension-'));
let passed = 0;

async function gate(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log('PASS  ' + name);
  } catch (err) {
    console.error('FAIL  ' + name + ' — ' + err.message);
    throw err;
  }
}

function fakeBus() {
  const handlers = new Map();
  const posts = [];
  return {
    handlers,
    posts,
    on(type, fn) { handlers.set(type, fn); },
    post(type, payload) { posts.push({ type, payload }); },
  };
}

(async () => {
  try {
    await gate('state directory stays one level under its root', () => {
      const root = path.join(scratch, 'state');
      assert.equal(stateDirFor(root, 'personas'), path.join(root, 'personas'));
      assert.throws(() => stateDirFor(root, '..'), /one path segment/);
      assert.throws(() => stateDirFor(root, path.join('personas', 'nested')), /one path segment/);
    });

    await gate('directory picker returns a resolved selection', async () => {
      const selected = path.join(scratch, 'picked');
      let received;
      const dialog = {
        async showOpenDialog(options) {
          received = options;
          return { canceled: false, filePaths: [selected] };
        },
      };
      assert.equal(await chooseDirectory(dialog, { title: ' Persona home ', defaultPath: scratch }), selected);
      assert.equal(received.title, 'Persona home');
      assert.deepEqual(received.properties, ['openDirectory', 'createDirectory']);
      assert.equal(received.defaultPath, scratch);
    });

    await gate('directory picker cancellation is null', async () => {
      const dialog = { async showOpenDialog() { return { canceled: true, filePaths: [] }; } };
      assert.equal(await chooseDirectory(dialog), null);
    });

    await gate('workspace config is atomic and round-trips', () => {
      const stateDir = path.join(scratch, 'roundtrip-state');
      const workspace = path.join(scratch, 'roundtrip-workspace');
      fs.mkdirSync(workspace);
      assert.equal(persona.writeWorkspaceConfig(stateDir, workspace), workspace);
      assert.deepEqual(persona.readWorkspaceConfig(stateDir), { workspace, error: null });
      assert.deepEqual(fs.readdirSync(stateDir), ['workspace.json']);
    });

    await gate('workspace status reports portable structure', () => {
      const stateDir = path.join(scratch, 'status-state');
      const workspace = path.join(scratch, 'status-workspace');
      fs.mkdirSync(path.join(workspace, 'personas', 'coder'), { recursive: true });
      fs.mkdirSync(path.join(workspace, 'personas', 'reviewer'));
      fs.writeFileSync(path.join(workspace, 'foundation.md'), '# Foundation\n');
      persona.writeWorkspaceConfig(stateDir, workspace);
      assert.deepEqual(persona.workspaceStatus(stateDir), {
        configured: true,
        workspace,
        exists: true,
        foundationReady: true,
        personasReady: true,
        personaCount: 2,
        error: null,
      });
    });

    await gate('missing and malformed workspace settings stay recoverable', () => {
      const stateDir = path.join(scratch, 'recover-state');
      fs.mkdirSync(stateDir);
      assert.equal(persona.workspaceStatus(stateDir).configured, false);
      fs.writeFileSync(path.join(stateDir, 'workspace.json'), '{"schema":2}');
      const malformed = persona.workspaceStatus(stateDir);
      assert.equal(malformed.configured, false);
      assert.match(malformed.error, /schema must be 1/);
    });

    await gate('status request publishes without opening a picker', () => {
      const bus = fakeBus();
      let pickerCalls = 0;
      persona.register({
        bus,
        stateDir: path.join(scratch, 'get-state'),
        async pickDirectory() { pickerCalls += 1; return null; },
      });
      bus.handlers.get('personaWorkspaceGet')();
      assert.equal(pickerCalls, 0);
      assert.equal(bus.posts.at(-1).type, 'personaWorkspaceStatus');
    });

    await gate('cancel leaves configuration unchanged', async () => {
      const bus = fakeBus();
      const stateDir = path.join(scratch, 'cancel-state');
      persona.register({ bus, stateDir, async pickDirectory() { return null; } });
      await bus.handlers.get('personaWorkspaceChoose')();
      assert.equal(fs.existsSync(path.join(stateDir, 'workspace.json')), false);
      assert.equal(bus.posts.at(-1).type, 'personaWorkspaceStatus');
    });

    await gate('explicit selection persists and publishes ready status', async () => {
      const bus = fakeBus();
      const stateDir = path.join(scratch, 'choose-state');
      const workspace = path.join(scratch, 'choose-workspace');
      fs.mkdirSync(workspace);
      persona.register({ bus, stateDir, async pickDirectory() { return workspace; } });
      await bus.handlers.get('personaWorkspaceChoose')();
      const post = bus.posts.at(-1);
      assert.equal(post.type, 'personaWorkspaceStatus');
      assert.equal(post.payload.configured, true);
      assert.equal(persona.readWorkspaceConfig(stateDir).workspace, workspace);
    });

    await gate('picker failure toasts and republishes status', async () => {
      const bus = fakeBus();
      persona.register({
        bus,
        stateDir: path.join(scratch, 'failure-state'),
        async pickDirectory() { throw new Error('picker failed'); },
      });
      await bus.handlers.get('personaWorkspaceChoose')();
      assert.deepEqual(bus.posts.map((post) => post.type), ['toast', 'personaWorkspaceStatus']);
      assert.match(bus.posts[0].payload.text, /picker failed/);
    });

    await gate('portable foundation default contains only shared rules', () => {
      assert.match(foundation.DEFAULT_FOUNDATION, /^# Shared Foundation/m);
      assert.match(foundation.DEFAULT_FOUNDATION, /user alone creates or permanently changes a persona/i);
      assert.match(foundation.DEFAULT_FOUNDATION, /provider and model binding outside persona identity/i);
      assert.match(foundation.DEFAULT_FOUNDATION, /structured evidence packets/i);
      assert.doesNotMatch(foundation.DEFAULT_FOUNDATION, /Mox|Jinx|Clio|Sable|Keith|Matt/);
    });

    await gate('foundation creation is explicit, no-clobber, and structural', () => {
      const workspace = path.join(scratch, 'foundation-create-workspace');
      fs.mkdirSync(workspace);
      const created = foundation.createFoundation(workspace, '# Shared\r\n\r\nRule');
      assert.equal(created.exists, true);
      assert.equal(created.content, '# Shared\n\nRule\n');
      assert.equal(created.revision, foundation.revisionOf(created.content));
      assert.equal(fs.statSync(path.join(workspace, 'personas')).isDirectory(), true);
      assert.throws(
        () => foundation.createFoundation(workspace, '# Replacement\n'),
        /will not overwrite/
      );
      assert.equal(fs.readFileSync(path.join(workspace, 'foundation.md'), 'utf8'), created.content);
    });

    await gate('invalid foundation content has no workspace side effects', () => {
      const workspace = path.join(scratch, 'foundation-invalid-workspace');
      fs.mkdirSync(workspace);
      assert.throws(() => foundation.createFoundation(workspace, '   '), /cannot be empty/);
      assert.equal(fs.existsSync(path.join(workspace, 'foundation.md')), false);
      assert.equal(fs.existsSync(path.join(workspace, 'personas')), false);
    });

    await gate('foundation save rejects stale revisions without losing either edit', () => {
      const workspace = path.join(scratch, 'foundation-conflict-workspace');
      fs.mkdirSync(workspace);
      const created = foundation.createFoundation(workspace, '# Original\n');
      fs.writeFileSync(path.join(workspace, 'foundation.md'), '# Outside edit\n');
      assert.throws(
        () => foundation.saveFoundation(workspace, '# Builder edit\n', created.revision),
        /changed since it was loaded/
      );
      assert.equal(fs.readFileSync(path.join(workspace, 'foundation.md'), 'utf8'), '# Outside edit\n');
      const refreshed = foundation.inspectFoundation(workspace);
      const saved = foundation.saveFoundation(workspace, '# Accepted edit', refreshed.revision);
      assert.equal(saved.content, '# Accepted edit\n');
      assert.deepEqual(fs.readdirSync(workspace).sort(), ['foundation.md', 'personas']);
    });

    await gate('foundation creation rejects a linked personas directory', () => {
      const workspace = path.join(scratch, 'foundation-link-workspace');
      const outside = path.join(scratch, 'foundation-link-outside');
      fs.mkdirSync(workspace);
      fs.mkdirSync(outside);
      fs.symlinkSync(outside, path.join(workspace, 'personas'), process.platform === 'win32' ? 'junction' : 'dir');
      assert.throws(
        () => foundation.createFoundation(workspace, '# Shared\n'),
        /symbolic link/
      );
      assert.equal(fs.existsSync(path.join(workspace, 'foundation.md')), false);
    });

    await gate('foundation bus create publishes result and refreshed state', () => {
      const bus = fakeBus();
      const stateDir = path.join(scratch, 'foundation-bus-state');
      const workspace = path.join(scratch, 'foundation-bus-workspace');
      fs.mkdirSync(workspace);
      persona.writeWorkspaceConfig(stateDir, workspace);
      persona.register({ bus, stateDir, async pickDirectory() { return null; } });
      bus.handlers.get('personaFoundationCreate')({ content: foundation.DEFAULT_FOUNDATION });
      assert.deepEqual(
        bus.posts.map((post) => post.type),
        ['personaFoundationResult', 'personaFoundationStatus', 'personaWorkspaceStatus']
      );
      assert.deepEqual(bus.posts[0].payload, { ok: true, action: 'created' });
      assert.equal(bus.posts[1].payload.exists, true);
      assert.equal(bus.posts[2].payload.foundationReady, true);
    });

    await gate('foundation bus conflict reports failure without replacing editor state', () => {
      const bus = fakeBus();
      const stateDir = path.join(scratch, 'foundation-conflict-state');
      const workspace = path.join(scratch, 'foundation-conflict-bus-workspace');
      fs.mkdirSync(workspace);
      persona.writeWorkspaceConfig(stateDir, workspace);
      const created = foundation.createFoundation(workspace, '# Original\n');
      fs.writeFileSync(path.join(workspace, 'foundation.md'), '# Outside\n');
      persona.register({ bus, stateDir, async pickDirectory() { return null; } });
      bus.handlers.get('personaFoundationSave')({
        content: '# Builder\n',
        expectedRevision: created.revision,
      });
      assert.deepEqual(bus.posts.map((post) => post.type), ['personaFoundationResult', 'toast']);
      assert.equal(bus.posts[0].payload.ok, false);
      assert.equal(bus.posts[0].payload.conflict, true);
      assert.match(bus.posts[0].payload.error, /changed since it was loaded/);
      assert.equal(fs.readFileSync(path.join(workspace, 'foundation.md'), 'utf8'), '# Outside\n');
    });

    await gate('renderer registers dock and drives workspace messages', () => {
      const nodes = new Map();
      const pane = {
        className: '',
        id: '',
        dataset: {},
        markup: '',
        set innerHTML(value) { this.markup = value; },
        get innerHTML() { return this.markup; },
        querySelector(selector) {
          if (!nodes.has(selector)) {
            nodes.set(selector, {
              dataset: {},
              textContent: '',
              value: '',
              hidden: false,
              disabled: false,
              listeners: {},
              addEventListener(type, fn) { this.listeners[type] = fn; },
            });
          }
          return nodes.get(selector);
        },
      };
      const posts = [];
      const handlers = new Map();
      let registered;
      global.document = { createElement(tag) { assert.equal(tag, 'div'); return pane; } };
      global.ApexBus = {
        on(type, fn) { handlers.set(type, fn); },
        post(type, payload) { posts.push({ type, payload }); },
      };
      global.ApexShell = {
        registerDockPane(element, options) { registered = { element, options }; },
      };
      try {
        const renderer = require.resolve('../extensions/personas/renderer');
        delete require.cache[renderer];
        require(renderer);
        assert.equal(registered.element, pane);
        assert.deepEqual(registered.options, { order: 20 });
        assert.match(pane.innerHTML, /PERSONAS/);
        assert.equal(posts[0].type, 'personaWorkspaceGet');

        handlers.get('personaWorkspaceStatus')({
          configured: true,
          workspace: path.join(scratch, 'ui-workspace'),
          foundationReady: false,
          personasReady: true,
          personaCount: 2,
          error: null,
        });
        assert.equal(nodes.get('.personaWorkspaceState').textContent, 'Ready for setup');
        assert.match(nodes.get('.personaWorkspaceChecks').textContent, /2 persona packages/);
        assert.equal(posts.at(-1).type, 'personaFoundationGet');

        handlers.get('personaFoundationStatus')({
          workspace: path.join(scratch, 'ui-workspace'),
          exists: false,
          content: foundation.DEFAULT_FOUNDATION,
          revision: null,
          error: null,
        });
        assert.equal(nodes.get('.personaFoundationCard').hidden, false);
        assert.equal(nodes.get('.personaFoundationAction').textContent, 'CREATE FOUNDATION');
        nodes.get('.personaFoundationAction').listeners.click();
        assert.equal(posts.at(-1).type, 'personaFoundationCreate');
        assert.equal(posts.at(-1).payload.content, foundation.DEFAULT_FOUNDATION);

        handlers.get('personaFoundationResult')({ ok: false, conflict: true, error: 'conflict' });
        assert.match(nodes.get('.personaFoundationState').textContent, /Not saved/);
        assert.equal(nodes.get('.personaFoundationEditor').value, foundation.DEFAULT_FOUNDATION);
        assert.equal(nodes.get('.personaFoundationConflict').hidden, false);

        nodes.get('.personaFoundationKeepEdit').listeners.click();
        assert.equal(posts.at(-1).type, 'personaFoundationGet');
        handlers.get('personaFoundationStatus')({
          workspace: path.join(scratch, 'ui-workspace'),
          exists: true,
          content: '# Outside edit\n',
          revision: 'fresh-revision',
          error: null,
        });
        assert.equal(nodes.get('.personaFoundationEditor').value, foundation.DEFAULT_FOUNDATION);
        assert.match(nodes.get('.personaFoundationState').textContent, /edit is preserved/);
        assert.equal(nodes.get('.personaFoundationAction').disabled, false);
        nodes.get('.personaFoundationAction').listeners.click();
        assert.equal(posts.at(-1).type, 'personaFoundationSave');
        assert.equal(posts.at(-1).payload.expectedRevision, 'fresh-revision');

        nodes.get('.personaWorkspaceChoose').listeners.click();
        assert.equal(posts.at(-1).type, 'personaWorkspaceChoose');
        assert.equal(nodes.get('.personaWorkspaceChoose').disabled, true);
      } finally {
        delete global.document;
        delete global.ApexBus;
        delete global.ApexShell;
      }
    });

    console.log(`PERSONA EXTENSION: ${passed}/18 passed`);
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
})().catch(() => { process.exitCode = 1; });
