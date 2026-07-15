// Apex — stage background controls. The renderer only paints the main-owned
// setting; file picking and persistence stay behind the bus.
'use strict';
window.ApexBackground = (function () {
  let current = { path: '', fit: 'cover', dim: .42 };

  function normalize(state) {
    const dim = Number(state && state.dim);
    return {
      path: typeof (state && state.path) === 'string' ? state.path : '',
      fit: state && state.fit === 'contain' ? 'contain' : 'cover',
      dim: Number.isFinite(dim) ? Math.min(.85, Math.max(0, dim)) : .42
    };
  }

  function apexUrl(file) {
    return 'apex://local/' + encodeURIComponent(file);
  }

  function draw() {
    const stage = document.querySelector('.stage');
    const image = stage.querySelector('.stageBackground');
    const panel = document.getElementById('backgroundPanel');
    const name = panel.querySelector('.imageName');
    const fit = panel.querySelector('.backgroundFit');
    const dim = panel.querySelector('.backgroundDim');
    const value = panel.querySelector('.dimValue');
    const clear = panel.querySelector('.backgroundClear');

    stage.classList.toggle('has-background', !!current.path);
    image.style.backgroundImage = current.path ? 'url("' + apexUrl(current.path) + '")' : '';
    image.style.backgroundSize = current.fit;
    stage.style.setProperty('--stage-dim', String(current.dim));
    name.textContent = current.path ? current.path.split(/[\\/]/).pop() : 'No image selected';
    name.title = current.path;
    fit.value = current.fit;
    dim.value = String(Math.round(current.dim * 100));
    value.textContent = Math.round(current.dim * 100) + '%';
    clear.disabled = !current.path;
  }

  function postSettings() {
    const panel = document.getElementById('backgroundPanel');
    ApexBus.post('backgroundSet', {
      fit: panel.querySelector('.backgroundFit').value,
      dim: Number(panel.querySelector('.backgroundDim').value) / 100
    });
  }

  function buildPanel() {
    const panel = document.getElementById('backgroundPanel');
    panel.innerHTML =
      '<h3>STAGE BACKGROUND</h3>' +
      '<div class="note">The image stays behind the center stage. Dim keeps the wordmark ' +
      'and chat content readable.</div>' +
      '<div class="imageName"></div>' +
      '<div class="brow"><label for="backgroundFit">Fit</label>' +
      '<select id="backgroundFit" class="backgroundFit">' +
      '<option value="cover">Cover</option><option value="contain">Contain</option></select></div>' +
      '<div class="brow"><label for="backgroundDim">Dim</label>' +
      '<input id="backgroundDim" class="backgroundDim" type="range" min="0" max="85" step="1">' +
      '<span class="dimValue"></span></div>' +
      '<div class="bbtns"><button class="primary backgroundChoose" type="button">Choose image…</button>' +
      '<button class="backgroundClear" type="button">Clear</button>' +
      '<button class="backgroundClose" type="button">Close</button></div>';

    panel.querySelector('.backgroundChoose').addEventListener('click', () =>
      ApexBus.post('backgroundPick', {}));
    panel.querySelector('.backgroundClear').addEventListener('click', () =>
      ApexBus.post('backgroundClear', {}));
    panel.querySelector('.backgroundClose').addEventListener('click', close);
    panel.querySelector('.backgroundFit').addEventListener('change', postSettings);
    panel.querySelector('.backgroundDim').addEventListener('input', postSettings);
  }

  function wireMenu() {
    const menu = document.getElementById('appMenu');
    const trigger = document.getElementById('btnMenu');
    const background = document.getElementById('menuBackground');
    const items = () => [...menu.querySelectorAll('button[role="menuitem"]')];

    const syncMenuState = () => trigger.setAttribute('aria-expanded',
      menu.classList.contains('open') ? 'true' : 'false');
    new MutationObserver(syncMenuState).observe(menu, {
      attributes: true,
      attributeFilter: ['class']
    });
    syncMenuState();

    background.onclick = () => {
      menu.classList.remove('open');
      open();
    };

    document.addEventListener('keydown', (e) => {
      if (e.altKey && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        if (!menu.classList.contains('open')) trigger.click();
        setTimeout(() => {
          const first = items()[0];
          if (first) first.focus();
        }, 0);
        return;
      }

      if (e.key === 'Escape') {
        if (menu.classList.contains('open')) {
          menu.classList.remove('open');
          trigger.focus();
          return;
        }
        if (document.getElementById('backgroundPanel').classList.contains('open')) {
          close();
          trigger.focus();
        }
        return;
      }

      if (!menu.classList.contains('open') ||
          (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End'))
        return;

      e.preventDefault();
      const buttons = items();
      if (!buttons.length) return;
      let index = buttons.indexOf(document.activeElement);
      if (e.key === 'Home') index = 0;
      else if (e.key === 'End') index = buttons.length - 1;
      else {
        index += e.key === 'ArrowDown' ? 1 : -1;
        if (index < 0) index = buttons.length - 1;
        if (index >= buttons.length) index = 0;
      }
      buttons[index].focus();
    });
  }

  function open() {
    document.getElementById('backgroundPanel').classList.add('open');
    ApexBus.post('backgroundGet', {});
  }

  function close() {
    document.getElementById('backgroundPanel').classList.remove('open');
  }

  ApexBus.on('background', (m) => {
    current = normalize(m.background);
    draw();
  });

  return {
    boot() {
      buildPanel();
      wireMenu();
      ApexBus.post('backgroundGet', {});
    },
    open,
    close
  };
})();
