// Apex seat engine — transcript backfill (the J26 parser, vendor-neutral).
// `--resume` replays nothing over the wire; the view rebuilds a resumed chat
// from the session's own jsonl transcript instead. Pure-Node, no Electron.
// (Ported by the resident Qwen from seats.js's backfillHistory — offload-log
// row #6; verified against a live transcript + `this`-binding fix.)

const fs = require('fs');
const path = require('path');

/** Find `<sessionId>.jsonl` under any immediate child of projectsRoot
 *  (the ~/.claude/projects layout). Returns the full path or null; never throws. */
function findTranscript(sessionId, projectsRoot) {
  try {
    if (!fs.existsSync(projectsRoot)) return null;
    for (const dir of fs.readdirSync(projectsRoot)) {
      const filePath = path.join(projectsRoot, dir, `${sessionId}.jsonl`);
      if (fs.existsSync(filePath)) return filePath;
    }
    return null;
  } catch {
    return null;
  }
}

/** Raw JSONL transcript text → view-vocab messages (last `cap`, default 200).
 *  Pure function. Rules (J26): skip sidechains and messageless lines; user
 *  turns keep plain text only (harness-injected `<…>` wrappers and
 *  `[seat-launch]` kickoffs filtered); assistant turns keep non-empty text
 *  blocks (tool chips / thinking stay live-wire concerns). */
function parseBackfill(fileText, cap = 200) {
  const msgs = [];
  for (const line of fileText.split('\n')) {
    if (!line.trim()) continue;
    let o;
    try { o = JSON.parse(line); } catch { continue; }
    if (o.isSidechain || !o.message) continue;
    if (o.type === 'user') {
      let text;
      if (typeof o.message.content === 'string') {
        text = o.message.content;
      } else {
        const blocks = o.message.content || [];
        // Tool results ride the user ROLE on the wire — a message carrying any
        // tool_result block is harness plumbing, and its text blocks are
        // captions ("[Image: original WxH…]"), not something the user typed.
        // Replayed feeds were dressing the seat's own screenshots as user
        // input (the operator, 2026-07-13).
        if (blocks.some((b) => b.type === 'tool_result')) continue;
        text = blocks
          .filter((b) => b.type === 'text')
          .map((b) => b.text)
          .join('\n');
      }
      // `[seat-launch]` is matched anywhere, not just at the head — live
      // kickoffs read "Hey Agent — [seat-launch]…" (the reference's startsWith
      // missed them; caught testing against a real transcript).
      // The image-caption regex is the same belt-and-suspenders for captions
      // that arrive as their own standalone user-role line.
      if (text && !text.startsWith('<') && !text.includes('[seat-launch]')
          && !/^\[Image: original \d+x\d+/.test(text))
        msgs.push({ type: 'user', text });
    } else if (o.type === 'assistant') {
      for (const block of o.message.content || []) {
        if (block.type === 'text' && block.text && block.text.trim())
          msgs.push({ type: 'text', text: block.text });
      }
    }
  }
  return msgs.slice(-cap);
}

/** Last known context footprint from a transcript: every assistant line
 *  carries `message.usage`, and prompt tokens (fresh + cache read + cache
 *  creation) ARE the live context size. Lets a resumed/reloaded chat show
 *  its meter before the first live turn. Null when no usage found. */
function extractContext(fileText) {
  let used = 0, model = '';
  for (const line of fileText.split('\n')) {
    if (!line.includes('"usage"')) continue;
    let o;
    try { o = JSON.parse(line); } catch { continue; }
    if (o.isSidechain || o.type !== 'assistant' || !o.message || !o.message.usage) continue;
    const u = o.message.usage;
    const t = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) +
              (u.cache_creation_input_tokens || 0);
    if (t) { used = t; model = o.message.model || model; }
  }
  return used ? { used, model } : null;
}

/** Convenience: locate + read + parse. `{ file: null, messages: [] }` when
 *  not found; never throws (a failed backfill must never kill a resume). */
function backfill(sessionId, projectsRoot, cap = 200) {
  const file = findTranscript(sessionId, projectsRoot);
  if (!file) return { file: null, messages: [], context: null };
  try {
    const text = fs.readFileSync(file, 'utf8');
    return { file, messages: parseBackfill(text, cap), context: extractContext(text) };
  } catch {
    return { file, messages: [], context: null };
  }
}

module.exports = { findTranscript, parseBackfill, extractContext, backfill };
