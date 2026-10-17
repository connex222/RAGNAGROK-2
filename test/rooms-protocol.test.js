'use strict';
/* In-process multiplayer protocol and persistence tests. No npm packages needed.
   Uses the real room manager, real V2 rules and real Socket.io event handlers,
   with an injected QR generator and a transport stub in place of the network. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { RoomManager } = require('../server/rooms');
const { attachHandlers } = require('../server/handlers');
const { joinBase } = require('../server/network');

class Socket {
  constructor(address) {
    this.handshake = { headers: {}, address };
    this.handlers = new Map();
    this.received = [];
  }
  on(event, fn) { this.handlers.set(event, fn); }
  emit(event, payload) { this.received.push({ event, payload }); }
  async ask(event, payload = {}) {
    const fn = this.handlers.get(event);
    assert.ok(fn, `Unregistered command ${event}`);
    return new Promise((resolve, reject) => {
      let replied = false;
      const ack = value => { replied = true; resolve(value); };
      try {
        Promise.resolve(fn(payload, ack)).then(() => { if (!replied) reject(new Error('Missing ACK for ' + event)); }, reject);
      } catch (err) { reject(err); }
    });
  }
  disconnect() { this.handlers.get('disconnect')(); }
  latest(event) { return this.received.filter(e => e.event === event).at(-1)?.payload; }
}
const fakeQRCode = { toDataURL: async () => 'data:image/png;base64,stub' };
const logger = { log() {}, error() {} };

function testJoinUrlProxyTrust() {
  const headers = { host: '192.168.200.12:3000', 'x-forwarded-host': 'attacker.example', 'x-forwarded-proto': 'https' };
  assert.equal(joinBase(headers, {}, {}), 'http://192.168.200.12:3000', 'ignore untrusted forwarded host and scheme');
  assert.equal(joinBase(headers, { TRUST_PROXY: '1' }, {}), 'https://attacker.example', 'configured trusted proxy headers are used');
  assert.equal(joinBase({ host: 'garden.example', origin: 'https://garden.example', 'x-forwarded-host': 'evil.example' }, {}, {}), 'https://garden.example', 'same-origin HTTPS can be inferred safely');
  assert.equal(joinBase({ host: 'garden.example', origin: 'https://evil.example' }, {}, {}), 'http://garden.example', 'cross-origin HTTPS cannot influence join links');
  assert.equal(joinBase(headers, { PUBLIC_URL: 'https://garden.example/' }, {}), 'https://garden.example', 'explicit public URL wins');
  console.log('  ✔ untrusted proxy headers cannot change join links');
}

async function main() {
  testJoinUrlProxyTrust();
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'ragnagrok-room-protocol-'));
  try {
    // A saved room may have been intentionally skipped by MAX_ROOMS. Its code
    // must remain reserved even though it is not in the active room map.
    const dormant = new RoomManager({ rules: 'v2', saveDir: folder, logger });
    fs.writeFileSync(path.join(folder, 'AAAA.json'), '{"dormant":true}');
    const crypto = require('node:crypto');
    const randomInt = crypto.randomInt;
    let picks = 0;
    try {
      crypto.randomInt = () => (picks++ < 4 ? 0 : 1);
      assert.equal(dormant.newCode(), 'BBBB', 'saved AAAA must not be overwritten');
    } finally { crypto.randomInt = randomInt; }
    fs.rmSync(path.join(folder, 'AAAA.json'));
    console.log('  ✔ dormant saved room codes remain reserved during new room creation');

    // QR generation can be pending or fail. Neither condition may allocate
    // multiple rooms from the same TV or leak inaccessible rooms.
    const qrRooms = new RoomManager({ rules: 'v2', logger });
    let releaseQr;
    const pendingQr = new Promise(resolve => { releaseQr = resolve; });
    const qrIo = { on(_name, fn) { this.connect = fn; } };
    attachHandlers(qrIo, qrRooms, { qrCode: { toDataURL: () => pendingQr } });
    const qrTv = new Socket('pending-qr'); qrIo.connect(qrTv);
    const creating = qrTv.ask('tv:create');
    assert.equal((await qrTv.ask('tv:create')).ok, false, 'second overlapping create refused');
    assert.equal((await qrTv.ask('tv:attach', { code: [...qrRooms.rooms.keys()][0] })).ok, false,
      'attachment refused while creation is pending');
    assert.equal(qrRooms.rooms.size, 1);
    releaseQr('data:image/png;base64,stub');
    assert.equal((await creating).ok, true);
    assert.equal(qrRooms.rooms.size, 1);
    console.log('  ✔ overlapping QR generation never creates orphan rooms');

    const failedQrRooms = new RoomManager({ rules: 'v2', logger });
    const failedIo = { on(_name, fn) { this.connect = fn; } };
    attachHandlers(failedIo, failedQrRooms, { qrCode: { toDataURL: async () => { throw Error('QR unavailable'); } } });
    const failedTv = new Socket('bad-qr'); failedIo.connect(failedTv);
    const oldError = console.error;
    let failure;
    try { console.error = () => {}; failure = await failedTv.ask('tv:create'); }
    finally { console.error = oldError; }
    assert.equal(failure.ok, false);
    assert.equal(failedQrRooms.rooms.size, 0, 'failed QR must release capacity');
    assert.equal(failedTv.data.code, null, 'failed QR must leave TV unattached');
    console.log('  ✔ QR encoding errors release rooms and leave TV free');

    const rooms = new RoomManager({ rules: 'v2', saveDir: folder, logger });
    const io = { on(event, fn) { assert.equal(event, 'connection'); this.connect = fn; } };
    attachHandlers(io, rooms, { qrCode: fakeQRCode, rate: { capacity: 1000, refillPerSec: 1000 } });
    const make = addr => { const socket = new Socket(addr); io.connect(socket); return socket; };
    const tv = make('tv');
    const created = await tv.ask('tv:create');
    assert.ok(created.ok && created.code && created.hostKey);
    assert.equal((await tv.ask('tv:create')).ok, false, 'cannot flood new rooms from a bound socket');
    assert.equal(rooms.rooms.size, 1);
    const hostRecovery = await tv.ask('tv:recover');
    assert.equal(hostRecovery.ok, true);
    assert.equal(hostRecovery.code, created.code);
    assert.equal(hostRecovery.hostKey, created.hostKey, 'authenticated TV can recover a lost host-key ACK');
    console.log('  ✔ TV host can recover a lost creation acknowledgement securely');
    console.log('  ✔ creating the same TV room twice is rejected');
    const limited = new RoomManager({ rules: 'v2', maxRooms: 1, logger });
    const limitedIO = { on(_event, fn) { this.connect = fn; } };
    attachHandlers(limitedIO, limited, { qrCode: fakeQRCode });
    const tvOne = new Socket('otherTV1'); limitedIO.connect(tvOne);
    const tvTwo = new Socket('otherTV2'); limitedIO.connect(tvTwo);
    assert.equal((await tvOne.ask('tv:create')).ok, true);
    const denied = await tvTwo.ask('tv:create');
    assert.equal(denied.ok, false);
    assert.match(denied.error, /full/);
    assert.equal(limited.rooms.size, 1);
    console.log('  ✔ room limits refuse excess matches without crashing');

    const a = make('a');
    assert.equal((await a.ask('tv:recover')).ok, false, 'unbound client cannot recover TV host key');
    const aj = await a.ask('player:join', { code: created.code, name: 'Alice' });
    assert.equal((await a.ask('tv:recover')).ok, false, 'player cannot recover TV host key');
    assert.ok(aj.ok);
    assert.equal((await a.ask('player:join', { code: created.code, name: 'Extra' })).ok, false);
    assert.equal(rooms.get(created.code).state.players.length, 1);
    assert.equal((await a.ask('tv:attach', { code: created.code, hostKey: created.hostKey })).ok, false);
    console.log('  ✔ a phone cannot join twice or turn itself into a host TV');

    const b = make('b');
    const bj = await b.ask('player:join', { code: created.code, name: 'Bob' });
    assert.ok(bj.ok);
    const newB = make('newB');
    assert.deepEqual(await newB.ask('player:rejoin', { code: created.code, token: bj.token }), { ok: true, seat: 1, code: created.code });
    assert.ok(b.latest('sessionReplaced'), 'previous device is informed');
    assert.equal(b.data.code, null, 'old device is removed from the room');
    assert.equal((await b.ask('action', { type: 'start' })).ok, false, 'old device can no longer act');
    assert.equal(rooms.get(created.code).state.players[1].connected, true);
    assert.equal((await a.ask('player:rejoin', { code: created.code, token: bj.token })).ok, false, 'bound phone cannot switch seats');
    assert.equal((await newB.ask('player:rejoin', { code: created.code, token: bj.token })).ok, true, 'idempotent reconnect');
    console.log('  ✔ only one phone can control a seat; stale sockets lose permission');

    const started = await tv.ask('host:start');
    assert.ok(started.ok);
    const state = rooms.get(created.code).state;
    assert.equal(state.phase.stage, 'draft');
    assert.equal((await newB.ask('action', { type: 'chooseGod', god: 'freya' })).ok, true);
    assert.equal((await a.ask('action', { type: 'chooseGod', god: 'thor' })).ok, true);
    assert.equal(state.phase.stage, 'playing');
    const actualRoom = rooms.get(created.code);
    rooms.E.tick(state, state.phase.deadline);
    assert.equal(state.phase.step, 'plan');
    const before = state.phase.deadline;
    rooms.E.setConnected(state, 1, false, before - 2000);
    assert.equal(rooms.pause(actualRoom, before - 1000), null);
    assert.equal(rooms.resume(actualRoom, before + 59000), null);
    assert.equal(state.phase.deadline, before + 60000);
    assert.equal(state.players[1].disconnectedAt, before + 58000, 'disconnect grace moved with pause');
    rooms.E.tick(state, state.phase.deadline);
    assert.equal(state.phase.step, 'plan', 'disconnected player gets remaining grace after resume');
    console.log('  ✔ pausing preserves the planning timer and disconnected-player grace');

    // Persist the real game and load into a clean room manager.
    rooms.saveAll();
    if (process.platform !== 'win32') {
      assert.equal(fs.statSync(path.join(folder, `${created.code}.json`)).mode & 0o777, 0o600,
        'saved player and host session tokens must not be world-readable');
      console.log('  ✔ saved session credentials have restricted file permissions');
    }
    const restored = new RoomManager({ rules: 'v2', saveDir: folder, logger });
    assert.equal(restored.loadAll(), 1);
    const r = restored.get(created.code);
    assert.ok(r?.paused, 'a restarted active game pauses for reconnect');
    assert.equal(r.state.players.length, 2);
    assert.equal(r.state.players.filter(p => p.connected).length, 0);
    assert.equal(r.state.schemaVersion, rooms.E.SCHEMA_VERSION);
    console.log('  ✔ real in-progress match persists and restores paused');

    // A corrupted save with the right version should never enter the live room map.
    const broken = { format: 'ragnagrok.room', version: 1, code: 'BADX', hostKey: 'x',
      state: { schemaVersion: rooms.E.SCHEMA_VERSION, phase: { stage: 'playing', step: 'plan' }, players: [] } };
    fs.writeFileSync(path.join(folder, 'BADX.json'), JSON.stringify(broken));
    const next = new RoomManager({ rules: 'v2', saveDir: folder, logger });
    const loaded = next.loadAll();
    assert.equal(loaded, 1, 'corrupted state must be excluded');
    assert.equal(next.get('BADX'), null);
    next.tickAll(Date.now());
    assert.ok(fs.existsSync(path.join(folder, 'corrupt', 'BADX.json')));
    console.log('  ✔ corrupted saves cannot crash the server timer');
    // Broken JSON is also isolated, not retried every server restart.
    fs.writeFileSync(path.join(folder, 'BADE.json'), '{\"state\":');
    const afterBadJson = new RoomManager({ rules: 'v2', saveDir: folder, logger });
    assert.equal(afterBadJson.loadAll(), 1);
    assert.ok(fs.existsSync(path.join(folder, 'corrupt', 'BADE.json')));
    console.log('  ✔ malformed JSON saves are quarantined instead of retried');

    // An operator lowering MAX_ROOMS must not inadvertently restore more than
    // the allowed number of active sessions; extra saves remain on disk.
    const overflow = new RoomManager({ rules: 'v2', saveDir: folder, logger });
    const extraRoom = overflow.create();
    overflow.saveNow(extraRoom);
    const capped = new RoomManager({ rules: 'v2', saveDir: folder, maxRooms: 1, logger });
    assert.equal(capped.loadAll(), 1, 'respect restore capacity');
    assert.equal(capped.rooms.size, 1);
    assert.ok(fs.existsSync(path.join(folder, `${extraRoom.code}.json`)), 'over-capacity save remains available');
    console.log('  ✔ restore obeys MAX_ROOMS without deleting excess valid saves');


    // V1 remains independently playable and its legitimate saves should load.
    const v1Folder = path.join(folder, 'legacy');
    const legacy = new RoomManager({ rules: 'v1', saveDir: v1Folder, logger });
    const old = legacy.create();
    assert.ok(legacy.E.addPlayer(old.state, { name: 'First' }).ok);
    assert.ok(legacy.E.addPlayer(old.state, { name: 'Second' }).ok);
    assert.ok(legacy.E.apply(old.state, 0, { type: 'start' }).ok);
    legacy.saveAll();
    const v1Restored = new RoomManager({ rules: 'v1', saveDir: v1Folder, logger });
    assert.equal(v1Restored.loadAll(), 1);
    assert.equal(v1Restored.get(old.code).state.phase.stage, 'factions');
    console.log('  ✔ archived V1 saved games remain restorable');
    console.log('✔ All dependency-free protocol checks passed');
  } finally { fs.rmSync(folder, { force: true, recursive: true }); }
}
main().catch(err => { console.error(err); process.exitCode = 1; });
