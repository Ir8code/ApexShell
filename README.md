# Apex Shell — the one window

A standalone Electron shell for living with AI assistants and your own
trackers. Three blinds around a stage:

- **TOP — the Tracker.** A pull-down blind of monitor panes. A pane is
  anything you can poll: a server, a download queue, a YouTube channel, an
  email inbox. Panes are config (`main/monitors/panes.json`); sources are
  tiny modules you can write yourself.
- **LEFT — the Dock.** Folder tabs. VIEWER renders images/HTML any chat seat
  reads or writes; TERMINAL opens a real shell in the configured workspace.
  Both ship built-in, and extensions add their own tabs after them.
- **RIGHT — the AI bar.** A session launcher/manager: spawn chat seats on
  your own subscriptions (Claude, Codex), local models (Ollama), or any
  terminal CLI in a real PTY. Per-seat dials (model / effort / permissions),
  live usage bars, chat history with resume, End-Session wrap.

Two dependencies (`electron`, `node-pty`). Plain JS, no bundler, no build
step. Everything vendor-shaped plugs in through `extensions/` — the bare
shell assumes nothing about your machine.

## Install

**The intended way:** clone this repo, open any agentic CLI you already use
(Claude Code, Codex, …) in the repo folder, and say:

> Install this. Start with INSTALL.md.

The repo carries its own map (`floorplan.md`) and per-vendor connection
guides (`connect/`) — your assistant reads those, builds the app, wires in
whatever subscriptions and local models exist on your machine, and manages
it from then on.

**By hand:** `npm install`, then `npx electron .` — and read `INSTALL.md`
yourself; it's written to be followed by a person too.

## Make it yours

- Trackers: copy `main/monitors/panes.sample.json` → `panes.json`, add panes.
- Seats: the `+` button is a blank seat; named one-click seats (with launch
  prompts and their own working folder) are extension data — see
  `floorplan.md` § Extensions.
- Terminal: pull the TERMINAL tab; it starts lazily, stays alive while
  collapsed, and NEW replaces it with a clean shell.
- Tabs: extensions register more dock panes; the bundled `extensions/`
  folder shows worked examples.
- Theme: ☰ → Theme. Presets included; everything is a CSS token.

Tested on Windows 11. Electron and node-pty are cross-platform; macOS/Linux
should work but are unproven — expect small platform edges (see INSTALL.md).
