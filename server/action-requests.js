'use strict';
/* Stable action identities for retry safety. A request ID belongs to one
   particular command; changing the payload while reusing the ID is an error. */
const crypto = require('node:crypto');
const ID = /^[a-zA-Z0-9_-]{8,72}$/;
const KEY = /^[0-7]:[a-zA-Z0-9_-]{8,72}$/;
const DIGEST = /^[a-f0-9]{64}$/;
const LIMIT = 256;

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
function fingerprint(action) {
  return crypto.createHash('sha256').update(canonical(action)).digest('hex');
}
function validSavedReplies(entries) {
  return Array.isArray(entries) && entries.length <= LIMIT && entries.every(entry => {
    if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'string' || !KEY.test(entry[0])) return false;
    const data = entry[1];
    return data && typeof data === 'object' && !Array.isArray(data) &&
      typeof data.fingerprint === 'string' && DIGEST.test(data.fingerprint) &&
      data.reply && typeof data.reply === 'object' && !Array.isArray(data.reply) &&
      typeof data.reply.ok === 'boolean' &&
      (data.reply.error === undefined || (typeof data.reply.error === 'string' && data.reply.error.length <= 200));
  }) && new Set(entries.map(e => e[0])).size === entries.length;
}
module.exports = { ID, LIMIT, fingerprint, validSavedReplies };
