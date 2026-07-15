'use strict';

const assert = require('assert');
const { linkifyEscaped } = require('../renderer/linkify');
const { normalizeExternalUrl } = require('../main/externalUrl');

const https = linkifyEscaped('Open https://github.com/login/device');
assert.match(https, />https:\/\/github\.com\/login\/device<\/a>/);
assert.match(https, /class="webLink"/);
assert.doesNotMatch(https, /class="pathLink"/);
assert.doesNotMatch(https, />s:\/\/github/);

const windows = linkifyEscaped('Open C:\\Users\\Matt\\ApexShell');
assert.match(windows, /class="pathLink"/);
assert.match(windows, /data-path="C:\\Users\\Matt\\ApexShell"/);

const punctuated = linkifyEscaped('(C:\\temp\\file.txt), next');
assert.match(punctuated, /data-path="C:\\temp\\file\.txt"/);
assert.match(punctuated, />C:\\temp\\file\.txt<\/a>\), next$/);

const markdown = linkifyEscaped('Visit [GitHub](https://github.com/Ir8code/ApexShell).');
assert.match(markdown, /^Visit GitHub \(<a class="webLink"/);
assert.match(markdown, />https:\/\/github\.com\/Ir8code\/ApexShell<\/a>\)\.$/);

assert.equal(normalizeExternalUrl('https://github.com/Ir8code/ApexShell'),
  'https://github.com/Ir8code/ApexShell');
assert.equal(normalizeExternalUrl('http://example.com'), 'http://example.com/');
assert.equal(normalizeExternalUrl('javascript:alert(1)'), null);
assert.equal(normalizeExternalUrl('file:///C:/Windows'), null);
assert.equal(normalizeExternalUrl('https://user:pass@example.com'), null);

console.log('linkify drill: PASS');
