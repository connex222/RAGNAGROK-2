'use strict';
/* Permanent branding regression gate. Exact product name: RAGNAGROK.
   Machine identifiers and backwards-compatible filenames are deliberately
   lowercase/mixed-case; player-facing branding must use uppercase. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const scanExt = new Set(['.html', '.js', '.json', '.md', '.bat', '.yaml', '.yml', '.txt', '.svg']);
const excludedDirs = new Set(['node_modules', '.git']);
const wrong = new RegExp('ragna' + 'r(?:o|ö|\u00f6)k', 'iu');
let scanned = 0;
function scan(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (item.isDirectory()) { if (!excludedDirs.has(item.name)) scan(path.join(dir, item.name)); continue; }
    if (!item.isFile() || !scanExt.has(path.extname(item.name).toLowerCase())) continue;
    const file = path.join(dir, item.name);
    const contents = fs.readFileSync(file, 'utf8');
    // See the checked-in licence and source text, not raster screenshots.
    assert.ok(!wrong.test(contents), `Spelling inconsistent with RAGNAGROK: ${path.relative(root,file)}`);
    scanned++;
  }
}
scan(root);
for (const file of ['archive/v1/public/index.html', 'archive/v1/public/play.html', 'public/v2/index.html', 'public/v2/play.html']) {
  const contents = fs.readFileSync(path.join(root, file), 'utf8');
  assert.match(contents, /<title>RAGNAGROK/);
  assert.match(contents, /(?:class="(?:title|t)"|alt="?)[^>]*RAGNAGROK/);
}
const tv = fs.readFileSync(path.join(root, 'public/v2/index.html'), 'utf8');
assert.match(tv, /const ACT_NAME = \[[^\n]*'RAGNAGROK'/);
const logo = path.join(root, 'public/img/logo.webp');
assert.ok(fs.existsSync(logo), 'existing correct logo must be preserved');
console.log(`✔ RAGNAGROK brand audit passed across ${scanned} source and documentation files`);
