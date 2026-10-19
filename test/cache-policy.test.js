'use strict';
/* Dependency-free regression test for cross-version phone/TV stale assets. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { cacheControlFor } = require('../server/cache-policy');
for (const asset of ['index.html', 'play.html', 'board.js', 'v2/rules.js', 'v2.json', 'game.css', 'feature-greenhouse.svg']) {
  assert.equal(cacheControlFor(asset), 'no-cache', `Revalidate ${asset} after deploying an update`);
}
for (const asset of ['logo.webp', 'background-tv.png', 'music.mp3']) {
  assert.equal(cacheControlFor(asset), 'public, max-age=3600');
}
const source = fs.readFileSync(path.join(__dirname, '../server/index.js'), 'utf8');
assert.match(source, /res\.set\('Cache-Control', cacheControlFor\(file\)\)/);
assert.match(source, /app\.get\('\/data\/v2\.json',[\s\S]*?res\.set\('Cache-Control', 'no-cache'\)/);
assert.match(source, /app\.get\('\/data\/cards\.json',[\s\S]*?res\.set\('Cache-Control', 'no-cache'\)/);
assert.match(source, /res\.json\(\{ ok: true, version, rules,/);
console.log('✔ Version-aware HTTP asset cache and status policy passed');
