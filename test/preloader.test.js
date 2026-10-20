'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

async function main() {
  let started = 0, inflight = 0, peak = 0;
  class Image {
    set src(value) {
      started++; inflight++; peak = Math.max(peak, inflight);
      queueMicrotask(() => { inflight--; if (value.includes('broken')) this.onerror(); else this.onload(); });
    }
    decode() { return Promise.resolve(); }
  }
  const sandbox = { Image, Promise, Map, Set, setTimeout, queueMicrotask };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/assets.js'), 'utf8'), sandbox);
  const art = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`icon-${i}`, `/img/icon-${i}.webp`]));
  art.bad = '/img/broken.webp';
  const out = await sandbox.RagnaAssets.preloadGroup(art, [...Object.keys(art), 'missing', 'icon-0']);
  assert.equal(out.length, 14, 'group should dedupe repeated keys');
  assert.equal(out.find(e => e.key === 'missing').loaded, false);
  assert.equal(out.find(e => e.key === 'bad').loaded, false);
  assert.equal(out.find(e => e.key === 'icon-0').loaded, true);
  assert.ok(peak <= 4, `maximum image concurrency must be bounded, got ${peak}`);
  const count = started;
  await sandbox.RagnaAssets.preloadGroup(art, ['icon-0', 'icon-2']);
  assert.equal(started, count, 'loaded images must be reused across stages');
  console.log('  ✔ staged preloading handles failures, missing artwork, concurrency and caching');
  for (const page of ['index.html', 'play.html']) {
    const source = fs.readFileSync(path.join(__dirname, '../public/v2', page), 'utf8');
    assert.match(source, /<script src="\/assets\.js"><\/script>/);
    assert.match(source, /RagnaAssets\.preloadGroup/);
    assert.match(source, /RagnaAssets\.preloadWhenIdle/);
  }
  console.log('  ✔ TV and phone both initialise the two-stage loader');

  // Never-ending image requests should release all slots after the timeout.
  // Use a controlled fake clock instead of sleeping for twelve real seconds.
  const waiting = [];
  let attempts = 0;
  class HangingImage { set src(_) { attempts++; } }
  const timeSandbox = {
    Image: HangingImage, Promise, Map, Set, queueMicrotask,
    setTimeout(fn) { waiting.push(fn); return waiting.length; },
    clearTimeout() {}
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/assets.js'), 'utf8'), timeSandbox);
  const hanging = Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`slow${i}`, `/img/slow${i}.webp`]));
  const pending = timeSandbox.RagnaAssets.preloadGroup(hanging, Object.keys(hanging));
  assert.equal(attempts, 4, 'load no more than four stalled images simultaneously');
  for (let round = 0; round < 3; round++) {
    const callbacks = waiting.splice(0);
    for (const fn of callbacks) fn();
    await Promise.resolve();
  }
  const timedOut = await pending;
  assert.equal(timedOut.length, 9);
  assert.ok(timedOut.every(x => x.loaded === false));
  assert.equal(attempts, 9);
  const retried = timeSandbox.RagnaAssets.preloadGroup(hanging, ['slow0']);
  assert.equal(attempts, 10, 'failed artwork is eligible for retry');
  for (const fn of waiting.splice(0)) fn();
  assert.equal((await retried)[0].loaded, false);
  console.log('  ✔ stalled artwork releases queue slots, without exceeding concurrency');
}
main().catch(err => { console.error(err); process.exitCode = 1; });
