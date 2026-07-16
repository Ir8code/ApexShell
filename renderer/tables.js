// Markdown tables over ESCAPED text (J89). Input arrives already HTML-escaped
// by the chat view's esc() — this module only decides block structure (which
// lines form a table) and delegates every cell's inline formatting back to the
// caller, so linkify/code/bold behave identically inside and outside tables.
// Model output never reaches innerHTML unescaped here either.
'use strict';

(function init(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ApexTables = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function build() {
  // GFM shape: a row line has a real pipe structure; the divider row under the
  // header is dashes/colons/pipes/spaces with at least one dash. `&` appears
  // in escaped entities (&amp;) and is fine — the divider test is a whitelist.
  const isRow = (line) => /^\s*\|.*\|\s*$/.test(line);
  const isDivider = (line) => /^\s*\|[\s:|-]*-[\s:|-]*\|\s*$/.test(line);

  function splitCells(line) {
    const inner = line.trim().replace(/^\|/, '').replace(/\|$/, '');
    return inner.split('|').map((c) => c.trim());
  }

  function alignments(dividerCells) {
    return dividerCells.map((c) => {
      const l = c.startsWith(':'), r = c.endsWith(':');
      return l && r ? 'center' : r ? 'right' : l ? 'left' : '';
    });
  }

  /** escapedText → html. `inline` formats one cell/segment of escaped text
   *  (the caller's linkify + code + bold pipeline). Non-table segments pass
   *  through `inline` untouched, so adopting this is behavior-neutral for
   *  everything that isn't a table. */
  function renderEscaped(escapedText, inline) {
    const lines = escapedText.split('\n');
    const out = [];
    let plain = [];
    const flush = () => {
      if (plain.length) { out.push(inline(plain.join('\n'))); plain = []; }
    };
    for (let i = 0; i < lines.length; i++) {
      // a table = header row + divider row (+ body rows) — anything less
      // (a lone pipe line, a divider with no header) stays plain text
      if (!(isRow(lines[i]) && i + 1 < lines.length && isDivider(lines[i + 1]))) {
        plain.push(lines[i]);
        continue;
      }
      const header = splitCells(lines[i]);
      const align = alignments(splitCells(lines[i + 1]));
      let j = i + 2;
      const body = [];
      while (j < lines.length && isRow(lines[j]) && !isDivider(lines[j]))
        body.push(splitCells(lines[j++]));
      flush();
      const attr = (k) => align[k] ? ' class="al-' + align[k] + '"' : '';
      const cellsOf = (cells, tag) => cells.slice(0, header.length)
        .concat(Array(Math.max(0, header.length - cells.length)).fill(''))
        .map((c, k) => '<' + tag + attr(k) + '>' + inline(c) + '</' + tag + '>')
        .join('');
      let html = '<table class="mdTable"><thead><tr>' + cellsOf(header, 'th') +
                 '</tr></thead>';
      if (body.length)
        html += '<tbody>' + body.map((r) => '<tr>' + cellsOf(r, 'td') + '</tr>').join('') +
                '</tbody>';
      out.push(html + '</table>');
      i = j - 1;
    }
    flush();
    return out.join('\n');
  }

  return { renderEscaped };
});
