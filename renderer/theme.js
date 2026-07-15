// Apex — theme module (renderer). Applies tokens as CSS custom properties and
// owns the Theme panel. Independence: nothing else knows colors exist; a token
// change repaints every module through the cascade, zero code touched.
'use strict';
window.ApexTheme = (function () {
  const META = [
    ['bg', 'Background'],
    ['surface', 'Surface / bars'],
    ['edge', 'Borders'],
    ['scroll', 'Scrollbars'],
    ['text', 'Text'],
    ['dim', 'Muted text'],
    ['faint', 'Hints'],
    ['accent', 'Accent'],
    ['good', 'Status — good'],
    ['warning', 'Status — warning'],
    ['critical', 'Status — critical']
  ];
  let current = {};
  let presets = {};
  let selected = '';

  function apply(tokens) {
    current = Object.assign({}, tokens);
    for (const [k, v] of Object.entries(tokens))
      document.documentElement.style.setProperty('--' + k, v);
  }

  function updatePresetControls() {
    const panel = document.getElementById('themePanel');
    const select = panel.querySelector('.presetSelect');
    const remove = panel.querySelector('.presetDelete');
    if (!select || !remove) return;

    select.textContent = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Saved themes…';
    select.appendChild(placeholder);

    for (const name of Object.keys(presets).sort((a, b) => a.localeCompare(b))) {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      select.appendChild(option);
    }
    select.value = Object.prototype.hasOwnProperty.call(presets, selected) ? selected : '';
    remove.disabled = !select.value;
  }

  function buildPanel() {
    const panel = document.getElementById('themePanel');
    panel.innerHTML = '<h3>THEME</h3>' +
      '<div class="note">Colors apply live as you pick. Save current keeps this palette; ' +
      'Save as creates a named preset.</div>' +
      '<div class="presetRow"><select class="presetSelect" aria-label="Saved themes"></select>' +
      '<button class="presetDelete" type="button">Delete</button></div>';

    const select = panel.querySelector('.presetSelect');
    const remove = panel.querySelector('.presetDelete');
    select.addEventListener('change', () => {
      selected = select.value;
      remove.disabled = !selected;
      if (selected) ApexBus.post('themePresetApply', { name: selected });
    });
    remove.addEventListener('click', () => {
      if (selected) ApexBus.post('themePresetDelete', { name: selected });
    });

    for (const [key, label] of META) {
      const row = document.createElement('div');
      row.className = 'trow';
      const lab = document.createElement('label');
      lab.textContent = label;
      const hex = document.createElement('span');
      hex.className = 'hex';
      const inp = document.createElement('input');
      inp.type = 'color';
      inp.dataset.token = key;
      inp.addEventListener('input', () => {
        hex.textContent = inp.value;
        document.documentElement.style.setProperty('--' + key, inp.value);
        current[key] = inp.value;
        selected = '';
        updatePresetControls();
      });
      row.appendChild(lab); row.appendChild(hex); row.appendChild(inp);
      panel.appendChild(row);
    }

    const saves = document.createElement('div');
    saves.className = 'tbtns';
    const save = document.createElement('button');
    save.className = 'primary';
    save.textContent = 'Save current';
    save.addEventListener('click', () => {
      ApexBus.post('themeSet', { tokens: current });
      ApexToast('Theme saved');
      panel.classList.remove('open');
    });
    // Save-as name entry is an INLINE row — window.prompt() does not exist in
    // Electron renderers (throws, unsupported by design), which is why Save as…
    // silently did nothing (the operator, 2026-07-13; J49's never-click-tested leg).
    const saveAs = document.createElement('button');
    saveAs.textContent = 'Save as…';
    const nameRow = document.createElement('div');
    nameRow.className = 'tnameRow';
    nameRow.hidden = true;
    const nameInp = document.createElement('input');
    nameInp.type = 'text';
    nameInp.maxLength = 48;
    nameInp.placeholder = 'theme name';
    const nameOk = document.createElement('button');
    nameOk.className = 'primary';
    nameOk.textContent = 'Save';
    const nameNo = document.createElement('button');
    nameNo.textContent = 'Cancel';
    const commitName = () => {
      const name = nameInp.value.trim();
      if (!name) { nameInp.focus(); return; }
      ApexBus.post('themePresetSave', { name, tokens: current });
      nameRow.hidden = true;
    };
    saveAs.addEventListener('click', () => {
      nameRow.hidden = false;
      nameInp.value = selected || '';
      nameInp.focus();
      nameInp.select();
    });
    nameOk.addEventListener('click', commitName);
    nameNo.addEventListener('click', () => { nameRow.hidden = true; });
    nameInp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') commitName();
      if (e.key === 'Escape') nameRow.hidden = true;
    });
    nameRow.appendChild(nameInp); nameRow.appendChild(nameOk); nameRow.appendChild(nameNo);
    saves.appendChild(save); saves.appendChild(saveAs);
    panel.appendChild(saves);
    panel.appendChild(nameRow);

    const maintenance = document.createElement('div');
    maintenance.className = 'tbtns';
    const reset = document.createElement('button');
    reset.textContent = 'Defaults';
    reset.addEventListener('click', () => ApexBus.post('themeReset', {}));
    const close = document.createElement('button');
    close.textContent = 'Close';
    close.addEventListener('click', () => {
      ApexBus.post('themeGet', {});
      panel.classList.remove('open');
    });
    maintenance.appendChild(reset); maintenance.appendChild(close);
    panel.appendChild(maintenance);
  }

  function fillPanel() {
    const panel = document.getElementById('themePanel');
    panel.querySelectorAll('input[type="color"]').forEach((inp) => {
      const v = current[inp.dataset.token] || '#000000';
      inp.value = v;
      inp.previousElementSibling.textContent = v;
    });
    updatePresetControls();
  }

  ApexBus.on('theme', (m) => {
    presets = m.presets || {};
    selected = m.selected || '';
    apply(m.tokens);
    fillPanel();
  });

  return {
    boot() { buildPanel(); ApexBus.post('themeGet', {}); },
    open() { fillPanel(); document.getElementById('themePanel').classList.add('open'); }
  };
})();
