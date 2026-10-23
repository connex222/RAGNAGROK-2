'use strict';
/* Dependency-free accessibility regression for phone and TV dialog mechanics.
   For behavioural keyboard coverage run python test/phase14-browser.py. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = name => fs.readFileSync(path.join(__dirname, '../public/v2', name), 'utf8');
const phone = read('play.html'), tv = read('index.html');
for (const [name, html] of [['play.html', phone], ['index.html', tv]]) {
  for (const [,script] of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)) {
    new vm.Script(script, {filename: name});
  }
}
assert.match(phone, /id="sheet"\s+role="dialog"\s+aria-modal="true"/);
assert.match(phone, /sheet\.setAttribute\('aria-labelledby', 'sheetHeading'\)/);
assert.match(phone, /\$\('#app'\)\.inert = true/);
assert.match(phone, /\$\('#app'\)\.inert = false/);
assert.match(phone, /sheet\.querySelector\('h2'\)/);
assert.match(phone, /function rememberSheetOpener\(el\)/);
assert.match(phone, /rememberSheetOpener\(el\);[\s\S]*?onAct\(el\)/);
assert.match(phone, /const opener = sheetFocusReturn && document\.querySelector\(sheetFocusReturn\)/);
assert.match(phone, /if \(target && !target\.disabled\) target\.focus/);
assert.match(phone, /id="avatarGrid"\s+role="group"\s+aria-labelledby="avatarGroupTitle"/);
assert.match(tv, /id="rules"\s+role="dialog"\s+aria-modal="true"\s+aria-labelledby="tvRulesTitle"/);
assert.match(tv, /id="tvRulesTitle"/);
assert.match(tv, /function shieldRulesBackground\(active\)/);
assert.match(tv, /:focus-visible\s*\{\s*outline:/);
assert.match(tv, /function closeRules\(\)[\s\S]*?rulesReturnFocus[\s\S]*?\.focus\(/);
assert.match(tv, /if \(e\.key === 'Tab'\)[\s\S]*?\.focus\(/);
assert.match(tv, /if \(e\.key === 'Escape'\)\s*\{\s*e\.preventDefault\(\);\s*closeRules\(\)/);
console.log('✔ Phase 14 dialog name, keyboard focus, focus-return and TV styling contracts');
