// Apex — renderer bus shim. Exact-type routing over the preload bridge
// (J23 law); modules register verbs, unknown types log loudly.
'use strict';
window.ApexBus = (function () {
  // multi-handler per type — a Map of single fns silently last-wins'd when
  // two modules claimed one verb (the 'ready' clobber, 2026-07-12)
  const handlers = new Map();
  apex.bus.on((msg) => {
    const fns = handlers.get(msg && msg.type);
    if (fns && fns.length) fns.forEach((fn) => fn(msg));
    else console.warn('[bus] unhandled message type:', msg && msg.type);
  });
  return {
    on: (type, fn) => {
      if (!handlers.has(type)) handlers.set(type, []);
      handlers.get(type).push(fn);
    },
    post: (type, payload) => apex.bus.post(Object.assign({ type }, payload))
  };
})();

// Tiny shared toast — any module may speak to the operator without owning UI chrome.
window.ApexToast = (function () {
  let timer = null;
  return (text) => {
    const el = document.getElementById('toast');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(timer);
    timer = setTimeout(() => el.classList.remove('show'), 3200);
  };
})();

// main may toast directly (e.g. a refused hand-off names its reason)
ApexBus.on('toast', (m) => ApexToast(m.text));
