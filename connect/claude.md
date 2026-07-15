# connect/claude — the Claude Code lane

The main chat lane: full streamed seats with permission cards, live dials,
usage bars, and resume. Everything below is wire-verified against the real
CLI (probed from Anthropic's own VS Code panel bundle + live captures).

## Detect

`claude --version` succeeds and the user is signed in (`~/.claude/` holds
credentials). If the CLI is missing: `npm install -g @anthropic-ai/claude-code`,
then the human signs in once interactively (`claude` in any terminal).
Subscription auth is the intended shape — see Billing below.

## What the shell does (nothing to configure)

Each seat spawns:

```
claude -p --input-format stream-json --output-format stream-json --verbose
       --include-partial-messages --permission-prompt-tool stdio
       [--resume <sessionId>] [--model m] [--effort e] --permission-mode <mode>
```

in the seat's working directory (workspace / preset cwd). stdout is JSON
lines (init, assistant deltas, results, control requests); permissions
arrive as `can_use_tool` control_requests and render as Allow/Deny cards —
answers ride back as control_responses, including the CLI's own
"always allow" rule suggestions.

Dial behavior the UI already encodes — don't "fix" it:

- permission mode + model switch LIVE (`set_permission_mode`, `set_model`
  control subtypes; host truth updates only on the CLI's confirmation).
- effort has no live subtype → the dial performs a seamless restart
  (`--resume` same session, new flag). Labeled a restart, never disguised.
- `bypassPermissions` is launch-time only → also routed via restart.
- `--resume` silently DROPS `--append-system-prompt` (proven headless) —
  the seat's environment brief rides the first user turn instead. Do not
  move it back to the flag.

Transcripts land in `~/.claude/projects/<cwd-slug>/<sessionId>.jsonl`; the
shell tails them to backfill resumed chats.

## Usage bars

Read via the OAuth usage endpoint using the CLI's own stored credentials —
an UNOFFICIAL endpoint: if bars go stale while creds are valid, the
endpoint moved; re-probe before assuming breakage. Bars show session +
weekly used-%, with reset times on hover.

## Billing — the one strategic caveat

`claude -p` on a subscription currently bills flat-rate (the announced
invocation-mode metering split was PAUSED before activation — verified
mid-2026). It is a pause, not a cancellation: if it ever un-pauses, owned
seats flip to metered while first-party interactive stays flat. Re-verify
against Anthropic's help center when touching the engine, and keep the PTY
terminal lane (`claude` in a real TTY) warm as the fallback shape.
