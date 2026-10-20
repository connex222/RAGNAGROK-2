'use strict';
/* Offline art-coverage and browser-script parse tests. No npm packages needed. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const C = require('../src/data/v2.json');
const root = path.join(__dirname, '..');
const img = path.join(root, 'public', 'img');

const files = fs.readdirSync(img);
for (const kind of ['feature', 'cond']) {
  const defs = kind === 'feature' ? Object.keys(C.features) : Object.keys(C.conditions);
  for (const key of defs) {
    const stem = `${kind}-${key}`;
    const found = files.filter(f => f.replace(/\.[a-z0-9]+$/i, '') === stem);
    assert.equal(found.length, 1, `V2 ${kind} artwork ${key}: expected exactly one file, found ${found.join(', ') || 'none'}`);
    const size = fs.statSync(path.join(img, found[0])).size;
    assert.ok(size < 150 * 1024, `${found[0]} is ${Math.round(size / 1024)} KB; phones download every icon, keep each under 150 KB`);
  }
  console.log(`  ✔ ${defs.length} ${kind} icons present, one file each, all phone-sized`);
}

// No artwork slot may be served twice, and nothing on the phone should be huge.
const stems = {};
for (const f of files.filter(f => /\.(png|webp|jpe?g|svg)$/i.test(f))) {
  const stem = f.replace(/\.[a-z0-9]+$/i, '');
  assert.ok(!stems[stem], `Two files for the art slot ${stem}: ${stems[stem]} and ${f}`);
  stems[stem] = f;
  assert.ok(fs.statSync(path.join(img, f)).size < 400 * 1024, `${f} is over 400 KB`);
}
console.log(`  ✔ ${Object.keys(stems).length} art slots, no duplicate names, none over 400 KB`);

// The browser picks webp over svg over png when a slot does have two files.
const sandbox = {};
vm.runInNewContext(fs.readFileSync(path.join(root, 'public', 'board.js'), 'utf8'), sandbox);
const map = sandbox.RagnaBoard.artMap({ files: ['a.png', 'a.webp', 'b.svg', 'b.png', 'c.png'] });
assert.equal(map.a, '/img/a.webp'); assert.equal(map.b, '/img/b.svg'); assert.equal(map.c, '/img/c.png');
console.log('  ✔ art loader prefers webp, then svg, then png, regardless of disk order');

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
