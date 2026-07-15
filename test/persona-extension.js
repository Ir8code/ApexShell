// Persona Builder workspace onboarding — deterministic headless gate.
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { stateDirFor, chooseDirectory } = require('../main/extensionServices');
const persona = require('../extensions/personas/main');

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

        nodes.get('.personaWorkspaceChoose').listeners.click();
        assert.equal(posts.at(-1).type, 'personaWorkspaceChoose');
        assert.equal(nodes.get('.personaWorkspaceChoose').disabled, true);
      } finally {
        delete global.document;
        delete global.ApexBus;
        delete global.ApexShell;
      }
    });

    console.log(`PERSONA EXTENSION: ${passed}/11 passed`);
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
})().catch(() => { process.exitCode = 1; });
