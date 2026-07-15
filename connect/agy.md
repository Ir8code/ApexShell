# connect/agy — the Antigravity/Gemini terminal lane

`agy` (the Antigravity CLI) rides a Google AI subscription via an
interactive keyring sign-in. It is a PTY-ONLY tenant — read the trap first.

## THE trap (verified, Google issue #76)

**`agy` emits NOTHING when spawned without a TTY** — piped/headless
invocations hang silently with zero output (even `agy models`). Never
spawn it from a non-interactive tool call, never pipe into it, never
script it headless. The shell's ConPTY lane exists exactly for this.

## Detect / set up

`agy --version` in a real terminal. First run signs in interactively
(keyring-backed). If the machine has no agy, skip this lane.

## What the shell does

Two ways in, both PTY:

- `+` → TERMINALS → "agy — Gemini terminal": plain spawn.
- Blank seat with the model dial set to `agy`: spawns with the permissions
  dial mapped to agy's OWN verified flags — `manual` = ask in-terminal
  (agy's default), `acceptEdits` = `--mode accept-edits`,
  `bypassPermissions` = `--dangerously-skip-permissions`. There is no live
  switch (launch-time only) and no `auto` equivalent (that option greys
  out). No effort lever either.

## Records

agy's native session store is protobuf — effectively unreadable. The
shell's PTY byte-tee (`state/transcripts/<id>.pty.log`) IS the durable
record of an agy session. Usage tracking counts daily turns from those
captures; there is no provider usage endpoint for this lane.
