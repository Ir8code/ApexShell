# connect/codex — the OpenAI Codex lane

Codex is a FIRST-CLASS chat lane (R33): setting any seat's model dial to
`codex` — blank or preset — opens an OWNED clean-view seat, same treatment
as Claude: streamed replies, this app's permission cards, resume from
history, End-Session wrap. Preset seats send their kickoff as the first
turn. The raw TUI stays available under `+` → TERMINALS as the escape hatch.

## How the owned seat works (engine/codexSeat.js)

Spawns `codex app-server` and speaks its JSON-RPC protocol (built against
the CLI's own generated schema + live wire captures — `codex app-server
generate-json-schema --out <dir>` reproduces the ground truth):
`initialize` → `thread/start`/`thread/resume` → `turn/start`; streamed
`item/agentMessage/delta`s; approvals arrive as server→client requests
(`item/commandExecution/requestApproval` etc.) and this app's Allow/Deny
cards answer them (`accept` / `acceptForSession` / `decline`). Resume
replays history via `thread/read {includeTurns:true}`. Session ids are
namespaced `codex:<threadId>` in chat history.

The approval card mirrors each request's wire-provided `availableDecisions`.
When Codex offers `acceptForSession` or `acceptWithExecpolicyAmendment`, Apex
shows the matching **Allow for session** / **Always allow** button and returns
that exact provider-owned decision. The engine retains the decision object;
the renderer receives only an opaque choice id and cannot invent a grant.
Fresh threads are not replayed before their first message; both verified
pre-materialization responses (`not materialized yet`, empty rollout) are
treated as an empty replay rather than mislabeled as a Codex refusal.

Containment truth (wire-proven on Windows): the requested sandbox clamps to
`readOnly` regardless — an ACCEPTED APPROVAL is what executes a command, so
the permission cards are the real boundary. Dial mapping: manual →
approvalPolicy `untrusted`; acceptEdits → `on-request`; bypass → `never` +
`danger-full-access`. Model dial carries the plan's TIERS — sol / terra /
luna (`model/list` wire truth, 2026-07-14: gpt-5.6-sol frontier default,
-terra balanced, -luna fast) — and switches LIVE: `turn/start` takes `model`
per turn, so the change applies from the next turn, no restart. Effort maps
low/medium/high/xhigh/max straight through (all three models advertise the
full ladder now — the old clamp-to-high is retired; sol/terra also advertise
`ultra`, which the dial doesn't carry) and changes via the same
seamless-restart path Claude uses. ⚠ app-server is flagged EXPERIMENTAL by
OpenAI — re-run `test/codex-drill.js` after codex updates; drift is expected
eventually.

## Detect

`codex --version` succeeds; auth = ChatGPT account sign-in (`codex` once,
interactively). Headless `codex exec` shares the same subscription credit
pool as interactive use (no invocation-mode billing fork on OpenAI's side;
an API key is for isolation, not required).

## Traps (all verified the hard way — read before driving it)

- **Reasoning effort defaults to NONE.** For any nontrivial work, raise it
  explicitly (`-c model_reasoning_effort=high` or the in-session command) —
  default-effort output quality misleads evaluations.
- **The Windows sandbox is a no-op.** Codex's sandbox flags do not confine
  anything on Windows — approval prompts are the ONLY real bound. Never
  treat sandbox settings as a safety layer on this platform.
- **stdin handling differs from claude.** Piping a prompt into interactive
  `codex` traps/behaves unexpectedly — drive it interactively in the PTY
  seat, or use `codex exec` for one-shots.
- **Usage numbers are REMAINING, not used.** Codex's own UI reports what's
  left; the shell's bars normalize to used-% — don't double-invert when
  eyeballing.

## What the shell does

- Terminal seat, two ways in: `+` → TERMINALS → "codex — terminal (PTY)"
  spawns plain `codex`; or set the blank seat's model dial to `codex` — the
  effort dial then maps to `-c model_reasoning_effort` (low/medium/high;
  xhigh/max clamp to high) and the permissions dial to codex's honest
  Windows pair only (manual = ask in-terminal, bypass =
  `--dangerously-bypass-approvals-and-sandbox`; the in-between modes grey
  out because the sandbox is a no-op here). No resume across app restarts
  (PTY law).
- Usage: primary source is the app-server's `account/rateLimits/read` every
  5 min — the SERVER's own numbers, so usage from other machines shows here
  (probe-proven 2026-07-14; initialize-only session, writes no rollout).
  Rollout scanning stays as the instant refresh after local runs and the
  fallback when the probe can't run; the hover says which source fed it
  ("account read" vs "as of last run").
- Transcripts: Codex writes its own rollouts under `~/.codex/sessions`
  (JSONL) — external tooling can read them; the shell does not modify them.
