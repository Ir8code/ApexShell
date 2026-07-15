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
  let choosing = false;
  let foundationBusy = false;
  let foundationExists = false;
  let foundationRevision = null;
  let foundationBaseline = '';
  let foundationWorkspace = null;
  let conflictDraft = null;

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
  }

  function renderFoundationResult(result) {
    if (result.ok) return; // the following status message installs the saved revision
    foundationBusy = false;
    foundationState.textContent = 'Not saved — ' + result.error;
    foundationState.dataset.tone = 'warning';
    foundationConflict.hidden = !result.conflict;
    updateFoundationAction();
  }

  ApexBus.on('personaWorkspaceStatus', renderWorkspace);
  ApexBus.on('personaFoundationStatus', renderFoundation);
  ApexBus.on('personaFoundationResult', renderFoundationResult);
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

  ApexShell.registerDockPane(pane, { order: 20 });
  ApexBus.post('personaWorkspaceGet', {});
})();
