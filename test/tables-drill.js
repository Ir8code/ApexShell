'use strict';

const assert = require('assert');
const { renderEscaped } = require('../renderer/tables');

// the caller's inline formatter is applied per cell/segment — mark it so the
// drill can see exactly where it ran
const mark = (s) => '[' + s + ']';

// 1. basic table: header cells become th, body cells td, class present
const basic = renderEscaped(
  '| Field | Values |\n|---|---|\n| type | task |\n| status | todo |', mark);
assert.match(basic, /<table class="mdTable">/);
assert.match(basic, /<th>\[Field\]<\/th><th>\[Values\]<\/th>/);
assert.match(basic, /<td>\[type\]<\/td><td>\[task\]<\/td>/);
assert.match(basic, /<td>\[status\]<\/td><td>\[todo\]<\/td>/);

// 2. alignment from divider colons
const aligned = renderEscaped('| a | b | c |\n|:---|:---:|---:|\n| 1 | 2 | 3 |', mark);
assert.match(aligned, /<th class="al-left">\[a\]/);
assert.match(aligned, /<th class="al-center">\[b\]/);
assert.match(aligned, /<th class="al-right">\[c\]/);
assert.match(aligned, /<td class="al-right">\[3\]/);

// 3. pipes without a divider row are NOT a table — plain text passes through
const plain = renderEscaped('a | b | c\nno table here', mark);
assert.equal(plain, '[a | b | c\nno table here]');
const loneDivider = renderEscaped('|---|---|', mark);
assert.doesNotMatch(loneDivider, /<table/);

// 4. surrounding prose survives, formatted by the same inline chain
const mixed = renderEscaped('before\n| h |\n|---|\n| x |\nafter', mark);
assert.match(mixed, /^\[before\]\n<table/);
assert.match(mixed, /<\/table>\n\[after\]$/);

// 5. already-escaped content is never unescaped (input arrives esc()'d)
const escaped = renderEscaped('| h |\n|---|\n| &lt;script&gt; |', (s) => s);
assert.match(escaped, /<td>&lt;script&gt;<\/td>/);
assert.doesNotMatch(escaped, /<script>/);

// 6. ragged rows: short rows pad to the header width, long rows truncate
const ragged = renderEscaped('| a | b |\n|---|---|\n| 1 |\n| 1 | 2 | 3 |', (s) => s);
assert.match(ragged, /<tr><td>1<\/td><td><\/td><\/tr>/);
assert.doesNotMatch(ragged, /<td>3<\/td>/);

// 7. header-only table (no body rows) still renders
const headerOnly = renderEscaped('| only | header |\n|---|---|', (s) => s);
assert.match(headerOnly, /<thead>/);
assert.doesNotMatch(headerOnly, /<tbody>/);

console.log('tables drill: PASS');
