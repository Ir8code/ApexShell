# Apex Shell Changelog

## Unreleased

- **The mobile face** (`mobile/` + `main/mobile.js`) — a slim phone-first
  second face on the same engine, served ONLY on your Tailscale tailnet
  (no interface = no server; never 0.0.0.0). Chat with streaming, permission
  cards (questions included), photo attachments (API image blocks) and
  any-file uploads (staged to `state/mobile-uploads/`, message carries the
  path), per-seat working dash + busy chips, VIEW drawer (the working view:
  images/text inline, html via an announcement-allowlisted route), AI drawer
  (usage trackers + model/effort/permissions/browser dials + end/close), a
  remembered active chat, self-reload on reconnect, and an update-glow logo
  that restarts the app (desktop safeGate mirrored: busy seats arm a
  tap-again warning). Installable as a home-screen app: web manifest +
  maskable icons; put real HTTPS on it with `tailscale serve` (the loopback
  twin listener is its door). Inbound frames pass a strict field-by-field
  whitelist — no PTY spawns, launch configs, or browser grants can originate
  from a phone. Mechanism walkthrough: `design/mobile-face-bones.md`.
  New dependency: `ws`.

- **New extension: Wiki Pipeline** (`extensions/wiki/`) — turn raw material into
  a durable, interlinked wiki. Intake is free (add entries to a derived queue,
  pure code); compile is the only token spend — a **tool-less** model seat reads
  one queued entry plus the current wiki and returns the page(s) to write, and
  the extension writes them (the model never touches disk). One entry at a time;
  an empty queue spawns nothing. Optional per-persona **compile voice** (bind any
  Persona Builder persona; no one else's personas needed). Dock pane: queue
  status, compile next/all/stop, add-entry, browse/search the wiki. Store is
  plain Markdown + JSON under the extension's state dir. Path-confined writes;
  headless drill 7/7. Cost guidance in `design/wiki-pipeline-cost.md`; deliberate
  v1 gaps (transcript-capture adapter, automatic reduce-first, analysis layer)
  are documented, not blockers.

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
