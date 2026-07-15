// Persona Builder workspace onboarding — deterministic headless gate.
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { stateDirFor, chooseDirectory } = require('../main/extensionServices');
const persona = require('../extensions/personas/main');
const foundation = require('../extensions/personas/lib/foundation');
const draftStore = require('../extensions/personas/lib/drafts');
const { CARDS, KEYS } = require('../extensions/personas/lib/interview');
const previewRenderer = require('../extensions/personas/lib/render');
const personaContract = require('../extensions/personas/lib/contract');

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

function completeAnswers(prefix = 'Complete') {
  return Object.fromEntries(KEYS.map((key) => [key, `${prefix} answer for ${key}.`]));
}

function previewChoices(personaId = 'rowan') {
  return {
    personaId,
    mode: 'operator',
    actions: Object.fromEntries([...personaContract.ACTION_CATEGORIES].map((key) => [key, 'ask'])),
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

    await gate('six interview cards explain expected answers in depth', () => {
      assert.deepEqual(CARDS.map((card) => card.key), KEYS);
      assert.equal(CARDS.length, 6);
      for (const card of CARDS) {
        assert.ok(card.question.length > 30, card.key + ' question is too thin');
        assert.ok(card.explanation.length > 220, card.key + ' explanation is too thin');
        assert.ok(card.include.length >= 4, card.key + ' coverage is too thin');
        assert.ok(card.suggestions.length >= 4, card.key + ' suggestions are too thin');
        assert.ok(card.example.length > 300, card.key + ' example is too thin');
        assert.ok(card.help.length > 60, card.key + ' help is too thin');
      }
      assert.match(CARDS[0].explanation, /name field identifies the persona/i);
      assert.match(CARDS[5].explanation, /never grants a tool, credential, permission, or provider/i);
      assert.match(CARDS[5].explanation, /allowed, ask, or blocked/i);
      assert.doesNotMatch(JSON.stringify(CARDS), /Mox|Jinx|Clio|Sable|Keith|Matt/);
    });

    await gate('draft creation is atomic, complete, and runtime-local', () => {
      const stateDir = path.join(scratch, 'draft-create-state');
      const workspace = path.join(scratch, 'draft-create-workspace');
      fs.mkdirSync(stateDir);
      fs.mkdirSync(workspace);
      const draft = draftStore.createDraft(stateDir, workspace, {
        name: ' Rowan ',
        useCase: ' Review code independently. ',
      });
      assert.equal(draft.name, 'Rowan');
      assert.equal(draft.useCase, 'Review code independently.');
      assert.equal(draft.revision, 1);
      assert.equal(draft.currentCard, 0);
      assert.deepEqual(Object.keys(draft.answers), KEYS);
      assert.equal(Object.values(draft.answers).every((answer) => answer === ''), true);
      assert.deepEqual(fs.readdirSync(path.join(stateDir, 'drafts')), [draft.id + '.json']);
      assert.equal(fs.existsSync(path.join(workspace, 'drafts')), false);
      assert.throws(
        () => draftStore.createDraft(stateDir, workspace, { name: 'Bad\nName', useCase: 'Reject.' }),
        /single-line/
      );
    });

    await gate('draft updates are revision-gated and preserve prior data on conflict', () => {
      const stateDir = path.join(scratch, 'draft-update-state');
      const workspace = path.join(scratch, 'draft-update-workspace');
      fs.mkdirSync(stateDir);
      fs.mkdirSync(workspace);
      const created = draftStore.createDraft(stateDir, workspace, {
        name: 'Rowan',
        useCase: 'Review changes.',
      });
      const updated = draftStore.updateDraft(stateDir, created.id, created.revision, {
        currentCard: 1,
        answers: { identity: 'Evidence-first release engineer.' },
      });
      assert.equal(updated.revision, 2);
      assert.equal(updated.currentCard, 1);
      assert.equal(updated.answers.identity, 'Evidence-first release engineer.');
      assert.throws(
        () => draftStore.updateDraft(stateDir, created.id, 1, { currentCard: 2 }),
        /changed since it was loaded/
      );
      try { draftStore.updateDraft(stateDir, created.id, 1, { currentCard: 2 }); }
      catch (err) { assert.equal(err.code, 'DRAFT_CONFLICT'); }
      assert.deepEqual(draftStore.readDraft(stateDir, created.id), updated);
    });

    await gate('draft listing isolates workspaces and reports malformed files', () => {
      const stateDir = path.join(scratch, 'draft-list-state');
      const workspaceA = path.join(scratch, 'draft-list-a');
      const workspaceB = path.join(scratch, 'draft-list-b');
      fs.mkdirSync(stateDir);
      fs.mkdirSync(workspaceA);
      fs.mkdirSync(workspaceB);
      const draftA = draftStore.createDraft(stateDir, workspaceA, { name: 'A', useCase: 'Use A.' });
      draftStore.createDraft(stateDir, workspaceB, { name: 'B', useCase: 'Use B.' });
      fs.writeFileSync(path.join(stateDir, 'drafts', 'not-a-draft.json'), '{bad');
      const listed = draftStore.listDrafts(stateDir, workspaceA);
      assert.deepEqual(listed.drafts.map((draft) => draft.id), [draftA.id]);
      assert.equal(listed.warnings.length, 1);
      assert.match(listed.warnings[0], /Draft ID is invalid/);
    });

    await gate('linked draft stores are rejected before read or write', () => {
      const stateDir = path.join(scratch, 'draft-link-state');
      const outside = path.join(scratch, 'draft-link-outside');
      const workspace = path.join(scratch, 'draft-link-workspace');
      fs.mkdirSync(stateDir);
      fs.mkdirSync(outside);
      fs.mkdirSync(workspace);
      fs.symlinkSync(outside, path.join(stateDir, 'drafts'), process.platform === 'win32' ? 'junction' : 'dir');
      assert.throws(
        () => draftStore.createDraft(stateDir, workspace, { name: 'Link', useCase: 'Reject links.' }),
        /regular directory, not a link/
      );
      assert.deepEqual(fs.readdirSync(outside), []);
    });

    await gate('draft bus supports create, save, reopen, and confirmed delete', () => {
      const bus = fakeBus();
      const stateDir = path.join(scratch, 'draft-bus-state');
      const workspace = path.join(scratch, 'draft-bus-workspace');
      fs.mkdirSync(workspace);
      persona.writeWorkspaceConfig(stateDir, workspace);
      foundation.createFoundation(workspace, foundation.DEFAULT_FOUNDATION);
      persona.register({ bus, stateDir, async pickDirectory() { return null; } });

      bus.handlers.get('personaDraftCreate')({ name: 'Rowan', useCase: 'Review releases.' });
      assert.deepEqual(bus.posts.map((post) => post.type), ['personaDraftResult', 'personaDraftStatus']);
      const created = bus.posts[1].payload.draft;
      assert.equal(bus.posts[1].payload.cards.length, 6);

      bus.posts.length = 0;
      bus.handlers.get('personaDraftSave')({
        id: created.id,
        expectedRevision: created.revision,
        changes: { currentCard: 1, answers: { identity: 'A careful reviewer.' } },
      });
      assert.deepEqual(bus.posts.map((post) => post.type), ['personaDraftResult', 'personaDraftStatus']);
      const saved = bus.posts[1].payload.draft;
      assert.equal(saved.answers.identity, 'A careful reviewer.');

      bus.posts.length = 0;
      bus.handlers.get('personaDraftOpen')({ id: created.id });
      assert.equal(bus.posts[0].payload.draft.revision, 2);

      bus.posts.length = 0;
      bus.handlers.get('personaDraftDelete')({ id: created.id, confirmed: false });
      assert.deepEqual(bus.posts.map((post) => post.type), ['personaDraftResult', 'toast']);
      assert.equal(fs.existsSync(draftStore.draftPath(stateDir, created.id)), true);

      bus.posts.length = 0;
      bus.handlers.get('personaDraftDelete')({ id: created.id, confirmed: true });
      assert.deepEqual(bus.posts.map((post) => post.type), ['personaDraftResult', 'personaDraftList']);
      assert.equal(fs.existsSync(draftStore.draftPath(stateDir, created.id)), false);
    });

    await gate('persona IDs normalize safely without preserving path syntax', () => {
      assert.equal(previewRenderer.normalizePersonaId(' Rowan Release Reviewer '), 'rowan-release-reviewer');
      assert.equal(previewRenderer.normalizePersonaId('../../Admin'), 'admin');
      assert.equal(previewRenderer.normalizePersonaId('42 Answers'), 'persona-42-answers');
      assert.equal(previewRenderer.normalizePersonaId('🔥'), 'persona');
      assert.equal(personaContract.isSafePersonaId(previewRenderer.normalizePersonaId('A'.repeat(100))), true);
    });

    await gate('blueprint and canonical render as a contract-valid package', () => {
      const workspace = path.join(scratch, 'preview-package-workspace');
      const draft = {
        name: 'Rowan "Release"',
        useCase: 'Review releases: independently and precisely.',
        answers: completeAnswers(),
      };
      const bundle = previewRenderer.renderBundle(draft, previewChoices('rowan-release'));
      assert.equal(bundle.blueprint.canonical_hash, personaContract.hashCanonical(bundle.canonical));
      assert.equal(bundle.canonicalDrift, false);
      assert.match(bundle.canonical, /<!-- persona-builder:identity:start -->/);
      const parsed = personaContract.parseFrontmatter(bundle.canonical);
      assert.equal(parsed.attributes.name, 'rowan-release');
      assert.equal(parsed.attributes.display_name, draft.name);

      const paths = personaContract.packagePaths(workspace, 'rowan-release');
      fs.mkdirSync(path.dirname(paths.memoryIndex), { recursive: true });
      fs.writeFileSync(paths.canonical, bundle.canonical);
      fs.writeFileSync(paths.blueprint, JSON.stringify(bundle.blueprint, null, 2));
      fs.writeFileSync(paths.memoryIndex, '# Memory\n');
      fs.writeFileSync(paths.scratchpad, '# Scratchpad\n');
      const report = personaContract.validatePersonaPackage(workspace, 'rowan-release');
      assert.equal(report.valid, true, JSON.stringify(report.errors));
      assert.equal(report.warnings.length, 0, JSON.stringify(report.warnings));
    });

    await gate('preview generation refuses missing answers and action choices', () => {
      const draft = { name: 'Rowan', useCase: 'Review.', answers: completeAnswers() };
      draft.answers.boundaries = '';
      assert.throws(
        () => previewRenderer.renderBundle(draft, previewChoices()),
        /Complete the interview card: Persona-Specific Boundaries/
      );
      draft.answers.boundaries = 'Read-only review boundary.';
      const choices = previewChoices();
      choices.actions.delete_data = '';
      assert.throws(() => previewRenderer.renderBundle(draft, choices), /delete_data/);
    });

    await gate('manual canonical edits drift without false newline drift', () => {
      const draft = { name: 'Rowan', useCase: 'Review.', answers: completeAnswers() };
      const bundle = previewRenderer.renderBundle(draft, previewChoices());
      const noFinalNewline = previewRenderer.withCanonicalEdit(bundle, bundle.canonical.trimEnd());
      assert.equal(noFinalNewline.canonicalDrift, false);
      const edited = previewRenderer.withCanonicalEdit(bundle,
        bundle.canonical.replace('Complete answer for identity.', 'Manually refined identity.'));
      assert.equal(edited.canonicalDrift, true);
      assert.equal(edited.blueprint.canonical_hash, bundle.generatedCanonicalHash);
    });

    await gate('targeted regeneration preserves edits outside its marked section', () => {
      const draft = { name: 'Rowan', useCase: 'Review.', answers: completeAnswers() };
      const bundle = previewRenderer.renderBundle(draft, previewChoices());
      const manual = previewRenderer.withCanonicalEdit(bundle,
        bundle.canonical.replace('Complete answer for mission.', 'Manual mission stays.'));
      const identityEdited = previewRenderer.withCanonicalEdit(manual,
        manual.canonical.replace('Complete answer for identity.', 'Temporary identity edit.'));
      const regenerated = previewRenderer.regenerateSection(
        identityEdited,
        'identity',
        identityEdited.blueprint.identity.response
      );
      assert.match(regenerated.canonical, /Complete answer for identity\./);
      assert.match(regenerated.canonical, /Manual mission stays\./);
      assert.equal(regenerated.canonicalDrift, true);
      assert.throws(
        () => previewRenderer.regenerateSection(
          { ...bundle, canonical: bundle.canonical.replace('<!-- persona-builder:identity:start -->', '') },
          'identity',
          bundle.blueprint.identity.response
        ),
        /Section markers are missing/
      );
    });

    await gate('preview persists in a revisioned draft and rejects tampered drift state', () => {
      const stateDir = path.join(scratch, 'preview-draft-state');
      const workspace = path.join(scratch, 'preview-draft-workspace');
      fs.mkdirSync(stateDir);
      fs.mkdirSync(workspace);
      const created = draftStore.createDraft(stateDir, workspace, { name: 'Rowan', useCase: 'Review.' });
      const completed = draftStore.updateDraft(stateDir, created.id, created.revision,
        { answers: completeAnswers() });
      const bundle = previewRenderer.renderBundle(completed, previewChoices());
      const withPreview = draftStore.updateDraft(stateDir, created.id, completed.revision,
        { preview: bundle });
      assert.equal(withPreview.preview.canonicalDrift, false);
      const manual = previewRenderer.withCanonicalEdit(withPreview.preview,
        withPreview.preview.canonical.replace('# Rowan', '# Rowan — reviewed'));
      const saved = draftStore.updateDraft(stateDir, created.id, withPreview.revision,
        { preview: manual });
      assert.equal(saved.preview.canonicalDrift, true);

      const file = draftStore.draftPath(stateDir, created.id);
      const tampered = JSON.parse(fs.readFileSync(file, 'utf8'));
      tampered.preview.canonicalDrift = false;
      fs.writeFileSync(file, JSON.stringify(tampered));
      assert.throws(() => draftStore.readDraft(stateDir, created.id), /drift state is invalid/);
    });

    await gate('preview bus requires confirmation before replacing manual edits', () => {
      const bus = fakeBus();
      const stateDir = path.join(scratch, 'preview-bus-state');
      const workspace = path.join(scratch, 'preview-bus-workspace');
      fs.mkdirSync(workspace);
      persona.writeWorkspaceConfig(stateDir, workspace);
      foundation.createFoundation(workspace, foundation.DEFAULT_FOUNDATION);
      let draft = draftStore.createDraft(stateDir, workspace, { name: 'Rowan', useCase: 'Review.' });
      draft = draftStore.updateDraft(stateDir, draft.id, draft.revision, { answers: completeAnswers() });
      persona.register({ bus, stateDir, async pickDirectory() { return null; } });

      bus.handlers.get('personaPreviewGenerate')({
        id: draft.id,
        expectedRevision: draft.revision,
        ...previewChoices(),
      });
      assert.deepEqual(bus.posts.map((post) => post.type), ['personaPreviewResult', 'personaPreviewStatus']);
      draft = bus.posts[1].payload.draft;

      bus.posts.length = 0;
      bus.handlers.get('personaPreviewSaveCanonical')({
        id: draft.id,
        expectedRevision: draft.revision,
        canonical: draft.preview.canonical.replace('# Rowan', '# Rowan edited'),
      });
      draft = bus.posts[1].payload.draft;
      assert.equal(draft.preview.canonicalDrift, true);

      bus.posts.length = 0;
      bus.handlers.get('personaPreviewGenerate')({
        id: draft.id,
        expectedRevision: draft.revision,
        ...previewChoices(),
      });
      assert.deepEqual(bus.posts.map((post) => post.type), ['personaPreviewResult']);
      assert.equal(bus.posts[0].payload.needsConfirmation, true);

      bus.posts.length = 0;
      bus.handlers.get('personaPreviewGenerate')({
        id: draft.id,
        expectedRevision: draft.revision,
        ...previewChoices(),
        confirmedOverwrite: true,
      });
      assert.deepEqual(bus.posts.map((post) => post.type), ['personaPreviewResult', 'personaPreviewStatus']);
      assert.equal(bus.posts[1].payload.bundle.canonicalDrift, false);
    });

    await gate('renderer registers dock and drives workspace messages', () => {
      function makeNode() {
        return {
          dataset: {},
          textContent: '',
          value: '',
          hidden: false,
          disabled: false,
          children: [],
          listeners: {},
          addEventListener(type, fn) { this.listeners[type] = fn; },
          appendChild(child) { this.children.push(child); return child; },
          replaceChildren(...children) { this.children = children; },
        };
      }
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
            nodes.set(selector, makeNode());
          }
          return nodes.get(selector);
        },
      };
      const posts = [];
      const handlers = new Map();
      let registered;
      let rootCreated = false;
      global.document = {
        createElement(tag) {
          if (!rootCreated) {
            assert.equal(tag, 'div');
            rootCreated = true;
            return pane;
          }
          return makeNode();
        },
      };
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

        handlers.get('personaDraftList')({ workspace: path.join(scratch, 'ui-workspace'), cards: CARDS, drafts: [], warnings: [], error: null });
        assert.equal(nodes.get('.personaDraftHome').hidden, false);
        assert.equal(nodes.get('.personaDraftCreate').disabled, true);
        nodes.get('.personaDraftName').value = 'Rowan';
        nodes.get('.personaDraftUseCase').value = 'Review releases independently.';
        nodes.get('.personaDraftName').listeners.input();
        assert.equal(nodes.get('.personaDraftCreate').disabled, false);
        nodes.get('.personaDraftCreate').listeners.click();
        assert.equal(posts.at(-1).type, 'personaDraftCreate');

        const uiDraft = {
          id: '12345678-1234-4123-8123-123456789abc',
          name: 'Rowan',
          useCase: 'Review releases independently.',
          revision: 1,
          currentCard: 0,
          answers: Object.fromEntries(KEYS.map((key) => [key, ''])),
        };
        handlers.get('personaDraftStatus')({ draft: uiDraft, cards: CARDS });
        assert.equal(nodes.get('.personaInterview').hidden, false);
        assert.match(nodes.get('.personaInterviewQuestion').textContent, /beyond the name/);
        assert.match(nodes.get('.personaInterviewExplanation').textContent, /name field identifies/);
        nodes.get('.personaInterviewAnswer').value = 'A stable identity answer.';
        nodes.get('.personaInterviewNext').listeners.click();
        assert.equal(posts.at(-1).type, 'personaDraftSave');
        assert.equal(posts.at(-1).payload.changes.currentCard, 1);
        assert.equal(posts.at(-1).payload.changes.answers.identity, 'A stable identity answer.');
        handlers.get('personaDraftResult')({ ok: false, conflict: true, error: 'stale draft' });
        assert.equal(nodes.get('.personaInterviewAnswer').value, 'A stable identity answer.');
        assert.equal(nodes.get('.personaInterviewDrafts').textContent, 'REOPEN SAVED DRAFT');
        nodes.get('.personaInterviewDrafts').listeners.click();
        assert.equal(posts.at(-1).type, 'personaDraftOpen');
        assert.equal(posts.at(-1).payload.id, uiDraft.id);

        const completedUiDraft = {
          ...uiDraft,
          revision: 5,
          currentCard: 5,
          answers: completeAnswers('UI complete'),
          preview: null,
        };
        handlers.get('personaDraftStatus')({
          draft: completedUiDraft,
          cards: CARDS,
          suggestedPersonaId: 'rowan',
        });
        nodes.get('.personaInterviewAnswer').value = completedUiDraft.answers.action_posture;
        nodes.get('.personaInterviewNext').listeners.click();
        assert.equal(posts.at(-1).type, 'personaDraftSave');
        assert.equal(posts.at(-1).payload.changes.currentCard, 5);

        const savedUiDraft = { ...completedUiDraft, revision: 6 };
        handlers.get('personaDraftStatus')({
          draft: savedUiDraft,
          cards: CARDS,
          suggestedPersonaId: 'rowan',
        });
        assert.equal(nodes.get('.personaPreviewSetup').hidden, false);
        assert.equal(nodes.get('.personaPreviewId').value, 'rowan');
        nodes.get('.personaPreviewMode').value = 'operator';
        nodes.get('.personaPreviewMode').listeners.change();
        for (const category of personaContract.ACTION_CATEGORIES) {
          const select = nodes.get('.personaAction-' + category);
          select.value = 'ask';
          select.listeners.change();
        }
        assert.equal(nodes.get('.personaPreviewGenerate').disabled, false);
        nodes.get('.personaPreviewGenerate').listeners.click();
        assert.equal(posts.at(-1).type, 'personaPreviewGenerate');
        assert.equal(posts.at(-1).payload.actions.delete_data, 'ask');

        const uiBundle = previewRenderer.renderBundle(savedUiDraft, previewChoices());
        const previewUiDraft = { ...savedUiDraft, revision: 7, preview: uiBundle };
        handlers.get('personaPreviewStatus')({ draft: previewUiDraft, bundle: uiBundle, stale: false });
        assert.equal(nodes.get('.personaPreviewReview').hidden, false);
        assert.match(nodes.get('.personaBlueprintPreview').textContent, /"canonical_hash"/);
        assert.match(nodes.get('.personaCanonicalPreview').value, /# Rowan/);
        nodes.get('.personaCanonicalPreview').value = uiBundle.canonical.replace('# Rowan', '# Rowan edited');
        nodes.get('.personaCanonicalPreview').listeners.input();
        assert.equal(nodes.get('.personaCanonicalSave').disabled, false);
        nodes.get('.personaCanonicalRestore').listeners.click();
        assert.equal(nodes.get('.personaCanonicalPreview').value, uiBundle.canonical);
        assert.equal(nodes.get('.personaCanonicalSave').disabled, true);
        nodes.get('.personaCanonicalPreview').value = uiBundle.canonical.replace('# Rowan', '# Rowan edited');
        nodes.get('.personaCanonicalPreview').listeners.input();
        nodes.get('.personaCanonicalSave').listeners.click();
        assert.equal(posts.at(-1).type, 'personaPreviewSaveCanonical');
        assert.equal(posts.at(-1).payload.expectedRevision, 7);

        const manualUiBundle = previewRenderer.withCanonicalEdit(uiBundle,
          uiBundle.canonical.replace('# Rowan', '# Rowan edited'));
        handlers.get('personaPreviewStatus')({
          draft: { ...previewUiDraft, revision: 8, preview: manualUiBundle },
          bundle: manualUiBundle,
          stale: false,
        });
        nodes.get('.personaPreviewRegenerateAll').listeners.click();
        assert.equal(posts.at(-1).type, 'personaPreviewGenerate');
        handlers.get('personaPreviewResult')({
          ok: false,
          needsConfirmation: true,
          error: 'Regeneration replaces manual work.',
        });
        assert.equal(nodes.get('.personaPreviewRegenerateAll').textContent, 'CONFIRM REGENERATE ALL');
        nodes.get('.personaPreviewRegenerateAll').listeners.click();
        assert.equal(posts.at(-1).payload.confirmedOverwrite, true);

        nodes.get('.personaWorkspaceChoose').listeners.click();
        assert.equal(posts.at(-1).type, 'personaWorkspaceChoose');
        assert.equal(nodes.get('.personaWorkspaceChoose').disabled, true);
      } finally {
        delete global.document;
        delete global.ApexBus;
        delete global.ApexShell;
      }
    });

    console.log(`PERSONA EXTENSION: ${passed}/31 passed`);
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
})().catch(() => { process.exitCode = 1; });
