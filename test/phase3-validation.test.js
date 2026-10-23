'use strict';
/* Phase 3 regression suite: abandoned manual pauses and first-game UX affordances.
   Does not require npm packages or a real socket server. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { RoomManager } = require('../server/rooms');

const root = path.resolve(__dirname, '..');
const tv = fs.readFileSync(path.join(root, 'public/v2/index.html'), 'utf8');
const phone = fs.readFileSync(path.join(root, 'public/v2/play.html'), 'utf8');
const check = (name, fn) => { fn(); console.log('  ✔ ' + name); };
const mkSocket = (role, token = null) => ({ data: { role, token, isHost: role === 'tv' }, events: [], emit(type, data) { this.events.push({ type, data }); } });

check('Manually paused match with a TV but zero active phones expires after idle timeout', () => {
  const now = 100_000;
  const manager = new RoomManager({ rules: 'v2', idleMinutes: 1, logger: { log() {}, error() {} } });
  const room = manager.create(now);
  manager.E.addPlayer(room.state, { name: 'Alice' }, now);
  manager.E.addPlayer(room.state, { name: 'Bob' }, now);
  assert.equal(manager.E.apply(room.state, 0, { type: 'start' }, now).ok, true);
  const tv = mkSocket('tv');
  const players = [0, 1].map(i => mkSocket('player', room.state.secrets.playerTokens[i]));
  room.sockets.add(tv); players.forEach(p => room.sockets.add(p));
  manager.refreshConnected(room, now);
  assert.equal(manager.pause(room, now), null);
  room.sockets.delete(players[0]); room.sockets.delete(players[1]);
  manager.refreshConnected(room, now + 1000);
  assert.equal(room.paused.auto, undefined, 'manual pause is not turned into an automatic one');
  manager.touch(room, now + 1000);
  manager.tickAll(now + 62_000);
  assert.equal(manager.get(room.code), null, 'idle TV must not pin a game forever');
  assert.ok(tv.events.some(e => e.type === 'roomClosed'), 'remaining TV is told that room closed');
  assert.equal(tv.data.isHost, false, 'closed room revokes TV host permissions');
});

check('Paused room remains available when even one authenticated phone is still present', () => {
  const now = 50_000;
  const manager = new RoomManager({ rules: 'v2', idleMinutes: 1, logger: { log() {}, error() {} } });
  const room = manager.create(now);
  manager.E.addPlayer(room.state, { name: 'Alice' }, now);
  manager.E.addPlayer(room.state, { name: 'Bob' }, now);
  assert.equal(manager.E.apply(room.state, 0, { type: 'start' }, now).ok, true);
  const tv = mkSocket('tv'), phone = mkSocket('player', room.state.secrets.playerTokens[0]);
  room.sockets.add(tv); room.sockets.add(phone);
  manager.refreshConnected(room, now);
  assert.equal(manager.pause(room, now), null);
  manager.tickAll(now + 120_000);
  assert.strictEqual(manager.get(room.code), room, 'do not discard a paused match with a live controller');
  assert.equal(room.paused.auto, undefined, 'manual pause stays manual');
});

check('Small-screen avatar grid fits four tap targets without clipping', () => {
  assert.match(phone, /@media \(max-width:360px\)\s*\{\s*\.avatars\s*\{\s*grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(phone, /\.avatars button\s*\{\s*min-width:0/);
  assert.match(phone, /<div class="avatars" id="avatarGrid"/);
});

check('Incomplete planning leads to an active next-action button, not a disabled fake control', () => {
  const from = phone.indexOf('function renderActionBar() {');
  const to = phone.indexOf('/* ================= render: lobby', from);
  assert.ok(from >= 0 && to > from);
  const render = phone.slice(from, to);
  assert.match(render, /const firstEmpty = slots\.findIndex\(slot => !slot\)/);
  assert.match(render, /data-act="editSlot" data-i="\$\{firstEmpty\}"/);
  assert.doesNotMatch(render, /data-act="lock" disabled>Choose/);
});

check('TV header provides space for progress, controls and the game clock', () => {
  assert.match(tv, /#corner\.ingame\s*\{ top:22px; right:225px; \}/);
  assert.match(tv, /#meter\s*\{ margin-right:350px; min-width:0; \}/);
  assert.match(tv, /'Everyone is planning' \? 'Planning'/);
});

check('Both inline screen scripts still compile after markup changes', () => {
  for (const [name, html] of [['TV', tv], ['Phone', phone]]) {
    const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m => m[1]);
    assert.ok(scripts.length);
    scripts.forEach(js => new vm.Script(js, { filename: `${name} inline` }));
  }
});
console.log('✔ Phase 3 structural and room-lifecycle checks passed');
