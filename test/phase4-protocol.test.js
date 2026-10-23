'use strict';
/* Full-game protocol acceptance without third-party networking libraries.
   Uses real handlers, real rooms, real authoritative garden engine, real
   per-seat private projections. Fake sockets exercise server APIs, NOT a
   claimed Socket.io transport/live-network test. */
const assert = require('node:assert/strict');
const { RoomManager } = require('../server/rooms');
const { attachHandlers } = require('../server/handlers');

class FakeSocket {
  constructor(label) {
    this.label = label;
    this.data = {};
    this.handshake = { headers: { host: 'localhost:3000' }, address: label };
    this.listeners = new Map();
    this.outbox = [];
    this.closed = false;
  }
  on(name, cb) { this.listeners.set(name, cb); }
  emit(name, data) { this.outbox.push({ name, data }); }
  async ask(name, data = {}) {
    const listener = this.listeners.get(name);
    assert.ok(listener, `missing ${name}`);
    return new Promise((resolve, reject) => {
      try { Promise.resolve(listener(data, resolve)).catch(reject); }
      catch (e) { reject(e); }
    });
  }
  disconnect() {
    if (this.closed) return;
    this.closed = true;
    this.listeners.get('disconnect')();
  }
  latest(name) { return this.outbox.filter(m => m.name === name).at(-1)?.data; }
}

