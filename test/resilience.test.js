'use strict';
/* Offline Socket.io protocol and room-lifecycle regression checks. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { validatePayload } = require('../server/payload-validation');
const { RoomManager } = require('../server/rooms');
const { attachHandlers } = require('../server/handlers');
const { fingerprint, LIMIT: CACHE_LIMIT } = require('../server/action-requests');

class Socket {
  constructor(address) {
    this.handshake = { headers: { host: 'localhost:3000' }, address };
    this.handlers = new Map();
    this.data = {};
    this.received = [];
  }
  on(event, fn) { this.handlers.set(event, fn); }
  emit(event, payload) { this.received.push({ event, payload }); }
  ask(event, payload) {
    return new Promise((resolve, reject) => {
      const handler = this.handlers.get(event);
      if (!handler) return reject(new Error('No handler for ' + event));
      try { Promise.resolve(handler(payload, resolve)).catch(reject); }
      catch (err) { reject(err); }
    });
  }
  disconnect() { this.handlers.get('disconnect')(); }
  latest(event) { return this.received.filter(m => m.event === event).at(-1)?.payload; }
}

async function main() {
  for (const input of [null, [], 'action', 33, { options: { __proto__: null, constructor: 'bad' } },
    { value: 'a'.repeat(2000) }, { count: Infinity }, { nested: { x: { y: { z: { too: { deep: true } } } } } }]) {
    assert.equal(validatePayload(input).ok, false, 'malformed or excessive payload refused');
  }
  assert.equal(validatePayload(undefined).ok, true, 'legacy no-argument events remain supported');
  assert.equal(validatePayload({ type: 'plan', slots: [{ kind: 'carBoot', supplies: ['turf'] }] }).ok, true);
  assert.equal(fingerprint({ type: 'plan', data: { foo: 1, bar: 2 } }),
    fingerprint({ data: { bar: 2, foo: 1 }, type: 'plan' }), 'semantic identity ignores object-key ordering');
  assert.notEqual(fingerprint({ type: 'lock' }), fingerprint({ type: 'plan' }));
  console.log('  ✔ malformed, oversized, nested and prototype-bearing commands rejected');

  const manager = new RoomManager({ rules: 'v2', idleMinutes: 1, logger: { log() {}, error() {} } });
  const io = { on(_event, callback) { this.connect = callback; } };
  attachHandlers(io, manager, { qrCode: { toDataURL: async () => 'data:image/png;base64,fake' },
    rate: { capacity: 1000, refillPerSec: 1000 } });
  const make = id => { const s = new Socket(id); io.connect(s); return s; };
  const tv = make('tv');
  const created = await tv.ask('tv:create', {});
  assert.equal(created.ok, true);
  const alice = make('alice'); const bob = make('bob');
  const a = await alice.ask('player:join', { code: created.code, name: 'Alice' });
  const b = await bob.ask('player:join', { code: created.code, name: 'Bob' });
  assert.equal(a.ok, true); assert.equal(b.ok, true);
  assert.equal((await tv.ask('host:start', {})).ok, true);
  const room = manager.get(created.code);
  const first = room.state.phase.draftQueue[0];
  const picker = first === a.seat ? alice : bob;
  const firstId = 'step_ABCDEFGHIJKLMNOP';
  assert.equal((await picker.ask('action', { type: 'chooseGod', god: 'freya', requestId: firstId })).ok, true);
  const afterFirst = room.state.stateVersion;
  assert.equal((await picker.ask('action', { type: 'chooseGod', god: 'freya', requestId: firstId })).ok, true);
  assert.equal(room.state.stateVersion, afterFirst, 'duplicate ACK retry must not change state');
  const collision = await picker.ask('action', { type: 'chooseGod', god: 'odin', requestId: firstId });
  assert.equal(collision.ok, false, 'same request ID with a different command must not return a cached success');
  assert.match(collision.error, /different action/);
  assert.equal(room.state.stateVersion, afterFirst, 'request ID collision cannot alter game state');
  const other = first === a.seat ? bob : alice;
  assert.equal((await other.ask('action', { type: 'chooseGod', god: 'thor', requestId: 'step_QRSTUVWXYZ123456' })).ok, true);
  assert.equal(room.state.phase.stage, 'playing');
  console.log('  ✔ identical retries are deduplicated, conflicting request IDs are rejected');

  assert.equal((await alice.ask('state:request', {})).ok, true);
  assert.ok(alice.latest('state'));
  const stranger = make('stranger');
  assert.equal((await stranger.ask('state:request', {})).ok, false);
  assert.equal((await alice.ask('action', [])).ok, false);
  assert.equal((await alice.ask('action', { type: 'plan', slots: new Array(55).fill('oops') })).ok, false);
  for (let i = 0; i < CACHE_LIMIT + 10; i++) {
    const invalid = await alice.ask('action', { type: 'nonexistent', requestId: `bounded_cache_${i.toString().padStart(5,'0')}` });
    assert.equal(invalid.ok, false);
  }
  assert.equal(room.actionReplies.size, CACHE_LIMIT, 'retry history is bounded');
  console.log('  ✔ state resync is authenticated; malformed commands are rejected; retry history stays bounded');

  const phase = room.state.phase.step;
  alice.disconnect(); bob.disconnect();
  assert.equal(room.paused?.auto, true, 'all players offline auto-pauses match');
  manager.tickAll(Date.now() + 5000);
  assert.equal(room.state.phase.step, phase, 'paused match does not advance on timer');
  const newAlice = make('rejoiningAlice');
  const newBob = make('rejoiningBob');
  assert.equal((await newAlice.ask('player:rejoin', { code: created.code, token: a.token })).ok, true);
  assert.equal(room.paused?.auto, true, 'one of two phones is not enough for automatic resume');
  assert.equal((await newBob.ask('player:rejoin', { code: created.code, token: b.token })).ok, true);
  assert.equal(room.paused, null, 'match resumes once all players return');
  console.log('  ✔ zero online controllers pauses the match; full reconnect resumes safely');

  // Persisted reply cache: a lost ACK followed by server restart must not
  // re-execute an already accepted command. An old ID cannot change meaning.
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'ragna-replies-'));
  try {
    const saving = new RoomManager({ rules: 'v2', saveDir: folder, logger: { log() {}, error() {} } });
    const sio = { on(_name, fn) { this.connect = fn; } };
    attachHandlers(sio, saving, { qrCode: { toDataURL: async () => 'qr' } });
    const newSocket = addr => { const s = new Socket(addr); sio.connect(s); return s; };
    const t = newSocket('tvSaved');
    const made = await t.ask('tv:create', {});
    const p1 = newSocket('savedP1'), p2 = newSocket('savedP2');
    const j1 = await p1.ask('player:join', { code: made.code, name: 'One' });
    const j2 = await p2.ask('player:join', { code: made.code, name: 'Two' });
    assert.equal((await t.ask('host:start', {})).ok, true);
    const savedRoom = saving.get(made.code);
    const activeSeat = savedRoom.state.phase.draftQueue[0];
    const participant = activeSeat === j1.seat ? p1 : p2;
    const unique = 'restart_id_123456789';
    const original = { type: 'chooseGod', god: 'freya', requestId: unique };
    assert.equal((await participant.ask('action', original)).ok, true);
    saving.saveAll();
    const reread = new RoomManager({ rules: 'v2', saveDir: folder, logger: { log() {}, error() {} } });
    assert.equal(reread.loadAll(), 1);
    const restoredRoom = reread.get(made.code);
    assert.equal(restoredRoom.actionReplies.size, 1, 'accepted action reply survives restart');
    assert.equal(restoredRoom.paused?.auto, true, 'in-progress restoration starts paused');
    const rio = { on(_name, fn) { this.connect = fn; } };
    attachHandlers(rio, reread, { qrCode: { toDataURL: async () => 'qr' } });
    const reSocket = addr => { const s = new Socket(addr); rio.connect(s); return s; };
    const pa = reSocket('restoredA'), pb = reSocket('restoredB');
    assert.equal((await pa.ask('player:rejoin', { code: made.code, token: j1.token })).ok, true);
    assert.equal((await pb.ask('player:rejoin', { code: made.code, token: j2.token })).ok, true);
    assert.equal(restoredRoom.paused, null, 'all players restored, match automatically resumes');
    const replay = activeSeat === j1.seat ? pa : pb;
    const savedVersion = restoredRoom.state.stateVersion;
    assert.equal((await replay.ask('action', original)).ok, true, 'lost ACK is recoverable after restart');
    assert.equal(restoredRoom.state.stateVersion, savedVersion, 'replayed action cannot execute twice');
    assert.equal((await replay.ask('action', { ...original, god: 'odin' })).ok, false);
    assert.equal(restoredRoom.state.stateVersion, savedVersion);
    assert.equal((await pa.ask('state:request', {})).ok, true, 'state snapshot available after restart');
    const data = JSON.parse(fs.readFileSync(path.join(folder, made.code + '.json'), 'utf8'));
    data.actionReplies = [['0:restart_id_123456789', { fingerprint: 'not-a-hash', reply: { ok: true } }]];
    fs.writeFileSync(path.join(folder, made.code + '.json'), JSON.stringify(data));
    const tampered = new RoomManager({ rules: 'v2', saveDir: folder, logger: { log() {}, error() {} } });
    assert.equal(tampered.loadAll(), 0, 'invalid persisted command cache must be quarantined');
    assert.ok(fs.existsSync(path.join(folder, 'corrupt', made.code + '.json')));
    console.log('  ✔ accepted request IDs persist across restarts; tampered cache is quarantined');
  } finally { fs.rmSync(folder, { recursive: true, force: true }); }

  newAlice.disconnect(); newBob.disconnect();
  assert.match(manager.resume(room), /Wait for a player/, 'host cannot resume when no controllers exist');
  manager.tickAll(Date.now() + 2 * 60 * 1000);
  assert.equal(manager.get(created.code), null, 'auto-paused abandoned room is cleaned up even when TV remains connected');
  assert.equal(room.sockets.size, 0, 'closed room releases its socket references');
  assert.equal(tv.data.code, null, 'host is unbound after room removal');
  assert.equal(tv.data.isHost, false, 'host rights are revoked on closure');
  assert.equal((await tv.ask('host:pause', {})).ok, false, 'closed-room socket cannot issue host commands');
  tv.disconnect();
  console.log('  ✔ even TV-attached abandoned rooms expire after the configured idle threshold');
}
main().catch(err => { console.error(err); process.exitCode = 1; });
