'use strict';
/* Sound coverage: every sound the V2 screens ask for must reach a recorded file
   or a code-made fallback, and every recorded file must load under a name the
   game actually uses. Catches filename typos such as 'sfx-offerin.mp3' or a
   space before '.mp3', which otherwise fail silently.
   Run: node test/audio.test.js (no packages needed) */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const AUDIO = path.join(ROOT, 'public', 'audio');
const GODS = Object.keys(JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'data', 'v2.json'), 'utf8')).gods);

// Load sfx.js the way a browser would, with just enough of a browser around it.
const sandbox = { module: {}, console, localStorage: { getItem: () => null, setItem() {} }, document: { hidden: false }, navigator: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'public', 'sfx.js'), 'utf8'), sandbox);
const SFX = sandbox.module.exports;

let passed = 0;
const check = label => { passed += 1; console.log('  ✔ ' + label); };

/* 1. Filenames are clean. */
const files = fs.readdirSync(AUDIO).filter(f => /\.(mp3|m4a|ogg|wav)$/i.test(f));
const messy = files.filter(f => /\s/.test(f));
assert.deepStrictEqual(messy, [], 'audio filenames contain spaces: ' + messy.join(', '));
check(`${files.length} audio files, none with spaces in the name`);

/* 2. Every name the V2 screens request. */
const screens = ['index.html', 'play.html'].map(f => fs.readFileSync(path.join(ROOT, 'public', 'v2', f), 'utf8')).join('\n');
const requested = new Set([...screens.matchAll(/sfx\('([A-Za-z-]+)'/g)].map(m => m[1]).filter(n => !n.endsWith('-')));
GODS.forEach(g => requested.add('power-' + g));
const ds = /DISASTER_SOUND\s*=\s*(\{[^}]*\})/.exec(screens);
assert.ok(ds, 'DISASTER_SOUND table found on the TV screen');
[...ds[1].matchAll(/:\s*'([a-z]+)'/g)].forEach(m => requested.add('disaster-' + m[1]));
requested.add('disasters');

/* 3. Each recorded file loads under a name the game knows. */
const known = new Set([...requested, ...SFX.list, ...Object.keys(SFX.aliases), ...Object.values(SFX.aliases)]);
const sfxFiles = files.filter(f => /^sfx-/i.test(f));
const loadsAs = sfxFiles.map(f => SFX.canonicalName(/^sfx-(.+?)\s*\.[a-z0-9]+$/i.exec(f)[1]));
const orphans = sfxFiles.filter((f, i) => !known.has(loadsAs[i]));
assert.deepStrictEqual(orphans, [], 'recorded sounds no screen or fallback will ever play (check spelling): ' + orphans.join(', '));
check(`all ${sfxFiles.length} recorded sounds load under a name the game uses`);

/* 4. Nothing the screens ask for is silent, and file names win over synth. */
loadsAs.forEach(n => SFX._setBuffer(n, {}));
const silent = [...requested].filter(n => !SFX.resolve(n));
assert.deepStrictEqual(silent, [], 'sounds with no file and no fallback: ' + silent.join(', '));
check(`all ${requested.size} sounds the V2 screens request will play`);
const exact = [...requested].filter(n => loadsAs.includes(n));
['offerIn', 'playerJoined', 'emergency', 'featureLost', 'disaster-frost', 'disaster-gnomes'].forEach(n =>
  assert.ok(exact.includes(n), `${n} should play its own recorded file`));
check(`${exact.length} requested sounds use their own recorded file`);

/* 5. The loader forgives case and stray spaces. */
assert.strictEqual(SFX.canonicalName('offerin'), 'offerIn');
assert.strictEqual(SFX.canonicalName('actChange '), 'actChange');
check('loader forgives filename case and trailing spaces');

console.log(`✔ All ${passed} audio coverage checks passed`);
