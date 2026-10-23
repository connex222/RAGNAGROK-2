'use strict';
/* Privacy, genuine authenticated transport, opt-in postgame measurement. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { RoomManager } = require('../server/rooms');
const { attachHandlers } = require('../server/handlers');
const { validFeedback, groupedFeedback } = require('../server/playtest-pulse');

class Phone {
  constructor(ip) { this.data = {}; this.handshake = { headers: { host: 'localhost:3000' }, address: ip }; this.h = new Map(); this.messages = []; }
  on(k, v) { this.h.set(k, v); }
  emit(k, v) { this.messages.push({ k, v }); }
  ask(k, p = {}) { return new Promise((resolve, reject) => { try { Promise.resolve(this.h.get(k)(p, resolve)).catch(reject); } catch(e) { reject(e); } }); }
  latest(k) { return this.messages.filter(m => m.k === k).at(-1)?.v; }
}
(async () => {
  console.log('Phase 8: optional private feedback and group-only playtest reporting');
  for (const item of [null, {}, { enjoyment: 0, rematch: true }, { enjoyment: 6, rematch: false },
    { enjoyment: 3.5, rematch: true }, { enjoyment: 4, rematch: 'yes' },
    { enjoyment: 5, rematch: true, seat: 0 }, { enjoyment: 4, rematch: false, name: 'Bob' }])
    assert.equal(Boolean(validFeedback(item)), false, 'invalid or identity-bearing feedback is refused');
  assert.equal(validFeedback({ enjoyment: 4, rematch: false }), true);
  console.log('  ✔ strict bounded ratings, booleans and identity-free payload');

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ragnagrok-pulse-'));
  let host, players, room, mgr;
  try {
    mgr = new RoomManager({ rules: 'v2', saveDir: dir, logger: { log(){}, error(){} } });
    const io = { on(_, handler) { this.connect = handler; } };
    attachHandlers(io, mgr, { qrCode: { toDataURL: async () => 'qr' }, rate: { capacity: 1000, refillPerSec: 1000 } });
    const connect = ip => { const s = new Phone(ip); io.connect(s); return s; };
    host = connect('tv');
    const created = await host.ask('tv:create'); assert.equal(created.ok, true);
    players = [connect('one'),connect('two'),connect('three')];
    for (let i=0; i<3; i++) assert.equal((await players[i].ask('player:join', { code: created.code, name: `Tester ${i}` })).ok, true);
    room = mgr.get(created.code);
    assert.equal((await players[1].ask('playtest:feedback', { enjoyment: 5, rematch: true })).ok, false, "cannot submit before finale");
    assert.equal((await host.ask('playtest:feedback', { enjoyment: 5, rematch: true })).ok, false, 'TV cannot submit');
    assert.equal((await connect('outsider').ask('playtest:feedback', { enjoyment: 5, rematch: true })).ok, false);
    assert.equal((await host.ask('host:start')).ok, true);
    room.state.phase.stage = 'gameOver';
    const votes = [{ enjoyment: 5, rematch: true },{ enjoyment: 4, rematch: true },{ enjoyment: 2, rematch: false }];
    for (let i=0; i<2; i++) {
      assert.equal((await players[i].ask('playtest:feedback', votes[i])).ok, true);
      const privateView = mgr.viewFor(room, players[i]);
      assert.equal(privateView.meta.feedbackSubmitted, true);
      assert.equal(privateView.meta.playtest?.mean, undefined, 'no figures until 3 replies');
      assert.equal(mgr.viewFor(room, host).meta.playtest, undefined, 'TV cannot see ratings');
      assert.equal(mgr.viewFor(room, players[1]).meta.playtest, undefined, 'other gardener cannot see totals');
    }
    assert.deepEqual(await players[1].ask('playtest:feedback', votes[1]), { ok: true, alreadyRecorded: true }, 'lost ack retry is idempotent');
    assert.equal((await players[1].ask('playtest:feedback', votes[0])).ok, false, 'seat cannot change submitted rating');
    assert.equal((await players[2].ask('playtest:feedback', { enjoyment: 3, rematch: false, name: 'leak' })).ok, false);
    assert.equal((await players[2].ask('playtest:feedback', votes[2])).ok, true);
    const aggregate = groupedFeedback(room);
    assert.deepEqual(aggregate, { count: 3, players: 3, minimum: 3, mean: 3.7, wouldRematch: 2 });
    const view = mgr.viewFor(room, players[0]);
    assert.deepEqual(view.meta.playtest, aggregate);
    assert.equal(mgr.viewFor(room, players[2]).meta.playtest, undefined);
    assert.equal(mgr.viewFor(room, host).meta.playtest, undefined);
    for (const player of players) assert.equal(player.latest('state')?.meta?.playtest === undefined || player === players[0], true);
    const publicData = JSON.stringify(host.latest('state'));
    assert.doesNotMatch(publicData, /feedbackSubmitted|playtest|enjoyment|wouldRematch/);
    console.log('  ✔ one authenticated vote per seat, host-only aggregate after three; never on TV');

    mgr.saveAll();
    const saved = JSON.parse(fs.readFileSync(path.join(dir, room.code + '.json'), 'utf8'));
    assert.equal(saved.feedback, undefined, 'survey not persisted to disk');
    assert.doesNotMatch(JSON.stringify(saved), /"wouldRematch"|"enjoyment"/);
    assert.equal(mgr.rematch(room), null);
    assert.equal(room.feedback.size, 0, 'rematch clears all votes');
    assert.equal(mgr.viewFor(room, players[0]).meta.playtest, undefined);
    assert.equal((await players[0].ask('playtest:feedback', votes[0])).ok, false, 'no votes in lobby');
    console.log('  ✔ answers are ephemeral, never saved; rematches start with empty pulse');
  } finally { clearTimeout(room?.saveTimer); fs.rmSync(dir, { recursive: true, force: true }); }

  const game = fs.readFileSync(path.join(__dirname, '../public/v2/play.html'), 'utf8');
  const src = [...game.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
  assert.ok(src.length); src.forEach(s => new vm.Script(s));
  assert.match(game, /aria-label="Enjoyment rating"/);
  assert.match(game, /aria-pressed="\$\{ui\.pulseRating === n\}"/);
  assert.match(game, /playtest:feedback/);
  assert.match(game, /mean === undefined/);
  assert.match(game, /Copy group totals/);
  assert.match(game, /renderPlaytestPulse\(\)/);
  assert.match(game, /renderPlaytestTotals\(\)/);
  console.log('  ✔ phone rating UI is optional, accessible and copied output is aggregate-only');
  console.log('✔ All Phase 8 playtest-feedback contracts passed');
})().catch(e=>{ console.error(e); process.exitCode = 1; });
