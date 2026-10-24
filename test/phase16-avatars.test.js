'use strict';
/* V2 player portraits must be real existing assets, not old emoji glyphs.
 * Never interpolate arbitrary avatar IDs into a path or HTML. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const images = require('../public/avatars.js');
const E = require('../src/engine/garden.js');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const phone = read('public/v2/play.html'), tv = read('public/v2/index.html');
const ids = images.choices.map(a => a.id);
assert.equal(ids.length, 8, 'All eight player seats have portrait choices');
assert.equal(new Set(ids).size, 8, 'Every portrait needs a unique identifier');
const bytes = new Set();
for (const id of ids) {
  assert.ok(images.has(id));
  assert.ok(id.length <= 8, 'Server player avatar field limits IDs to eight UTF-16 units');
  const src = images.src(id);
  assert.match(src, /^\/img\/deity-[a-z]+-face\.webp$/);
  const file = path.join(root, 'public', src.substring(1));
  assert.ok(fs.existsSync(file), 'Missing player portrait ' + src);
  const raw = fs.readFileSync(file);
  assert.ok(raw.length > 1000 && raw.length < 150 * 1024, 'Portrait must be substantial but mobile sized: ' + src);
  const signature = raw.subarray(0, 4).toString('ascii');
  assert.equal(signature, 'RIFF', 'Expected valid WebP container ' + src);
  bytes.add(raw.toString('base64'));
  assert.match(images.html(id), /<img class="player-portrait" /);
}
assert.equal(bytes.size, 8, 'Portraits must not all point to the same picture');
for (const legacy of ['🦩', '🌻', '🔨', '💀', '🐐', '🦔', '🍄', '🐸', '🦉', '🐝', '🌵', '👑', '🌱']) {
  assert.ok(ids.includes(images.idFor(legacy)), 'Legacy saved player did not migrate: ' + legacy);
  assert.match(images.html(legacy), /\/img\/deity-[a-z]+-face\.webp/);
}
assert.equal(images.src('<img src=x onerror=alert(1)>'), '/img/deity-frigg-face.webp',
  'An untrusted avatar must never control the image URL');
assert.doesNotMatch(images.html('"><script>alert(1)</script>'), /script/i);
const sandbox = {window:{}};
vm.runInNewContext(read('public/avatars.js'), sandbox);
assert.equal(typeof sandbox.window.RagnaAvatars?.html, 'function', 'Browser must expose the avatar catalogue');
assert.deepEqual(Array.from(sandbox.window.RagnaAvatars.choices.map(c => c.id)), ids);
assert.match(phone, /<script src="\/avatars\.js"><\/script>/);
assert.match(tv, /<script src="\/avatars\.js"><\/script>/);
assert.match(phone, /const AVATARS = RagnaAvatars\.choices;/);
assert.match(phone, /avatar: RagnaAvatars\.idFor\(store\.get/);
assert.match(phone, /AVATARS\.map\(a =>/);
assert.match(phone, /aria-label="Choose \$\{a\.name\} portrait"/);
assert.match(phone, /const avatarPic = value => RagnaAvatars\.html\(value\);/);
assert.match(tv, /const avatarPic = value => RagnaAvatars\.html\(value\);/);
assert.doesNotMatch(phone, /\$\{esc\(p\.avatar\)\}/);
assert.doesNotMatch(tv, /\$\{esc\(p\.avatar\)\}/);
assert.doesNotMatch(phone, /const AVATARS = \['🦩'/);
for (let n=2;n<=8;n++) {
  const game=E.createGame({seed:800 + n});
  for (let i=0;i<n;i++) {
    const id=ids[i];
    const added=E.addPlayer(game,{name:'Gardener '+i,avatar:id});
    assert.ok(added.ok, 'Player join rejected at seat '+i);
    assert.equal(game.players[i].avatar,id);
    assert.equal(E.publicView(game).players[i].avatar,id,'Server public view must carry portrait ID');
  }
}
for (const page of [phone,tv]) {
  for(const m of page.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)) {
    if(m[1].trim())new vm.Script(m[1]);
  }
}
console.log('✔ Eight distinct real face images, old saved emoji migration, XSS-safe image paths and 2–8 player IDs');
console.log('✔ Phone picker, phone/TV displays and inline scripts validated');
