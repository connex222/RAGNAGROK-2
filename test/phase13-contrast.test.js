'use strict';
/* Check high-impact status badge contrast in both colour themes. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../public/v2/play.html'), 'utf8');
const rule = html.match(/\.badge \{([^}]+)\}/)?.[1];
assert.ok(rule && /background:\s*var\(--bad\)/.test(rule), 'Badge must use the status background');
assert.match(rule, /color:\s*var\(--on-primary\)/, 'Badge must adapt to both themes');
function value(rule, key) {
  const found = rule.match(new RegExp(`--${key}:\\s*(#[0-9a-fA-F]{6})`));
  assert.ok(found, `Missing ${key} theme colour`);
  return found[1];
}
function lum(rgb) {
  const values = [1, 3, 5].map(i => parseInt(rgb.slice(i,i+2),16)/255);
  const linear = values.map(x => x <= 0.04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4);
  return .2126 * linear[0] + .7152 * linear[1] + .0722 * linear[2];
}
function contrast(a,b) { const [hi,lo] = [lum(a),lum(b)].sort((x,y) => y-x); return (hi+.05)/(lo+.05); }
for (const [theme, block] of [
  ['dusk',html.match(/:root\s*\{([\s\S]*?)\}/)?.[1]],
  ['day',html.match(/html\[data-theme="day"\]\s*\{([\s\S]*?)\}/)?.[1]],
]) {
  assert.ok(block, `No theme declaration for ${theme}`);
  const ratio = contrast(value(block,'on-primary'),value(block,'bad'));
  assert.ok(ratio >= 4.5, `${theme}: badge contrast ${ratio.toFixed(2)}:1 below WCAG AA for small text`);
  console.log(`  ✔ ${theme}: badge foreground/background contrast ${ratio.toFixed(2)}:1`);
}
console.log('✔ Phone status badge contrast checked in both themes');
