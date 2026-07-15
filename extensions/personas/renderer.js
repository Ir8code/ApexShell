// Persona Builder — first-run workspace onboarding dock.
'use strict';
(function () {
  const pane = document.createElement('div');
  pane.className = 'sidePane dockPane personaBuilderPane';
  pane.id = 'dock-personas';
  pane.dataset.tab = 'personas';
  pane.dataset.order = '20';
  pane.innerHTML =
    '<div class="paneBody personaBuilderBody">' +
      '<div class="personaBuilderKicker">PERSONA BUILDER</div>' +
      '<h2>Give personas a home.</h2>' +
      '<p class="personaBuilderIntro">Choose one folder for the shared foundation, persona packages, and future wiki. The workspace stays portable and separate from model or provider settings.</p>' +
      '<section class="personaWorkspaceCard" aria-live="polite">' +
        '<div class="personaWorkspaceLabel">WORKSPACE</div>' +
        '<div class="personaWorkspaceState">Checking…</div>' +
        '<div class="personaWorkspacePath"></div>' +
        '<div class="personaWorkspaceChecks"></div>' +
      '</section>' +
      '<button class="personaWorkspaceChoose" type="button">CHOOSE WORKSPACE</button>' +
      '<section class="personaFoundationCard" aria-live="polite" hidden>' +
        '<div class="personaWorkspaceLabel">SHARED FOUNDATION</div>' +
        '<div class="personaFoundationState"></div>' +
        '<p class="personaFoundationHelp">Rules every persona inherits. Review the portable default or edit an existing foundation; nothing saves without this button.</p>' +
        '<textarea class="personaFoundationEditor" spellcheck="true" aria-label="Shared foundation rules"></textarea>' +
        '<button class="personaFoundationAction" type="button"></button>' +
        '<div class="personaFoundationConflict" hidden>' +
          '<button class="personaFoundationLoadDisk" type="button">LOAD DISK VERSION</button>' +
          '<button class="personaFoundationKeepEdit" type="button">KEEP MY EDIT</button>' +
        '</div>' +
      '</section>' +
      '<section class="personaDraftHome" hidden>' +
        '<div class="personaWorkspaceLabel">PERSONA DRAFTS</div>' +
        '<h3>Start with a name and a purpose.</h3>' +
        '<p class="personaDraftHelp">The name is the persona’s label. The six cards that follow define the deeper identity, role, style, boundaries, working method, and action posture.</p>' +
        '<label class="personaFieldLabel" for="personaDraftName">PERSONA NAME</label>' +
        '<input class="personaDraftName" id="personaDraftName" maxlength="80" placeholder="Example: Rowan" />' +
        '<label class="personaFieldLabel" for="personaDraftUseCase">ONE-SENTENCE USE CASE</label>' +
        '<textarea class="personaDraftUseCase" id="personaDraftUseCase" maxlength="240" placeholder="Example: Independently review code changes and return evidence-backed findings."></textarea>' +
        '<button class="personaDraftCreate" type="button" disabled>START INTERVIEW</button>' +
        '<div class="personaDraftResumeBlock">' +
          '<div class="personaDraftResumeLabel">RESUME A SAVED DRAFT</div>' +
          '<select class="personaDraftSelect" aria-label="Saved persona drafts"></select>' +
          '<button class="personaDraftResume" type="button">RESUME</button>' +
          '<button class="personaDraftDelete" type="button">DELETE DRAFT</button>' +
          '<div class="personaDraftWarnings"></div>' +
        '</div>' +
      '</section>' +
      '<section class="personaInterview" aria-live="polite" hidden>' +
        '<div class="personaInterviewTop"><span class="personaInterviewStep"></span><span class="personaInterviewName"></span></div>' +
        '<h3 class="personaInterviewTitle"></h3>' +
        '<div class="personaInterviewQuestion"></div>' +
        '<p class="personaInterviewExplanation"></p>' +
        '<div class="personaInterviewSubhead">A USEFUL ANSWER INCLUDES</div>' +
        '<ul class="personaInterviewInclude"></ul>' +
        '<div class="personaInterviewSubhead">THOUGHT-STARTERS</div>' +
        '<div class="personaInterviewSuggestions"></div>' +
        '<div class="personaInterviewSubhead">COMPLETE EXAMPLE</div>' +
        '<div class="personaInterviewExample"></div>' +
        '<label class="personaFieldLabel" for="personaInterviewAnswer">YOUR ANSWER</label>' +
        '<textarea class="personaInterviewAnswer" id="personaInterviewAnswer" maxlength="12000"></textarea>' +
        '<div class="personaInterviewHelp"></div>' +
        '<div class="personaInterviewError"></div>' +
        '<div class="personaInterviewActions">' +
          '<button class="personaInterviewDrafts" type="button">DRAFTS</button>' +
          '<button class="personaInterviewBack" type="button">BACK</button>' +
          '<button class="personaInterviewNext" type="button">SAVE &amp; NEXT</button>' +
        '</div>' +
      '</section>' +
      '<section class="personaPreviewSetup" aria-live="polite" hidden>' +
        '<div class="personaWorkspaceLabel">BLUEPRINT SETUP</div>' +
        '<h3>Make the structured choices explicit.</h3>' +
        '<p class="personaDraftHelp">The interview prose describes intent. These fields create the safe machine-readable contract; the builder will not guess permissions from prose.</p>' +
        '<label class="personaFieldLabel" for="personaPreviewId">PERSONA ID — LOWERCASE KEBAB-CASE</label>' +
        '<input class="personaPreviewId" id="personaPreviewId" maxlength="64" />' +
        '<label class="personaFieldLabel" for="personaPreviewMode">ACTION POSTURE</label>' +
        '<select class="personaPreviewMode" id="personaPreviewMode">' +
          '<option value="">Choose a posture</option><option value="advisor">Advisor</option>' +
          '<option value="assisted-operator">Assisted operator</option><option value="operator">Operator</option>' +
          '<option value="automated-worker">Automated worker</option>' +
        '</select>' +
        '<div class="personaActionHeading">FOR EACH CATEGORY: ALLOWED · ASK · BLOCKED</div>' +
        '<div class="personaActionGrid">' +
          '<label>Read files<select class="personaAction-read_files"><option value="">Choose</option><option>allowed</option><option>ask</option><option>blocked</option></select></label>' +
          '<label>Edit files<select class="personaAction-edit_files"><option value="">Choose</option><option>allowed</option><option>ask</option><option>blocked</option></select></label>' +
          '<label>Run commands<select class="personaAction-run_commands"><option value="">Choose</option><option>allowed</option><option>ask</option><option>blocked</option></select></label>' +
          '<label>Search web<select class="personaAction-search_web"><option value="">Choose</option><option>allowed</option><option>ask</option><option>blocked</option></select></label>' +
          '<label>Use connectors<select class="personaAction-use_connectors"><option value="">Choose</option><option>allowed</option><option>ask</option><option>blocked</option></select></label>' +
          '<label>Send externally<select class="personaAction-send_external"><option value="">Choose</option><option>allowed</option><option>ask</option><option>blocked</option></select></label>' +
          '<label>Change system<select class="personaAction-change_system"><option value="">Choose</option><option>allowed</option><option>ask</option><option>blocked</option></select></label>' +
          '<label>Delete data<select class="personaAction-delete_data"><option value="">Choose</option><option>allowed</option><option>ask</option><option>blocked</option></select></label>' +
        '</div>' +
        '<label class="personaCollaborationToggle"><input class="personaCollaborationEnabled" type="checkbox" /> ADD A COLLABORATION CONTRACT</label>' +
        '<div class="personaCollaborationEditor" hidden>' +
          '<p class="personaCollaborationHelp">Default access controls whether a teammate receives this persona’s handoff material read-only or may return edits; it is not public/private visibility. Capabilities are work this persona can provide, accepts are structured inputs it can consume, and emits are the artifacts it returns.</p>' +
          '<label class="personaFieldLabel" for="personaCollaborationAccess">DEFAULT HANDOFF ACCESS</label>' +
          '<select class="personaCollaborationAccess" id="personaCollaborationAccess"><option value="">Choose access</option><option value="read-only">Read-only</option><option value="read-write">Read-write</option></select>' +
          '<label class="personaFieldLabel" for="personaCapabilities">CAPABILITIES — ONE PER LINE</label><textarea class="personaCapabilities" id="personaCapabilities" maxlength="12000"></textarea>' +
          '<label class="personaFieldLabel" for="personaAccepts">ACCEPTS — ONE INPUT TYPE PER LINE</label><textarea class="personaAccepts" id="personaAccepts" maxlength="12000"></textarea>' +
          '<label class="personaFieldLabel" for="personaEmits">EMITS — ONE OUTPUT TYPE PER LINE</label><textarea class="personaEmits" id="personaEmits" maxlength="12000"></textarea>' +
        '</div>' +
        '<div class="personaPreviewError"></div>' +
        '<div class="personaInterviewActions"><button class="personaPreviewSetupBack" type="button">BACK TO INTERVIEW</button><button class="personaPreviewGenerate" type="button">GENERATE PREVIEW</button></div>' +
      '</section>' +
      '<section class="personaPreviewReview" aria-live="polite" hidden>' +
        '<div class="personaWorkspaceLabel">BLUEPRINT + CANONICAL REVIEW</div>' +
        '<div class="personaPreviewState"></div>' +
        '<div class="personaInterviewSubhead">BLUEPRINT.JSON</div>' +
        '<pre class="personaBlueprintPreview"></pre>' +
        '<div class="personaCollaborationPreviewWrap" hidden><div class="personaInterviewSubhead">COLLABORATION.JSON</div><pre class="personaCollaborationPreview"></pre></div>' +
        '<label class="personaFieldLabel" for="personaCanonicalPreview">AUTHORITATIVE CANONICAL MARKDOWN</label>' +
        '<textarea class="personaCanonicalPreview" id="personaCanonicalPreview"></textarea>' +
        '<div class="personaPreviewEditState"></div>' +
        '<button class="personaCanonicalSave" type="button">SAVE CANONICAL EDIT</button>' +
        '<button class="personaCanonicalRestore" type="button">RESTORE SAVED</button>' +
        '<div class="personaSectionRegen"><select class="personaSectionSelect"></select><button class="personaSectionRegenerate" type="button">REGENERATE SECTION</button></div>' +
        '<div class="personaPreviewError personaPreviewReviewError"></div>' +
        '<div class="personaInterviewActions"><button class="personaPreviewDrafts" type="button">DRAFTS</button><button class="personaPreviewBack" type="button">BACK TO INTERVIEW</button><button class="personaPreviewRegenerateAll" type="button">REGENERATE ALL</button></div>' +
      '</section>' +
      '<p class="personaBuilderFoot">This setting stays on this Apex installation. Model, provider, credentials, and runtime permissions stay outside the personas you build.</p>' +
    '</div>' +
    '<div class="dockTab" data-tab="personas">PERSONAS</div>';

  const state = pane.querySelector('.personaWorkspaceState');
  const pathText = pane.querySelector('.personaWorkspacePath');
  const checks = pane.querySelector('.personaWorkspaceChecks');
  const choose = pane.querySelector('.personaWorkspaceChoose');
  const foundationCard = pane.querySelector('.personaFoundationCard');
  const foundationState = pane.querySelector('.personaFoundationState');
  const foundationEditor = pane.querySelector('.personaFoundationEditor');
  const foundationAction = pane.querySelector('.personaFoundationAction');
  const foundationConflict = pane.querySelector('.personaFoundationConflict');
  const foundationLoadDisk = pane.querySelector('.personaFoundationLoadDisk');
  const foundationKeepEdit = pane.querySelector('.personaFoundationKeepEdit');
  const draftHome = pane.querySelector('.personaDraftHome');
  const draftName = pane.querySelector('.personaDraftName');
  const draftUseCase = pane.querySelector('.personaDraftUseCase');
  const draftCreate = pane.querySelector('.personaDraftCreate');
  const draftSelect = pane.querySelector('.personaDraftSelect');
  const draftResume = pane.querySelector('.personaDraftResume');
  const draftDelete = pane.querySelector('.personaDraftDelete');
  const draftWarnings = pane.querySelector('.personaDraftWarnings');
  const interview = pane.querySelector('.personaInterview');
  const interviewStep = pane.querySelector('.personaInterviewStep');
  const interviewName = pane.querySelector('.personaInterviewName');
  const interviewTitle = pane.querySelector('.personaInterviewTitle');
  const interviewQuestion = pane.querySelector('.personaInterviewQuestion');
  const interviewExplanation = pane.querySelector('.personaInterviewExplanation');
  const interviewInclude = pane.querySelector('.personaInterviewInclude');
  const interviewSuggestions = pane.querySelector('.personaInterviewSuggestions');
  const interviewExample = pane.querySelector('.personaInterviewExample');
  const interviewAnswer = pane.querySelector('.personaInterviewAnswer');
  const interviewHelp = pane.querySelector('.personaInterviewHelp');
  const interviewError = pane.querySelector('.personaInterviewError');
  const interviewDrafts = pane.querySelector('.personaInterviewDrafts');
  const interviewBack = pane.querySelector('.personaInterviewBack');
  const interviewNext = pane.querySelector('.personaInterviewNext');
  const previewSetup = pane.querySelector('.personaPreviewSetup');
  const previewId = pane.querySelector('.personaPreviewId');
  const previewMode = pane.querySelector('.personaPreviewMode');
  const previewSetupBack = pane.querySelector('.personaPreviewSetupBack');
  const previewGenerate = pane.querySelector('.personaPreviewGenerate');
  const previewError = pane.querySelector('.personaPreviewError');
  const previewReview = pane.querySelector('.personaPreviewReview');
  const previewState = pane.querySelector('.personaPreviewState');
  const blueprintPreview = pane.querySelector('.personaBlueprintPreview');
  const canonicalPreview = pane.querySelector('.personaCanonicalPreview');
  const previewEditState = pane.querySelector('.personaPreviewEditState');
  const canonicalSave = pane.querySelector('.personaCanonicalSave');
  const canonicalRestore = pane.querySelector('.personaCanonicalRestore');
  const sectionSelect = pane.querySelector('.personaSectionSelect');
  const sectionRegenerate = pane.querySelector('.personaSectionRegenerate');
  const previewReviewError = pane.querySelector('.personaPreviewReviewError');
  const previewDrafts = pane.querySelector('.personaPreviewDrafts');
  const previewBack = pane.querySelector('.personaPreviewBack');
  const previewRegenerateAll = pane.querySelector('.personaPreviewRegenerateAll');
  const actionCategories = ['read_files', 'edit_files', 'run_commands', 'search_web',
    'use_connectors', 'send_external', 'change_system', 'delete_data'];
  const actionSelects = Object.fromEntries(actionCategories.map((category) =>
    [category, pane.querySelector('.personaAction-' + category)]));
  const collaborationEnabled = pane.querySelector('.personaCollaborationEnabled');
  const collaborationEditor = pane.querySelector('.personaCollaborationEditor');
  const collaborationAccess = pane.querySelector('.personaCollaborationAccess');
  const collaborationCapabilities = pane.querySelector('.personaCapabilities');
  const collaborationAccepts = pane.querySelector('.personaAccepts');
  const collaborationEmits = pane.querySelector('.personaEmits');
  const collaborationPreviewWrap = pane.querySelector('.personaCollaborationPreviewWrap');
  const collaborationPreview = pane.querySelector('.personaCollaborationPreview');
  let choosing = false;
  let foundationBusy = false;
  let foundationExists = false;
  let foundationRevision = null;
  let foundationBaseline = '';
  let foundationWorkspace = null;
  let conflictDraft = null;
  let interviewCards = [];
  let currentDraft = null;
  let draftBusy = false;
  let draftConflict = false;
  let pendingDraftHome = false;
  let pendingPreviewSetup = false;
  let deleteArmedId = null;
  let suggestedPersonaId = '';
  let previewBundle = null;
  let previewBusy = false;
  let previewConfirmOverwrite = false;
  let canonicalDirty = false;

  function setChoosing(value) {
    choosing = value;
    choose.disabled = value;
    choose.textContent = value ? 'CHOOSING…' : 'CHOOSE WORKSPACE';
  }

  function renderWorkspace(status) {
    setChoosing(false);
    pathText.textContent = status.workspace || 'No folder selected';
    if (status.error) {
      foundationWorkspace = null;
      foundationCard.hidden = true;
      state.textContent = 'Needs attention';
      state.dataset.tone = 'warning';
      checks.textContent = status.error;
      return;
    }
    if (!status.configured) {
      foundationWorkspace = null;
      foundationCard.hidden = true;
      state.textContent = status.workspace ? 'Folder is unavailable' : 'Not configured';
      state.dataset.tone = status.workspace ? 'warning' : 'quiet';
      checks.textContent = 'Choose or create a folder. Setup will add the portable structure only after approval.';
      return;
    }

    state.textContent = 'Ready for setup';
    state.dataset.tone = 'good';
    const foundation = status.foundationReady ? 'foundation found' : 'foundation not created';
    const personas = status.personasReady
      ? `${status.personaCount} persona package${status.personaCount === 1 ? '' : 's'}`
      : 'personas folder not created';
    checks.textContent = foundation + ' · ' + personas;
    if (foundationWorkspace !== status.workspace) {
      foundationCard.hidden = true;
      ApexBus.post('personaFoundationGet', {});
    }
  }

  function updateFoundationAction() {
    foundationAction.textContent = foundationBusy
      ? (foundationExists ? 'SAVING…' : 'CREATING…')
      : (foundationExists ? 'SAVE FOUNDATION' : 'CREATE FOUNDATION');
    foundationAction.disabled = foundationBusy || !foundationEditor.value.trim() ||
      (foundationExists && foundationEditor.value === foundationBaseline);
    foundationEditor.disabled = foundationBusy;
  }

  function renderFoundation(status) {
    if (!status.workspace) {
      foundationCard.hidden = true;
      return;
    }
    foundationCard.hidden = false;
    foundationBusy = false;
    if (status.error) {
      foundationWorkspace = null;
      foundationState.textContent = 'Needs attention — ' + status.error;
      foundationState.dataset.tone = 'warning';
      foundationEditor.disabled = true;
      foundationAction.disabled = true;
      draftHome.hidden = true;
      interview.hidden = true;
      return;
    }

    const preservedDraft = conflictDraft;
    conflictDraft = null;
    foundationWorkspace = status.workspace;
    foundationExists = status.exists;
    foundationRevision = status.revision;
    foundationBaseline = status.content;
    foundationEditor.disabled = false;
    foundationEditor.value = preservedDraft === null ? status.content : preservedDraft;
    foundationConflict.hidden = true;
    if (preservedDraft !== null) {
      foundationState.textContent = 'Your edit is preserved against the latest disk revision. Review it, then Save again to intentionally replace the disk version.';
      foundationState.dataset.tone = 'warning';
    } else {
      foundationState.textContent = status.exists
        ? 'Existing foundation loaded. Edit only the rules shared by every persona.'
        : 'Portable default ready for review. Creation also adds an empty personas folder.';
      foundationState.dataset.tone = status.exists ? 'good' : 'quiet';
    }
    updateFoundationAction();
    if (status.exists) ApexBus.post('personaDraftListGet', {});
    else {
      draftHome.hidden = true;
      interview.hidden = true;
    }
  }

  function renderFoundationResult(result) {
    if (result.ok) return; // the following status message installs the saved revision
    foundationBusy = false;
    foundationState.textContent = 'Not saved — ' + result.error;
    foundationState.dataset.tone = 'warning';
    foundationConflict.hidden = !result.conflict;
    updateFoundationAction();
  }

  function setStarterState() {
    draftCreate.disabled = !draftName.value.trim() || !draftUseCase.value.trim();
  }

  function resetDeleteArm() {
    deleteArmedId = null;
    draftDelete.textContent = 'DELETE DRAFT';
  }

  function renderDraftList(message) {
    interviewCards = message.cards || interviewCards;
    interview.hidden = true;
    previewSetup.hidden = true;
    previewReview.hidden = true;
    draftHome.hidden = false;
    currentDraft = null;
    draftBusy = false;
    draftConflict = false;
    pendingDraftHome = false;
    resetDeleteArm();
    draftSelect.replaceChildren();
    for (const draft of message.drafts || []) {
      const option = document.createElement('option');
      option.value = draft.id;
      option.textContent = `${draft.name} — card ${draft.currentCard + 1} · ${draft.updatedAt}`;
      draftSelect.appendChild(option);
    }
    const hasDrafts = Boolean((message.drafts || []).length);
    draftSelect.hidden = !hasDrafts;
    draftResume.disabled = !hasDrafts;
    draftDelete.disabled = !hasDrafts;
    draftWarnings.textContent = message.error || (message.warnings || []).join(' · ');
    draftWarnings.dataset.tone = message.error ? 'warning' : 'quiet';
    setStarterState();
  }

  function fillList(element, items) {
    element.replaceChildren();
    for (const text of items || []) {
      const item = document.createElement('li');
      item.textContent = text;
      element.appendChild(item);
    }
  }

  function fillSuggestions(items) {
    interviewSuggestions.replaceChildren();
    for (const text of items || []) {
      const chip = document.createElement('span');
      chip.textContent = text;
      interviewSuggestions.appendChild(chip);
    }
  }

  function setInterviewBusy(value) {
    draftBusy = value;
    interviewAnswer.disabled = value;
    interviewDrafts.disabled = value;
    interviewBack.disabled = value || !currentDraft || currentDraft.currentCard === 0;
    interviewNext.disabled = value;
  }

  function renderDraftStatus(message) {
    currentDraft = message.draft;
    interviewCards = message.cards || interviewCards;
    suggestedPersonaId = message.suggestedPersonaId || suggestedPersonaId;
    draftBusy = false;
    draftConflict = false;
    interviewDrafts.textContent = 'DRAFTS';
    if (pendingDraftHome) {
      pendingDraftHome = false;
      ApexBus.post('personaDraftListGet', {});
      return;
    }
    if (pendingPreviewSetup) {
      pendingPreviewSetup = false;
      showPreviewSetup();
      return;
    }
    const card = interviewCards[currentDraft.currentCard];
    if (!card) {
      interviewError.textContent = 'This draft points to an interview card that is unavailable.';
      return;
    }
    draftHome.hidden = true;
    previewSetup.hidden = true;
    previewReview.hidden = true;
    interview.hidden = false;
    interviewStep.textContent = `CARD ${currentDraft.currentCard + 1} OF ${interviewCards.length}`;
    interviewName.textContent = currentDraft.name;
    interviewTitle.textContent = card.title;
    interviewQuestion.textContent = card.question;
    interviewExplanation.textContent = card.explanation;
    fillList(interviewInclude, card.include);
    fillSuggestions(card.suggestions);
    interviewExample.textContent = card.example;
    interviewAnswer.value = currentDraft.answers[card.key] || '';
    interviewHelp.textContent = 'HELP ME DECIDE — ' + card.help;
    interviewError.textContent = '';
    interviewNext.textContent = currentDraft.currentCard === interviewCards.length - 1
      ? 'SAVE DRAFT'
      : 'SAVE & NEXT';
    setInterviewBusy(false);
  }

  function saveInterview(targetCard, goHome) {
    if (!currentDraft || draftBusy) return;
    const card = interviewCards[currentDraft.currentCard];
    pendingDraftHome = Boolean(goHome);
    setInterviewBusy(true);
    ApexBus.post('personaDraftSave', {
      id: currentDraft.id,
      expectedRevision: currentDraft.revision,
      changes: {
        currentCard: targetCard,
        answers: { [card.key]: interviewAnswer.value },
      },
    });
  }

  function renderDraftResult(result) {
    if (result.ok) return; // create/save status or delete list follows
    draftBusy = false;
    pendingDraftHome = false;
    if (!interview.hidden && currentDraft) {
      draftConflict = Boolean(result.conflict);
      interviewError.textContent = 'Not saved — ' + result.error +
        (draftConflict ? ' Your current text is still here; reopening discards only this unsaved card.' : '');
      interviewDrafts.textContent = draftConflict ? 'REOPEN SAVED DRAFT' : 'DRAFTS';
      setInterviewBusy(false);
    } else {
      draftWarnings.textContent = result.error;
      draftWarnings.dataset.tone = 'warning';
      draftCreate.disabled = false;
    }
  }

  function previewChoices() {
    const lines = (value) => [...new Set(value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean))];
    return {
      personaId: previewId.value,
      mode: previewMode.value,
      actions: Object.fromEntries(actionCategories.map((category) =>
        [category, actionSelects[category].value])),
      collaboration: collaborationEnabled.checked ? {
        enabled: true,
        default_access: collaborationAccess.value,
        capabilities: lines(collaborationCapabilities.value),
        accepts: lines(collaborationAccepts.value),
        emits: lines(collaborationEmits.value),
      } : { enabled: false },
    };
  }

  function setPreviewSetupState() {
    const choices = previewChoices();
    previewGenerate.disabled = previewBusy || !choices.personaId || !choices.mode ||
      Object.values(choices.actions).some((value) => !value) ||
      (choices.collaboration.enabled && (!choices.collaboration.default_access ||
        !choices.collaboration.capabilities.length || !choices.collaboration.accepts.length ||
        !choices.collaboration.emits.length));
  }

  function showPreviewSetup() {
    interview.hidden = true;
    draftHome.hidden = true;
    previewReview.hidden = true;
    previewSetup.hidden = false;
    previewBusy = false;
    previewConfirmOverwrite = false;
    previewGenerate.textContent = 'GENERATE PREVIEW';
    previewError.textContent = '';
    const existing = currentDraft && currentDraft.preview;
    previewId.value = existing ? existing.personaId : suggestedPersonaId;
    previewMode.value = existing ? existing.blueprint.action_posture.mode : '';
    for (const category of actionCategories) {
      actionSelects[category].value = existing
        ? existing.blueprint.action_posture.actions[category]
        : '';
    }
    const collaboration = existing && existing.collaboration;
    collaborationEnabled.checked = Boolean(collaboration);
    collaborationEditor.hidden = !collaboration;
    collaborationAccess.value = collaboration ? collaboration.default_access : '';
    collaborationCapabilities.value = collaboration ? collaboration.capabilities.join('\n') : '';
    collaborationAccepts.value = collaboration ? collaboration.accepts.join('\n') : '';
    collaborationEmits.value = collaboration ? collaboration.emits.join('\n') : '';
    setPreviewSetupState();
  }

  function postPreviewGenerate(confirmedOverwrite) {
    if (!currentDraft || previewBusy) return;
    previewBusy = true;
    setPreviewSetupState();
    ApexBus.post('personaPreviewGenerate', {
      id: currentDraft.id,
      expectedRevision: currentDraft.revision,
      ...previewChoices(),
      confirmedOverwrite: Boolean(confirmedOverwrite),
    });
  }

  function renderPreviewStatus(message) {
    currentDraft = message.draft;
    previewBundle = message.bundle;
    previewBusy = false;
    previewConfirmOverwrite = false;
    draftHome.hidden = true;
    interview.hidden = true;
    previewSetup.hidden = true;
    previewReview.hidden = false;
    previewRegenerateAll.textContent = 'REGENERATE ALL';
    blueprintPreview.textContent = JSON.stringify(previewBundle.blueprint, null, 2);
    collaborationPreviewWrap.hidden = !previewBundle.collaboration;
    collaborationPreview.textContent = previewBundle.collaboration
      ? JSON.stringify(previewBundle.collaboration, null, 2)
      : '';
    canonicalPreview.value = previewBundle.canonical;
    canonicalDirty = false;
    previewState.textContent = message.stale
      ? 'Interview answers changed after this preview. Regenerate all to bring them in.'
      : 'Blueprint and canonical are generated from the saved interview.';
    previewState.dataset.tone = message.stale ? 'warning' : 'good';
    if (previewBundle.collaboration && previewBundle.collaboration.default_access === 'read-only') {
      const routineWrites = ['edit_files', 'send_external', 'change_system', 'delete_data']
        .filter((category) => previewBundle.blueprint.action_posture.actions[category] === 'allowed');
      if (routineWrites.length) {
        previewState.textContent += ' Warning: read-only collaboration conflicts with allowed write actions: ' + routineWrites.join(', ') + '.';
        previewState.dataset.tone = 'warning';
      }
    }
    previewEditState.textContent = previewBundle.canonicalDrift
      ? 'Manual canonical edits differ from the generated blueprint hash. They will never be overwritten silently.'
      : 'Canonical matches the generated blueprint hash.';
    previewEditState.dataset.tone = previewBundle.canonicalDrift ? 'warning' : 'good';
    canonicalSave.disabled = true;
    previewReviewError.textContent = '';
    sectionSelect.replaceChildren();
    for (const card of interviewCards) {
      const option = document.createElement('option');
      option.value = card.key;
      option.textContent = card.title;
      sectionSelect.appendChild(option);
    }
  }

  function renderPreviewResult(result) {
    if (result.ok) return; // preview status follows every successful mutation
    previewBusy = false;
    if (result.needsConfirmation) {
      previewConfirmOverwrite = true;
      const target = previewReview.hidden ? previewGenerate : previewRegenerateAll;
      target.textContent = 'CONFIRM REGENERATE ALL';
      target.disabled = false;
      const errorTarget = previewReview.hidden ? previewError : previewReviewError;
      errorTarget.textContent = result.error;
      return;
    }
    const errorTarget = previewReview.hidden ? previewError : previewReviewError;
    errorTarget.textContent = result.error;
    setPreviewSetupState();
    canonicalSave.disabled = canonicalPreview.value === (previewBundle && previewBundle.canonical);
  }

  ApexBus.on('personaWorkspaceStatus', renderWorkspace);
  ApexBus.on('personaFoundationStatus', renderFoundation);
  ApexBus.on('personaFoundationResult', renderFoundationResult);
  ApexBus.on('personaDraftList', renderDraftList);
  ApexBus.on('personaDraftStatus', renderDraftStatus);
  ApexBus.on('personaDraftResult', renderDraftResult);
  ApexBus.on('personaPreviewStatus', renderPreviewStatus);
  ApexBus.on('personaPreviewResult', renderPreviewResult);
  choose.addEventListener('click', () => {
    if (choosing) return;
    setChoosing(true);
    ApexBus.post('personaWorkspaceChoose', {});
  });
  foundationEditor.addEventListener('input', updateFoundationAction);
  foundationLoadDisk.addEventListener('click', () => {
    foundationConflict.hidden = true;
    conflictDraft = null;
    ApexBus.post('personaFoundationGet', {});
  });
  foundationKeepEdit.addEventListener('click', () => {
    foundationConflict.hidden = true;
    conflictDraft = foundationEditor.value;
    ApexBus.post('personaFoundationGet', {});
  });
  foundationAction.addEventListener('click', () => {
    if (foundationBusy || foundationAction.disabled) return;
    foundationBusy = true;
    updateFoundationAction();
    if (foundationExists) {
      ApexBus.post('personaFoundationSave', {
        content: foundationEditor.value,
        expectedRevision: foundationRevision,
      });
    } else {
      ApexBus.post('personaFoundationCreate', { content: foundationEditor.value });
    }
  });
  draftName.addEventListener('input', setStarterState);
  draftUseCase.addEventListener('input', setStarterState);
  draftCreate.addEventListener('click', () => {
    if (draftCreate.disabled) return;
    draftCreate.disabled = true;
    ApexBus.post('personaDraftCreate', {
      name: draftName.value,
      useCase: draftUseCase.value,
    });
  });
  draftSelect.addEventListener('change', resetDeleteArm);
  draftResume.addEventListener('click', () => {
    resetDeleteArm();
    if (draftSelect.value) ApexBus.post('personaDraftOpen', { id: draftSelect.value });
  });
  draftDelete.addEventListener('click', () => {
    if (!draftSelect.value) return;
    if (deleteArmedId !== draftSelect.value) {
      deleteArmedId = draftSelect.value;
      draftDelete.textContent = 'CONFIRM DELETE';
      return;
    }
    ApexBus.post('personaDraftDelete', { id: draftSelect.value, confirmed: true });
    resetDeleteArm();
  });
  interviewBack.addEventListener('click', () =>
    saveInterview(Math.max(0, currentDraft.currentCard - 1), false));
  interviewNext.addEventListener('click', () => {
    const last = currentDraft.currentCard === interviewCards.length - 1;
    pendingPreviewSetup = last;
    saveInterview(last ? currentDraft.currentCard : currentDraft.currentCard + 1, false);
  });
  interviewDrafts.addEventListener('click', () => {
    if (draftConflict) {
      draftConflict = false;
      ApexBus.post('personaDraftOpen', { id: currentDraft.id });
      return;
    }
    saveInterview(currentDraft.currentCard, true);
  });
  previewId.addEventListener('input', () => {
    previewConfirmOverwrite = false;
    previewGenerate.textContent = 'GENERATE PREVIEW';
    setPreviewSetupState();
  });
  previewMode.addEventListener('change', setPreviewSetupState);
  for (const select of Object.values(actionSelects))
    select.addEventListener('change', setPreviewSetupState);
  collaborationEnabled.addEventListener('change', () => {
    collaborationEditor.hidden = !collaborationEnabled.checked;
    setPreviewSetupState();
  });
  collaborationAccess.addEventListener('change', setPreviewSetupState);
  collaborationCapabilities.addEventListener('input', setPreviewSetupState);
  collaborationAccepts.addEventListener('input', setPreviewSetupState);
  collaborationEmits.addEventListener('input', setPreviewSetupState);
  previewSetupBack.addEventListener('click', () =>
    renderDraftStatus({ draft: currentDraft, cards: interviewCards, suggestedPersonaId }));
  previewGenerate.addEventListener('click', () => {
    if (previewGenerate.disabled) return;
    postPreviewGenerate(previewConfirmOverwrite);
  });
  canonicalPreview.addEventListener('input', () => {
    canonicalDirty = canonicalPreview.value !== previewBundle.canonical;
    canonicalSave.disabled = !canonicalDirty;
    previewEditState.textContent = canonicalDirty
      ? 'Unsaved canonical edit. Save it before leaving or regenerating.'
      : (previewBundle.canonicalDrift
        ? 'Manual canonical edits differ from the generated blueprint hash.'
        : 'Canonical matches the generated blueprint hash.');
    previewEditState.dataset.tone = canonicalDirty || previewBundle.canonicalDrift ? 'warning' : 'good';
  });
  canonicalSave.addEventListener('click', () => {
    if (!canonicalDirty || canonicalSave.disabled) return;
    canonicalSave.disabled = true;
    ApexBus.post('personaPreviewSaveCanonical', {
      id: currentDraft.id,
      expectedRevision: currentDraft.revision,
      canonical: canonicalPreview.value,
    });
  });
  canonicalRestore.addEventListener('click', () => {
    canonicalPreview.value = previewBundle.canonical;
    canonicalDirty = false;
    canonicalSave.disabled = true;
    previewEditState.textContent = previewBundle.canonicalDrift
      ? 'Manual canonical edits differ from the generated blueprint hash.'
      : 'Canonical matches the generated blueprint hash.';
    previewEditState.dataset.tone = previewBundle.canonicalDrift ? 'warning' : 'good';
    previewReviewError.textContent = '';
  });
  sectionRegenerate.addEventListener('click', () => {
    if (canonicalDirty) {
      previewReviewError.textContent = 'Save or discard the current canonical edit before regenerating a section.';
      return;
    }
    ApexBus.post('personaPreviewRegenerateSection', {
      id: currentDraft.id,
      expectedRevision: currentDraft.revision,
      key: sectionSelect.value,
    });
  });
  previewRegenerateAll.addEventListener('click', () => {
    if (canonicalDirty) {
      previewReviewError.textContent = 'Save or discard the current canonical edit before regenerating everything.';
      return;
    }
    postPreviewGenerate(previewConfirmOverwrite);
  });
  previewBack.addEventListener('click', () => {
    if (canonicalDirty) {
      previewReviewError.textContent = 'Save or discard the current canonical edit before returning to the interview.';
      return;
    }
    renderDraftStatus({ draft: currentDraft, cards: interviewCards, suggestedPersonaId });
  });
  previewDrafts.addEventListener('click', () => {
    if (canonicalDirty) {
      previewReviewError.textContent = 'Save or discard the current canonical edit before leaving the preview.';
      return;
    }
    ApexBus.post('personaDraftListGet', {});
  });

  ApexShell.registerDockPane(pane, { order: 20 });
  ApexBus.post('personaWorkspaceGet', {});
})();
