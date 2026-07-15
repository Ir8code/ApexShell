// Apex — demo monitor source. Plausible wandering values so the grid reads
// alive; per-pane sticky state. Ported from the extension unchanged in
// behavior. No actions — demo buttons just note themselves in the pane log.
'use strict';

const state = new Map();

const DEMO_ROWS = {
  radarr:  ['Dune Part Three', 'The Batman II', 'Mad Max: The Wasteland', 'Blade Runner 2099', 'Spirited Away 4K', 'Akira Remaster'],
  sonarr:  ['One Piece 1112', 'Frieren S2E08', 'Severance S3E01', 'The Expanse: Aftermath E04', 'Vinland Saga S3E11'],
  sab:     ['ubuntu-26.04-live.iso', 'one.piece.1112.1080p', 'frieren.s2e08.1080p', 'linux-6.16.tar.xz'],
  qbit:    ['debian-13.1-netinst', 'Big Buck Bunny 4K', 'arch-2026.07.01', 'LibreOffice 26.2'],
  generic: ['item alpha', 'item bravo', 'item charlie', 'item delta', 'item echo']
};

function tick(pane) {
  if (!state.has(pane.id)) state.set(pane.id, {});
  const st = state.get(pane.id);
  const data = {};
  for (const w of pane.widgets || []) {
    if (!w.bind) continue;
    switch (w.kind) {
      case 'gauge': {
        const max = w.max || 100;
        let v = st[w.bind] ?? max * (0.2 + Math.random() * 0.4);
        v = Math.min(max, Math.max(0, v + (Math.random() - 0.48) * max * 0.12));
        st[w.bind] = v;
        data[w.bind] = Math.round(v * 10) / 10;
        break;
      }
      case 'stat': {
        let v = st[w.bind] ?? Math.floor(Math.random() * 40);
        v = Math.max(0, v + Math.floor((Math.random() - 0.45) * 4));
        st[w.bind] = v;
        data[w.bind] = v;
        break;
      }
      case 'led': {
        const r = Math.random();
        const prev = st[w.bind] || 'good';
        data[w.bind] = st[w.bind] =
          r < 0.85 ? prev : r < 0.96 ? 'good' : r < 0.995 ? 'warning' : 'critical';
        break;
      }
      case 'list': {
        const pool = DEMO_ROWS[pane.id] || DEMO_ROWS.generic;
        const n = w.rows || 4;
        const start = Math.floor(Math.random() * Math.max(1, pool.length - n));
        data[w.bind] = pool.slice(start, start + n)
          .map((name) => ({ name, value: `${Math.floor(Math.random() * 90 + 5)}%` }));
        break;
      }
    }
  }
  return data;
}

function start(pane, ctx) {
  const fire = () => ctx.emit(tick(pane));
  fire();
  const t = setInterval(fire, Math.max(2, pane.refreshSecs || 10) * 1000);
  return () => clearInterval(t);
}

function action(pane, actionId, ctx) {
  ctx.log(`"${actionId}" is demo-only on this pane — live wiring awaits the go (R10).`);
}

module.exports = { start, action };
