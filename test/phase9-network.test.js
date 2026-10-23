'use strict';
/* Phase 9: full games over real Socket.io transport (not mocked sockets).
   2–8 player counts x Standard/Extended/Epic; deterministic test-only seeds. */
const assert = require('node:assert/strict');
const { io: connect } = require('socket.io-client');
const { startServer } = require('../server/index');
const CONTENT = require('../src/data/v2.json');

const SEATS = [2, 3, 4, 5, 6, 7, 8];
const MODES = ['standard', 'long', 'epic'];
const GODS = ['thor', 'freya', 'hel', 'odin', 'loki', 'frigg', 'njord', 'heimdall'];
const RATE = { capacity: 100000, refillPerSec: 100000 };
const FAST = { omensSec: 0.1, resolveMinSec: 0.1, resolvePerEventSec: 0.001,
  resolveMaxSec: 0.2, disastersSec: 0.1, harvestSec: 0.1, showSec: 0.1,
  draftSec: 30, planSec: 30 };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(predicate, label, ms = 5000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (predicate()) return;
    await sleep(5);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function phone(url, label, clients, faults) {
  const socket = connect(url, { transports: ['websocket'], forceNew: true,
    reconnection: false, timeout: 4000 });
  const c = { socket, label, view: null, token: null, seat: null };
  clients.push(c);
  socket.on('state', view => {
    if ('secrets' in view || view.players.some(p => 'hand' in p))
      faults.push(`${label}: private engine data leaked`);
    if (c.seat !== null && view.me && view.me.seat !== c.seat)
      faults.push(`${label}: received another player's private view`);
    if (view.sympathy?.options && (c.seat === null || view.sympathy.chooser !== c.seat))
      faults.push(`${label}: received someone else's Sympathy choices`);
    if (c.seat !== 0 && view.meta?.playtest)
      faults.push(`${label}: received host-only feedback totals`);
    c.view = view;
  });
  await new Promise((resolve, reject) => {
    if (socket.connected) return resolve();
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
    socket.once('disconnect', reason => reject(new Error(`${label} disconnected during join: ${reason}`)));
  });
  return c;
}
function rpc(c, name, payload = {}) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${c.label}: no ${name} ACK`)), 4000);
    c.socket.emit(name, payload, reply => { clearTimeout(timer); resolve(reply); });
  });
}
async function ok(c, event, payload) {
  const result = await rpc(c, event, payload);
  assert.equal(result.ok, true, `${c.label} ${event}: ${result.error || 'not accepted'}`);
  return result;
}

async function scenario(n, mode) {
  const clients = [], faults = [];
  const srv = await startServer({ port: 0, quiet: true, rules: 'v2', tickMs: 3600000,
    rate: RATE, gameSeed: 0x9261000 + n * 3 + MODES.indexOf(mode), gameConfig: FAST });
  const url = `http://127.0.0.1:${srv.port}`;
  try {
    const tv = await phone(url, `TV-${n}-${mode}`, clients, faults);
    const created = await ok(tv, 'tv:create');
    assert.match(created.code, /^[A-HJ-NP-Z]{4}$/);
    assert.ok(created.joinUrl.endsWith(`/play?room=${created.code}`));
    assert.match(created.qr, /^data:image\/png;base64,/);
    const room = srv.rooms.get(created.code);
    const recovered = await ok(tv, 'tv:recover');
    assert.equal(recovered.hostKey, created.hostKey);
    assert.equal(recovered.code, created.code);
    assert.ok(room);
    const watcher = await phone(url, 'spectator', clients, faults);
    assert.equal((await ok(watcher, 'tv:attach', { code: created.code })).isHost, false);
    assert.equal((await rpc(watcher, 'host:start')).ok, false);
    assert.equal((await rpc(watcher, 'action', { type: 'lock' })).ok, false);
    const outsider = await phone(url, 'outsider', clients, faults);
    assert.equal((await rpc(outsider, 'state:request')).ok, false);
    assert.equal((await rpc(outsider, 'host:close')).ok, false);
    assert.equal((await rpc(outsider, 'player:join', {
      code: created.code, name: 'X'.repeat(2000) })).ok, false);

    const controllers = [];
    for (let i = 0; i < n; i++) {
      const c = await phone(url, `P${i}`, clients, faults);
      const joined = await ok(c, 'player:join', { code: created.code, name: `Gardener ${i}` });
      c.seat = joined.seat; c.token = joined.token;
      assert.equal(c.seat, i);
      controllers.push(c);
    }
    await waitFor(() => tv.view?.players?.length === n, 'joined players');
    assert.equal((await rpc(controllers[1], 'host:pause')).ok, false);
    await ok(controllers[0], 'action', { type: 'setOption', length: mode });
    assert.equal(room.state.config.length, mode);
    assert.equal((await rpc(controllers[1], 'action', { type: 'setOption', length: 'epic' })).ok, false);
    await ok(controllers[0], 'host:start');
    assert.equal((await rpc(controllers[0], 'host:start')).ok, false);
    assert.equal((await rpc(outsider, 'player:join', { code: created.code, name: 'Late' })).ok, false);

    while (room.state.phase.stage === 'draft') {
      const seat = room.state.phase.draftQueue[0];
      await ok(controllers[seat], 'action', {
        type: 'chooseGod', god: GODS[seat], requestId: `phase9-god-${n}-${seat}` });
    }
    let planEvents = 0, sympathyVotes = 0, wasReconnected = false, wasPaused = false;
    const maxCycles = CONTENT.lengths[mode].rounds * (n * 4 + 14) + 100;
    for (let cycles = 0; cycles < maxCycles && room.state.phase.stage !== 'gameOver'; cycles++) {
      const s = room.state;
      if (s.phase.step === 'plan') {
        if (!wasPaused) {
          const originalDeadline = s.phase.deadline;
          await ok(tv, 'host:pause');
          assert.equal((await rpc(controllers[1], 'action', { type: 'lock' })).ok, false);
          await ok(tv, 'host:resume');
          assert.ok(s.phase.deadline >= originalDeadline);
          wasPaused = true;
        }
        for (let i = 0; i < n; i++) {
          const id = `phase9-${mode}-${n}-r${s.round}-p${i}`;
          const slots = Array.from({ length: srv.rooms.E.slotCount(s) }, (_, j) =>
            ({ kind: 'carBoot', supplies: j % 2 ? ['compost', 'turf'] : ['turf', 'gnomeDust'] }));
          const cmd = { type: 'plan', slots, requestId: id };
          await ok(controllers[i], 'action', cmd);
          planEvents++;
          if (!wasReconnected && i === 1) {
            const prior = controllers[i];
            prior.socket.disconnect();
            await waitFor(() => !s.players[i].connected, 'disconnection state');
            const fresh = await phone(url, `${prior.label}-refresh`, clients, faults);
            fresh.seat = i; fresh.token = prior.token;
            await ok(fresh, 'player:rejoin', { code: created.code, token: fresh.token });
            await waitFor(() => fresh.view?.me?.plan?.length === slots.length, 'rejoined plan');
            controllers[i] = fresh;
            const before = s.stateVersion;
            await ok(fresh, 'action', cmd);
            assert.equal(s.stateVersion, before, 'duplicate mutated authoritative state');
            assert.equal((await rpc(fresh, 'action', { ...cmd, slots: [] })).ok, false);
            wasReconnected = true;
          }
          await ok(controllers[i], 'action', { type: 'lock', requestId: `${id}-lock` });
        }
      } else if (s.phase.step === 'sympathy') {
        const chooser = s.sympathy.chooser;
        assert.equal((await rpc(controllers[(chooser + 1) % n], 'action', {
          type: 'sympathyPick', category: s.sympathy.options[0] })).ok, false);
        await waitFor(() => controllers[chooser].view?.sympathy?.options?.length === 3,
          'private Sympathy options');
        await ok(controllers[chooser], 'action', {
          type: 'sympathyPick', category: s.sympathy.options[1] });
        sympathyVotes++;
      } else {
        assert.ok(Number.isFinite(s.phase.deadline), `No deadline in ${s.phase.step}`);
      }
      if (s.phase.stage !== 'gameOver' && s.phase.deadline)
        srv.rooms.tickAll(s.phase.deadline + 1);
    }
    assert.equal(room.state.phase.stage, 'gameOver', `${n}/${mode} did not finish`);
    assert.equal(room.state.round, CONTENT.lengths[mode].rounds);
    assert.ok(room.state.final?.winners?.length);
    assert.ok(planEvents >= n * CONTENT.lengths[mode].rounds);
    assert.ok(sympathyVotes >= 2);
    assert.ok(wasReconnected && wasPaused);
    assert.equal(room.series.gamesStarted, 1);
    assert.equal(room.series.gamesFinished, 1);
    assert.equal(room.series.rematchesStarted, 0);
    await waitFor(() => tv.view?.phase?.stage === 'gameOver', 'TV final state');
    assert.equal(tv.view.meta.playtest, undefined);
    assert.equal(controllers[1].view.meta.playtest, undefined);
    await ok(controllers[0], 'host:rematch');
    assert.equal(room.state.phase.stage, 'lobby');
    assert.equal(room.series.gamesStarted, 1);
    assert.equal(room.series.matchNumber, 2);
    await ok(controllers[0], 'host:start');
    assert.equal(room.series.rematchesStarted, 1);
    assert.equal(room.series.gamesStarted, 2);
    await ok(tv, 'host:close');
    assert.equal(srv.rooms.get(created.code), null);
    assert.deepEqual(faults, [], `wire-private-data failures: ${faults.join('; ')}`);
    console.log(`  ✔ ${n} controllers / ${mode}: ${room.series.gamesFinished} finished, ${planEvents} submitted plans, ${sympathyVotes} private votes, reconnect/rematch/cleanup`);
  } finally {
    clients.forEach(c => c.socket.disconnect());
    await srv.close();
  }
}
(async () => {
  console.log('Phase 9 actual Socket.io multiplayer matrix (21 complete games)');
  for (const mode of MODES) for (const seats of SEATS) await scenario(seats, mode);
  console.log('✔ All 21 real-network game configurations passed');
})().catch(err => { console.error('✘ Phase 9 live-network failure:', err.stack || err); process.exitCode = 1; });
