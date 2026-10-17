'use strict';
/* Offline art-coverage and browser-script parse tests. No npm packages needed. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const C = require('../src/data/v2.json');
const root = path.join(__dirname, '..');
const img = path.join(root, 'public', 'img');

for (const kind of ['feature', 'cond']) {
  const defs = kind === 'feature' ? Object.keys(C.features) : Object.keys(C.conditions);
  for (const key of defs) {
    const file = path.join(img, `${kind}-${key}.svg`);
    assert.ok(fs.existsSync(file), `Missing V2 ${kind} artwork: ${key}`);
    const contents = fs.readFileSync(file, 'utf8');
    assert.match(contents, /<svg\s/);
    assert.match(contents, /<\/svg>\s*$/);
    assert.ok(contents.length < 12000, `Unexpectedly large vector asset: ${key}`);
  }
  console.log(`  ✔ ${defs.length} ${kind} icons present`);
}

for (const file of ['public/v2/index.html', 'public/v2/play.html', 'public/v2/rules.js', 'public/board.js', 'server/handlers.js', 'server/rooms.js']) {
  const contents = fs.readFileSync(path.join(root, file), 'utf8');
  if (file.endsWith('.html')) {
    for (const match of contents.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)) {
      if (match[1].trim()) new vm.Script(match[1], { filename: file });
    }
  } else new vm.Script(contents, { filename: file });
  console.log(`  ✔ ${file} parses`);
}
console.log('✔ Asset and JavaScript parse checks passed');
