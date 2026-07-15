// Apex - the built-in TERMINAL dock tab. The renderer owns xterm only; main
// owns the live shell and a bounded replay buffer across renderer Reloads.
'use strict';
(function () {
  const pane = document.getElementById('dock-terminal');
  const mount = pane.querySelector('.termMount');
  const name = pane.querySelector('.tdName');
  const status = pane.querySelector('.tdStatus');
  const fresh = pane.querySelector('.tdNew');
  const cs = getComputedStyle(document.documentElement);
  const v = (n) => cs.getPropertyValue('--' + n).trim() || '#888';
  let attached = false;
  let alive = false;

  const term = ApexTermView({
    container: mount,
    seatId: 'dock-terminal',
    post: (m) => {
      if (m.type === 'seatPtyInput') ApexBus.post('terminalInput', { data: m.data });
      else if (m.type === 'seatPtyResize')
        ApexBus.post('terminalResize', { cols: m.cols, rows: m.rows });
    },
    themeVars: { bg: v('bg'), surface: v('surface'), edge: v('edge'), text: v('text'),
                 dim: v('dim'), faint: v('faint'), accent: v('accent'), good: v('good'),
                 warning: v('warning'), critical: v('critical') },
  });

  function attach() {
    if (!attached) {
      attached = true;
      status.textContent = 'starting...';
      ApexBus.post('terminalAttach', {});
    }
    setTimeout(() => { term.fit(); term.focus(); }, 80);
  }

  fresh.onclick = () => {
    attached = true;
    status.textContent = 'starting...';
    ApexBus.post('terminalRestart', {});
    setTimeout(() => { term.fit(); term.focus(); }, 80);
  };
  mount.addEventListener('mousedown', () => setTimeout(() => term.focus(), 0));

  ApexBus.on('terminalReset', () => { term.reset(); term.setLive(); });
  ApexBus.on('terminalData', (m) => term.write(m.data || ''));
  ApexBus.on('terminalState', (m) => {
    alive = !!m.alive;
    name.textContent = m.title || 'Terminal';
    name.title = m.cwd || '';
    status.textContent = alive ? 'live' : 'exited';
    if (alive) term.setLive(); else term.setDead();
  });

  new MutationObserver(() => {
    if (pane.classList.contains('open')) attach();
  }).observe(pane, { attributes: true, attributeFilter: ['class'] });

  window.ApexTerminalDock = { activeCount: () => alive ? 1 : 0 };
})();
