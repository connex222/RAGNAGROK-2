'use strict';
/* Small defensive boundary for untrusted Socket.io command arguments.
   Transport limits are enforced separately by Socket.io's maxHttpBufferSize. */
const MAX_BYTES = 4096;
const MAX_DEPTH = 5;
const MAX_ITEMS = 50;
const BLOCKED = new Set(['__proto__', 'constructor', 'prototype']);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function validatePayload(value, { maxBytes = MAX_BYTES } = {}) {
  if (value === undefined) return { ok: true, value: {} };
  if (!isRecord(value)) return { ok: false, error: 'Invalid command payload' };
  let bytes = 0;
  function visit(node, depth) {
    if (depth > MAX_DEPTH) throw new Error('Payload nesting limit exceeded');
    if (node === null || typeof node === 'boolean') { bytes += 4; return; }
    if (typeof node === 'number') {
      if (!Number.isFinite(node)) throw new Error('Invalid number');
      bytes += 24; return;
    }
    if (typeof node === 'string') {
      if (node.length > 1024) throw new Error('String too long');
      bytes += Buffer.byteLength(node, 'utf8'); return;
    }
    if (Array.isArray(node)) {
      if (node.length > MAX_ITEMS) throw new Error('Array too large');
      node.forEach(item => visit(item, depth + 1)); return;
    }
    if (!isRecord(node)) throw new Error('Invalid payload value');
    const entries = Object.entries(node);
    if (entries.length > MAX_ITEMS) throw new Error('Too many fields');
    for (const [key, val] of entries) {
      if (BLOCKED.has(key) || key.length > 80) throw new Error('Invalid field name');
      bytes += Buffer.byteLength(key, 'utf8');
      visit(val, depth + 1);
      if (bytes > maxBytes) throw new Error('Payload too large');
    }
  }
  try {
    visit(value, 0);
    if (bytes > maxBytes) throw new Error('Payload too large');
    return { ok: true, value };
  } catch (err) { return { ok: false, error: err.message }; }
}

module.exports = { validatePayload };
