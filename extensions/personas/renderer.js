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
  let deleteArmedId = null;

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
    draftBusy = false;
    draftConflict = false;
    interviewDrafts.textContent = 'DRAFTS';
    if (pendingDraftHome) {
      pendingDraftHome = false;
      ApexBus.post('personaDraftListGet', {});
      return;
    }
    const card = interviewCards[currentDraft.currentCard];
    if (!card) {
      interviewError.textContent = 'This draft points to an interview card that is unavailable.';
      return;
    }
    draftHome.hidden = true;
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

  ApexBus.on('personaWorkspaceStatus', renderWorkspace);
  ApexBus.on('personaFoundationStatus', renderFoundation);
  ApexBus.on('personaFoundationResult', renderFoundationResult);
  ApexBus.on('personaDraftList', renderDraftList);
  ApexBus.on('personaDraftStatus', renderDraftStatus);
  ApexBus.on('personaDraftResult', renderDraftResult);
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
  interviewNext.addEventListener('click', () =>
    saveInterview(Math.min(interviewCards.length - 1, currentDraft.currentCard + 1), false));
  interviewDrafts.addEventListener('click', () => {
    if (draftConflict) {
      draftConflict = false;
      ApexBus.post('personaDraftOpen', { id: currentDraft.id });
      return;
    }
    saveInterview(currentDraft.currentCard, true);
  });

  ApexShell.registerDockPane(pane, { order: 20 });
  ApexBus.post('personaWorkspaceGet', {});
})();
