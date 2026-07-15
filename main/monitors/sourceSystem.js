// Apex — system monitor source (base-install tracker, 2026-07-15). Surface-
// level machine stats only — the Task-Manager class of data, gathered with
// Node's own os/fs APIs. Zero permissions, zero config, works on any machine:
// no packet inspection, no elevation, no credentials, nothing leaves the box.
//
// Emits every tick (widgets bind what they want):
//   status   led    good / warning / critical (worst of cpu, mem, disk)
//   cpu      gauge  0–100 CPU busy % (os.cpus() time deltas between ticks)
//   mem      gauge  0–100 memory used %
//   memText  stat   "11.2 / 32 GB"
//   disk     gauge  0–100 disk used % (source.disk path, default the OS drive)
//   diskText stat   "412 GB free of 931"
//   uptime   stat   "3d 4h"
//   host     stat   machine name
'use strict';

const os = require('os');
const fs = require('fs');

const GB = 1024 ** 3;
const fmtGB = (b) => (b / GB) >= 100 ? Math.round(b / GB) + '' : (b / GB).toFixed(1);

function cpuTimes() {
  let idle = 0, total = 0;
  for (const c of os.cpus()) {
    for (const k of Object.keys(c.times)) total += c.times[k];
    idle += c.times.idle;
  }
  return { idle, total };
}

function fmtUptime(secs) {
  const d = Math.floor(secs / 86400), h = Math.floor((secs % 86400) / 3600),
        m = Math.floor((secs % 3600) / 60);
  return d ? d + 'd ' + h + 'h' : h ? h + 'h ' + m + 'm' : m + 'm';
}

function sev(cpu, mem, disk) {
  if (cpu >= 90 || mem >= 92 || disk >= 95) return 'critical';
  if (cpu >= 75 || mem >= 85 || disk >= 90) return 'warning';
  return 'good';
}

function start(pane, ctx) {
  const diskPath = (pane.source && pane.source.disk) ||
    (process.platform === 'win32' ? (process.env.SystemDrive || 'C:') + '\\' : '/');
  let prev = cpuTimes();

  const fire = () => {
    const now = cpuTimes();
    const dTotal = now.total - prev.total, dIdle = now.idle - prev.idle;
    prev = now;
    const cpu = dTotal > 0 ? Math.round((1 - dIdle / dTotal) * 100) : 0;

    const total = os.totalmem(), free = os.freemem();
    const mem = Math.round(((total - free) / total) * 100);

    let disk = 0, diskText = 'n/a';
    try {
      // statfsSync: plain filesystem metadata — the same number Explorer shows
      const s = fs.statfsSync(diskPath);
      const dTot = s.blocks * s.bsize, dFree = s.bavail * s.bsize;
      disk = dTot > 0 ? Math.round(((dTot - dFree) / dTot) * 100) : 0;
      diskText = fmtGB(dFree) + ' GB free of ' + fmtGB(dTot);
    } catch { /* exotic fs — gauge stays 0, text says n/a */ }

    ctx.emit({
      status: sev(cpu, mem, disk),
      cpu, mem, disk,
      memText: fmtGB(total - free) + ' / ' + fmtGB(total) + ' GB',
      diskText,
      uptime: fmtUptime(os.uptime()),
      host: os.hostname(),
    });
  };

  fire();
  const t = setInterval(fire, Math.max(2, pane.refreshSecs || 5) * 1000);
  return () => clearInterval(t);
}

function action(pane, actionId, ctx) {
  ctx.log('system source has no actions — it only reads local stats');
}

module.exports = { start, action };
