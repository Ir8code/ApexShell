# Apex Shell Changelog

## 0.1.1 — 2026-07-15

- **Fixed: the window's preload bridge was missing from the repository** —
  `preload.js` was never committed at the split, so every clone's renderer
  failed at boot (`ApexBus is not defined`). Caught by the renderer-error
  smoke while gating tonight's port.
- Markdown **tables** render in the chat feed (GFM subset — header + divider,
  alignment colons; cells reuse the existing escaped-inline chain).
- The chat reads as a **true central column**: the feed owns its scrollbar,
  and the tab row + shelf line match the chat column's width, measured live
  off the active composer.
- New **per-seat checklist pane** floating in the chat's right margin: the
  seat registers tasks/list items in a per-chat JSON file (path delivered
  in-band on the first turn) and the pane mirrors it live; the operator adds
  and edits entries in place, and panel edits notify the seat (deferred while
  it is mid-turn). Entries: task/item, title, delegate, status, notes; done
  items fade. Create menu opens from a ＋, closes on click-off or Escape.
- Left dock tabs **slide open** again instead of snapping (z-order raise ran
  after the state flip and cancelled the open transition).

## 0.1.0 — 2026-07-15

- Created the independent Apex Shell repository from the proven standalone app.
- Shipped built-in Viewer and Terminal dock tabs.
- Kept AI seats, PTY terminals, trackers, themes, backgrounds, and drop-in extensions.
- Removed all persona, pipeline-worker, lab-specific, credential, transcript, and operator-state coupling.
- Added the agent-led install contract and Windows launcher.
- Published the public GitHub repository at `Ir8code/ApexShell` while retaining
  the private Vault remote as the build machine's canonical upstream.
- Fixed web links being misread as Windows paths at the `s:/` inside `https://`;
  HTTP(S) targets are now fully visible, clickable, keyboard-accessible, and
  opened externally only after explicit user activation.
