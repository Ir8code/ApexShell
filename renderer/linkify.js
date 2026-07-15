// Safe link rendering for escaped assistant prose. Model output is untrusted:
// destinations stay visible, and anchors carry intent to the main process only
// after an explicit click or keyboard activation.
'use strict';

(function init(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ApexLinkify = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function build() {
  const MARKDOWN_WEB_RE = /\[([^\]\n]+)\]\((https?:\/\/[^\s`"'<>\)]+)\)/gi;
  // The boundary is essential: without it, the `s:/` inside `https://` looks
  // like a Windows drive path and only that broken suffix becomes clickable.
  const LINK_RE = /(?<![A-Za-z0-9])(?:https?:\/\/[^\s`"'<>]+|[A-Za-z]:[\\\/][^\s`"'<>|*?]+)/gi;
  const TOKEN_RE = /\uE000(\d+)\uE001/g;

  function splitTrailing(value) {
    let core = value;
    let tail = '';
    const pairs = { ')': '(', ']': '[', '}': '{' };
    while (core) {
      const last = core.slice(-1);
      if (/[.,;:!?]/.test(last)) {
        tail = last + tail;
        core = core.slice(0, -1);
        continue;
      }
      if (pairs[last]) {
        const opens = core.split(pairs[last]).length - 1;
        const closes = core.split(last).length - 1;
        if (closes > opens) {
          tail = last + tail;
          core = core.slice(0, -1);
          continue;
        }
      }
      break;
    }
    return { core, tail };
  }

  function anchor(kind, value, label) {
    const web = kind === 'web';
    const cls = web ? 'webLink' : 'pathLink';
    const attr = web ? 'data-url' : 'data-path';
    const title = web ? 'open in browser' : 'open in the Viewer tab';
    return '<a class="' + cls + '" role="link" tabindex="0" ' + attr + '="' +
      value + '" title="' + title + '">' + label + '</a>';
  }

  function linkifyEscaped(input) {
    let text = String(input == null ? '' : input);
    const links = [];
    const hold = (html) => {
      const token = '\uE000' + links.length + '\uE001';
      links.push(html);
      return token;
    };

    // Preserve descriptive Markdown text, but also show the complete target.
    // A model-provided label must never conceal a different destination.
    text = text.replace(MARKDOWN_WEB_RE, (_whole, label, url) =>
      label + ' (' + hold(anchor('web', url, url)) + ')');

    text = text.replace(LINK_RE, (candidate) => {
      const { core, tail } = splitTrailing(candidate);
      if (!core) return candidate;
      const kind = /^https?:\/\//i.test(core) ? 'web' : 'path';
      return hold(anchor(kind, core, core)) + tail;
    });

    return text.replace(TOKEN_RE, (_whole, index) => links[Number(index)] || '');
  }

  return { linkifyEscaped, splitTrailing };
});
