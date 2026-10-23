'use strict';
/* Execute the actual TV fitting function and enforce a true 5% safe area. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '../public/v2/index.html'), 'utf8');
const functionSource = html.match(/function fit\(\) \{[\s\S]*?\n\}/)?.[0];
assert.ok(functionSource, 'TV fit must remain available');
for (const [w, h] of [[1280, 720], [1920, 1080], [3840, 2160], [2560, 1440], [1600, 900]]) {
  const stage = { style: {} };
  vm.runInNewContext(`${functionSource};fit();`, {
    window: { innerWidth: w, innerHeight: h }, $: selector => { assert.equal(selector, '#stage'); return stage; }
  });
  const transform = stage.style.transform;
  const parts = /^translate\(([-\d.]+)px, ([-\d.]+)px\) scale\(([-\d.]+)\)$/.exec(transform || '');
  assert.ok(parts, `${w}x${h}: invalid stage transform`);
  const [, tx, ty, scale] = parts.map(Number);
  const margin = 0.05;
  const delta = 0.0001;
  assert.ok(tx + delta >= w * margin, `${w}x${h}: left overscan unsafe`);
  assert.ok(ty + delta >= h * margin, `${w}x${h}: top overscan unsafe`);
  assert.ok(tx + 1920 * scale <= w * (1 - margin) + delta, `${w}x${h}: right overscan unsafe`);
  assert.ok(ty + 1080 * scale <= h * (1 - margin) + delta, `${w}x${h}: bottom overscan unsafe`);
  console.log(`  ✔ ${w}×${h}: all four TV edges keep a 5% safe area`);
}
assert.ok(html.includes('prefers-reduced-motion'), 'TV must preserve reduced-motion support');
console.log('✔ TV overscan and motion-safe render contracts passed');
