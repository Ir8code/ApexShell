'use strict';

function normalizeExternalUrl(value) {
  try {
    const url = new URL(String(value == null ? '' : value).trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

module.exports = { normalizeExternalUrl };
