'use strict';
/* Phase 9: verified starts, completion idempotency, privacy and durable aggregate totals. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { RoomManager } = require('../server/rooms');
const { attachHandlers } = require('../server/handlers');

class Peer {
  constructor() {
    this.data = {};
    this.handshake = { headers: { host: 'localhost:3000' }, address: '127.0.0.1' };
    this.h = new Map(); this.messages = [];
  }
  on(event, fn) { this.h.set(event, fn); }
  emit(event, value) { this.messages.push({ event, value }); }
  ask(event, payload = {}) {
    return new Promise((resolve, reject) => {
      try { Promise.resolve(this.h.get(event)(payload, resolve)).catch(reject); }
      catch (err) { reject(err); }
    });
  }
  latest(event) { return this.messages.filter(m => m.event === event).at(-1)?.value; }
}

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ragnagrok-series-'));
  const managers = [];
  try {
    const manager = new RoomManager({ rules: 'v2', saveDir: dir, logger: { log() {}, error() {} } });
    managers.push(manager);
    const io = { on(_type, handler) { this.connect = handler; } };
    attachHandlers(io, manager, { qrCode: { toDataURL: async () => 'qr' },
      rate: { capacity: 1000, refillPerSec: 1000 } });
    const connect = () => { const socket = new Peer(); io.connect(socket); return socket; };
    const tv = connect();
    const created = await tv.ask('tv:create');
    assert.equal(created.ok, true);
    const phones = [connect(), connect(), connect()];
    for (let i = 0; i < phones.length; i++) {
      const joined = await phones[i].ask('player:join', { code: created.code, name: 'Tester ' + i });
      assert.equal(joined.ok, true);
    }
    const room = manager.get(created.code);
    assert.deepEqual(room.series, { matchNumber: 1, gamesStarted: 0, gamesFinished: 0, rematchesStarted: 0 });
    assert.equal((await phones[0].ask('host:start')).ok, true);
    assert.equal(room.series.gamesStarted, 1);
    assert.equal(room.series.rematchesStarted, 0);

    // Only mark phase-over to test bookkeeping. This is not a simulated player enjoyment result.
    room.state.phase.stage = 'gameOver';
    manager.sync(room);
    manager.sync(room);
    assert.equal(room.series.gamesFinished, 1, 'final state counted once');
    assert.equal(manager.viewFor(room, tv).meta.session, undefined, 'TV cannot see private session summary');
    assert.equal(manager.viewFor(room, phones[1]).meta.session, undefined, 'rival phone cannot see it');
    assert.equal(manager.viewFor(room, phones[0]).meta.session.gamesFinished, 1);
    assert.equal(manager.viewFor(room, tv).meta.matchNumber, 1);
    assert.doesNotMatch(JSON.stringify(tv.latest('state')), /"session":|"gamesStarted":/);

    assert.equal((await phones[0].ask('host:rematch')).ok, true);
    assert.equal(room.state.phase.stage, 'lobby');
    assert.equal(room.series.matchNumber, 2);
    assert.equal(room.series.rematchesStarted, 0, 'opening a lobby is not a rematch start');
    assert.equal((await phones[1].ask('host:start')).ok, false, 'rival cannot start');
    assert.equal(room.series.gamesStarted, 1);
    assert.equal((await phones[0].ask('host:start')).ok, true);
    assert.equal(room.series.gamesStarted, 2);
    assert.equal(room.series.rematchesStarted, 1);
    assert.equal((await phones[0].ask('host:start')).ok, false, 'duplicate start is rejected');
    assert.equal(room.series.rematchesStarted, 1);
    room.state.phase.stage = 'gameOver';
    manager.sync(room);
    assert.equal(room.series.gamesFinished, 2);
    assert.equal((await phones[1].ask('host:rematch')).ok, false);

    manager.saveAll();
    const filename = path.join(dir, room.code + '.json');
    const saved = JSON.parse(fs.readFileSync(filename, 'utf8'));
    assert.deepEqual(saved.series, room.series);
    assert.equal(saved.feedback, undefined, 'private enjoyment ratings are never persisted');

    const recovered = new RoomManager({ rules: 'v2', saveDir: dir, logger: { log() {}, error() {} } });
    managers.push(recovered);
    assert.equal(recovered.loadAll(), 1, 'durable game state is valid');
    assert.deepEqual(recovered.get(room.code).series, saved.series, 'session tally survives restart');

    // Schema-compatible older rooms lack the optional counters.
    delete saved.series;
    fs.writeFileSync(filename, JSON.stringify(saved));
    const legacy = new RoomManager({ rules: 'v2', saveDir: dir, logger: { log() {}, error() {} } });
    managers.push(legacy);
    assert.equal(legacy.loadAll(), 1);
    assert.deepEqual(legacy.get(room.code).series,
      { matchNumber: 1, gamesStarted: 1, gamesFinished: 1, rematchesStarted: 0 });

    saved.series = { matchNumber: 2, gamesStarted: -1, gamesFinished: 99, rematchesStarted: 3 };
    fs.writeFileSync(filename, JSON.stringify(saved));
    const corrupt = new RoomManager({ rules: 'v2', saveDir: dir, logger: { log() {}, error() {} } });
    managers.push(corrupt);
    assert.equal(corrupt.loadAll(), 0, 'corrupt counter objects are rejected');
    console.log('✔ match start counts, rematch gating, privacy, persistence and invalid-save rejection');
  } finally {
    for (const manager of managers) for (const room of manager.rooms.values()) clearTimeout(room.saveTimer);
    fs.rmSync(dir, { recursive: true, force: true });
  }

  const phone = fs.readFileSync(path.join(__dirname, '../public/v2/play.html'), 'utf8');
  const tv = fs.readFileSync(path.join(__dirname, '../public/v2/index.html'), 'utf8');
  for (const html of [phone, tv]) {
    for (const match of html.matchAll(/<script(?:\\s[^>]*)?>([\\s\\S]*?)<\\/script>/gi))
      new vm.Script(match[1]);
  }
  assert.ok(phone.includes('function renderSessionTotals()'));
  assert.ok(phone.includes('data-act="sessionCopy"'));
  assert.ok(phone.includes('matches_started,matches_completed,rematches_started'));
  assert.ok(tv.includes('Match ${view.meta.matchNumber}'));
  console.log('✔ TV and phone scripts parse and retain games-night controls');
})().catch(err => { console.error(err); process.exitCode = 1; });