async function main() {
  const originalNow = Date.now;
  const seatCount = Number(process.argv[2] || process.env.RAGNA_PLAYERS || 4);
  assert.ok([2,4,6,8].includes(seatCount));
  let now = 1_730_000_000_000;
  Date.now = () => now;
  try {
    const manager = new RoomManager({ rules: 'v2', logger: { log() {}, error() {} } });
    const transport = { on(name, fn) { assert.equal(name, 'connection'); this.connect = fn; } };
    attachHandlers(transport, manager, { qrCode: { toDataURL: async () => 'data:image/png;base64,AA==' },
      rate: { capacity: 1000, refillPerSec: 1000 } });
    const sock = name => { const s = new FakeSocket(name); transport.connect(s); return s; };
    const hostScreen = sock('TV');
    const created = await hostScreen.ask('tv:create');
    assert.equal(created.ok, true);
    const phones = [], tokens = [];
    for (let i = 0; i < seatCount; i++) {
      const p = sock(`phone${i}`), joined = await p.ask('player:join', { code: created.code, name: `Gardener ${i}` });
      assert.equal(joined.ok, true);
      phones.push(p); tokens.push(joined.token);
    }
    assert.equal((await phones[1].ask('host:pause')).ok, false, 'nonhost cannot pause');
    assert.equal((await hostScreen.ask('host:start')).ok, true);
    let room = manager.get(created.code);
    const gods = ['loki', 'freya', 'odin', 'thor', 'hel', 'frigg', 'njord', 'heimdall'];
    while (room.state.phase.stage === 'draft') {
      const seat = room.state.phase.draftQueue[0];
      assert.equal((await phones[seat].ask('action', { type: 'chooseGod', god: gods[seat], requestId: `choose_${seat}_12345678` })).ok, true);
    }
    assert.ok(hostScreen.latest('state').board, 'TV sees public board');
    assert.equal(hostScreen.latest('state').secrets, undefined, 'TV never sees private plan tokens');
    assert.equal(phones[0].latest('state').me.seat, 0, 'seat zero receives private view');
    assert.equal(phones[1].latest('state').me.seat, 1, 'seat one receives its own private view');
    assert.equal(phones[0].latest('state').secrets, undefined, 'phone receives projections, not raw secrets');

    // First round: lose one connection while planning, retain a planned action.
    let disconnectedOnce = false, praySubmitted = false, actionCount = 0;
    for (let cycles = 0; cycles < 300 && room.state.phase.stage !== 'gameOver'; cycles++) {
      if (room.state.phase.step === 'plan') {
        if (!disconnectedOnce) {
          const plan = { type: 'plan', slots: [{ kind: 'carBoot', supplies: ['turf', 'turf'] }, { kind: 'carBoot', supplies: ['compost', 'compost'] }], requestId: 'pre_disconnect_plan_0001' };
          assert.equal((await phones[1].ask('action', plan)).ok, true);
          const expected = room.state.secrets.plans[1].map(x => x.kind);
          phones[1].disconnect();
          assert.equal(room.state.players[1].connected, false);
          const replacement = sock('replacement1');
          const rejoin = await replacement.ask('player:rejoin', { code: room.code, token: tokens[1] });
          assert.equal(rejoin.ok, true);
          phones[1] = replacement;
          assert.deepEqual(replacement.latest('state').me.plan.map(x => x.kind), expected);
          const before = room.state.stateVersion;
          const again = await replacement.ask('action', plan);
          assert.equal(again.ok, true, 'same plan retry returns cached ACK');
          assert.equal(room.state.stateVersion, before, 'duplicate plan cannot mutate the engine');
          disconnectedOnce = true;
        }
        for (let seat = 0; seat < seatCount && room.state.phase.step === 'plan'; seat++) {
          let slots = room.state.secrets.plans[seat];
          if (!slots || !slots.length) {
            slots = Array.from({ length: manager.E.slotCount(room.state) }, (_, i) =>
              ({ kind: 'carBoot', supplies: [i % 2 ? 'compost' : 'turf', 'gnomeDust'] }));
            if (seat === 0 && !praySubmitted) {
              const forecast = room.state.forecast.now;
              const topo = manager.E.clientTopology(room.state.board.layoutId);
              const owned = new Set(room.state.board.plots.filter(p => p.owner === seat).map(p => p.id));
              outer: for (let index = 0; index < forecast.length; index++) {
                for (const target of forecast[index].plots) {
                  const hex = topo.hexes.find(h => h.id === target);
                  const to = hex?.neighbors.find(id => !forecast[index].plots.includes(id) &&
                    !room.state.board.plots.some(p => p.id === id && p.owner !== null && room.state.players[p.owner].god === 'heimdall'));
                  if (to) {
                    slots[0] = { kind: 'pray', index, target, to };
                    praySubmitted = true;
                    break outer;
                  }
                }
              }
            }
            const submitted = await phones[seat].ask('action', { type: 'plan', slots, requestId: `round_${room.state.round}_seat_${seat}_planning` });
            assert.equal(submitted.ok, true, submitted.error);
            actionCount++;
          }
          const committed = await phones[seat].ask('action', { type: 'lock', requestId: `round_${room.state.round}_seat_${seat}_lock` });
          assert.equal(committed.ok, true, committed.error);
        }
      } else if (room.state.phase.step === 'sympathy') {
        const category = room.state.sympathy.options[2];
        const chooser = room.state.sympathy.chooser;
        assert.equal(hostScreen.latest('state').sympathy.options, undefined,
          'TV must not see Sympathy Vote options before choice');
        assert.deepEqual(phones[chooser].latest('state').sympathy.options,
          room.state.sympathy.options, 'chooser alone can see the three options');
        for (let opponent = 0; opponent < seatCount; opponent++) {
          if (opponent !== chooser)
            assert.equal(phones[opponent].latest('state').sympathy.options, undefined,
              'rival phones must not receive Sympathy Vote options');
        }
        const res = await phones[chooser].ask('action', { type: 'sympathyPick', category,
          requestId: `sympathy_${room.state.round}_choice` });
        assert.equal(res.ok, true, res.error);
      } else {
        assert.ok(Number.isFinite(room.state.phase.deadline), 'active phase must have deadline');
        now = Math.max(now + 1, room.state.phase.deadline + 1);
        manager.tickAll(now);
      }
      assert.ok(room.state.players.every(p => Object.values(p.hand).every(n => Number.isInteger(n) && n >= 0)), 'resource invariant');
    }
    assert.equal(room.state.phase.stage, 'gameOver', 'protocol must complete a full Standard match');
    assert.equal(room.state.round, 9, 'Standard ends after round nine');
    assert.ok(room.state.final.winners.length >= 1, 'end has a winner');
    assert.ok(disconnectedOnce && praySubmitted && actionCount > 0);
    assert.equal((await phones[0].ask('host:rematch')).ok, true);
    assert.equal(room.state.phase.stage, 'lobby', 'rematch returns all players to lobby');
    assert.equal(room.state.players.length, seatCount, 'rematch retains seats');
    assert.equal(room.actionReplies.size, 0, 'rematch clears cached action IDs');
    console.log(`  ✔ real engine + real handlers: ${seatCount} controllers, ${actionCount} plans, full 9-round match and rematch`);
    console.log('  ✔ authenticated reconnect retained plan, retry idempotent, no private state leaked');
    console.log('  ✔ Pray, Sympathy Vote, timer resolution and final scoring handled through protocol');
  } finally { Date.now = originalNow; }
}
main().catch(err => { console.error(err); process.exitCode = 1; });
