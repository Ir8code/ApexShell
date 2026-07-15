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
      '<p class="personaBuilderIntro">Choose one folder for the shared foundation, persona packages, and future wiki. Nothing is created until you approve a later build step.</p>' +
      '<section class="personaWorkspaceCard" aria-live="polite">' +
        '<div class="personaWorkspaceLabel">WORKSPACE</div>' +
        '<div class="personaWorkspaceState">Checking…</div>' +
        '<div class="personaWorkspacePath"></div>' +
        '<div class="personaWorkspaceChecks"></div>' +
      '</section>' +
      '<button class="personaWorkspaceChoose" type="button">CHOOSE WORKSPACE</button>' +
      '<p class="personaBuilderFoot">This setting stays on this Apex installation. Model, provider, credentials, and runtime permissions stay outside the personas you build.</p>' +
    '</div>' +
    '<div class="dockTab" data-tab="personas">PERSONAS</div>';

  const state = pane.querySelector('.personaWorkspaceState');
  const pathText = pane.querySelector('.personaWorkspacePath');
  const checks = pane.querySelector('.personaWorkspaceChecks');
  const choose = pane.querySelector('.personaWorkspaceChoose');
  let choosing = false;

  function setChoosing(value) {
    choosing = value;
    choose.disabled = value;
    choose.textContent = value ? 'CHOOSING…' : 'CHOOSE WORKSPACE';
  }

  function render(status) {
    setChoosing(false);
    pathText.textContent = status.workspace || 'No folder selected';
    if (status.error) {
      state.textContent = 'Needs attention';
      state.dataset.tone = 'warning';
      checks.textContent = status.error;
      return;
    }
    if (!status.configured) {
      state.textContent = status.workspace ? 'Folder is unavailable' : 'Not configured';
      state.dataset.tone = status.workspace ? 'warning' : 'quiet';
      checks.textContent = 'Choose an existing folder. Setup will add the portable structure in the next step.';
      return;
    }

    state.textContent = 'Ready for setup';
    state.dataset.tone = 'good';
    const foundation = status.foundationReady ? 'foundation found' : 'foundation not created';
    const personas = status.personasReady
      ? `${status.personaCount} persona package${status.personaCount === 1 ? '' : 's'}`
      : 'personas folder not created';
    checks.textContent = foundation + ' · ' + personas;
  }

  ApexBus.on('personaWorkspaceStatus', render);
  choose.addEventListener('click', () => {
    if (choosing) return;
    setChoosing(true);
    ApexBus.post('personaWorkspaceChoose', {});
  });

  ApexShell.registerDockPane(pane, { order: 20 });
  ApexBus.post('personaWorkspaceGet', {});
})();
