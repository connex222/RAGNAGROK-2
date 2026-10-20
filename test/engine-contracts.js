'use strict';
/* Framework-neutral engine assertions. Run offline or through Vitest wrappers. */
const assert = require('node:assert/strict');
const rng = require('../src/engine/rng');
const { generateBoard, LAYOUTS, RESOURCES } = require('../src/engine/board');
const { getTopology } = require('../src/engine/topology');
const v1 = require('../src/engine/rules');
const v2 = require('../src/engine/garden');

const randFor = seed => { const st = { s: seed }; return () => rng.next(st); };
function seededV1(seed) {
  const state = v1.createGame({ seed, roomCode: 'TEST', now: 1000 });
  v1.addPlayer(state, { name: 'Alice' }, 1000);
  v1.addPlayer(state, { name: 'Bob' }, 1000);
  return state;
}
function seededV2(seed) {
  const state = v2.createGame({ seed, roomCode: 'TEST', now: 1000 });
  v2.addPlayer(state, { name: 'Alice' }, 1000);
  v2.addPlayer(state, { name: 'Bob' }, 1000);
  return state;
}

const cases = [
  ['RNG: fixed seed has an exact regression sequence', () => {
    const s = { s: 42 };
    assert.deepEqual([rng.next(s), rng.next(s), rng.next(s)],
      [0.6011037519201636, 0.44829055899754167, 0.8524657934904099]);
    assert.equal(s.s, 1199730185);
  }],
  ['RNG: values are within [0,1) and integer rolls have valid bounds', () => {
    const random = randFor(314159);
    for (let i = 0; i < 2000; i++) {
      const r = random();
      assert.ok(r >= 0 && r < 1);
      const index = rng.int(random, 6);
      assert.ok(Number.isInteger(index) && index >= 0 && index < 6);
    }
  }],
  ['RNG: shuffle is seeded, contains all elements and is in-place', () => {
    const arr = [...Array(20).keys()];
    const one = rng.shuffle(randFor(7), arr.slice());
    const two = rng.shuffle(randFor(7), arr.slice());
    assert.deepEqual(one, two);
    assert.deepEqual(one.slice().sort((a,b) => a-b), arr);
    const copy = arr.slice();
    assert.strictEqual(rng.shuffle(randFor(7), copy), copy);
  }],
  ['Boards: deterministic layouts, terrain/token inventories and edge cases', () => {
    for (const size of Object.keys(LAYOUTS)) {
      const a = generateBoard(randFor(827), size);
      const b = generateBoard(randFor(827), size);
      assert.deepEqual(a, b);
      const topo = getTopology(a.layoutId);
      assert.equal(a.hexes.length, topo.hexes.length);
      assert.equal(a.hexes.filter(h => h.terrain === 'scorched').length, LAYOUTS[size].terrain.scorched);
      assert.ok(a.hexes.every(h => h.terrain === 'scorched' ? h.token === null : Number.isInteger(h.token)));
      assert.deepEqual(Object.fromEntries(Object.keys(LAYOUTS[size].terrain).map(k => [k, a.hexes.filter(h => h.terrain === k).length])), LAYOUTS[size].terrain);
      assert.ok(a.hexes.some(h => h.id === a.mowerHex && h.terrain === 'scorched'));
      assert.equal(a.ports.length, LAYOUTS[size].genericPorts + RESOURCES.length);
      assert.equal(new Set(a.ports.map(p => p.edge)).size, a.ports.length);
      for (const h of a.hexes) {
        if (h.token !== 6 && h.token !== 8) continue;
        const th = topo.hexById[h.id];
        for (const neighborId of th.neighbors) {
          const n = a.hexes[topo.hexIndex[neighborId]];
          assert.ok(n.token !== 6 && n.token !== 8, `${size}: adjacent red numbers at ${h.id} / ${neighborId}`);
        }
      }
    }
    assert.throws(() => generateBoard(randFor(1), 'unrecognised'), /Unknown board size/);
  }],
  ['Topology: all hex neighbours are reciprocal and in bounds', () => {
    for (const id of ['std-19', 'exp-37']) {
      const t = getTopology(id);
      assert.ok(t.hexes.length > 0);
      for (const hex of t.hexes) {
        assert.equal(hex.vertices.length, 6);
        assert.equal(new Set(hex.vertices).size, 6);
        for (const neighbour of hex.neighbors) {
          assert.ok(t.hexById[neighbour].neighbors.includes(hex.id));
        }
      }
    }
  }],
  ['V1: two seeded, equivalent starts create the same board and deterministic RNG', () => {
    const a = seededV1(1337), b = seededV1(1337);
    assert.equal(v1.apply(a, 0, { type: 'start' }, 1500).ok, true);
    assert.equal(v1.apply(b, 0, { type: 'start' }, 1500).ok, true);
    assert.deepEqual(a.board, b.board);
    assert.deepEqual(a.phase, b.phase);
    assert.deepEqual(a.secrets.rng, b.secrets.rng);
    assert.equal(a.phase.stage, 'factions');
    assert.equal(a.board.hexes.length, 19);
  }],
  ['V1: invalid actions and attempts after game-over do not mutate state', () => {
    const s = seededV1(8);
    const before = JSON.stringify(s);
    assert.equal(v1.apply(s, 1, { type: 'start' }, 2000).ok, false);
    assert.equal(v1.apply(s, 0, { type: 'nonexistent' }, 2000).ok, false);
    assert.equal(JSON.stringify(s), before);
    s.phase.stage = 'gameOver';
    const finished = JSON.stringify(s);
    assert.equal(v1.apply(s, 0, { type: 'start' }, 2000).ok, false);
    assert.equal(JSON.stringify(s), finished);
  }],
  ['V1: victory threshold ends the match, while one-point-short does not', () => {
    function nearWin(manorsRemaining) {
      const s = seededV1(9);
      v1.apply(s, 0, { type: 'start' }, 1000);
      // Construct a legal-style late-game fixture: five shacks and either
      // two or three manors worth of points already built.
      s.phase.stage = 'playing';
      s.phase.step = 'roll';
      s.phase.activeSeat = 0;
      s.phase.deadline = 999999;
      s.players[0].piecesLeft.shacks = 0;
      s.players[0].piecesLeft.manors = manorsRemaining;
      return s;
    }
    const short = nearWin(2);
    assert.equal(v1.apply(short, 0, { type: 'roll' }, 1000).ok, true);
    assert.equal(short.winner, null, 'nine points must not win a ten-point game');
    const winning = nearWin(1);
    assert.equal(v1.apply(winning, 0, { type: 'roll' }, 1000).ok, true);
    assert.equal(winning.phase.stage, 'gameOver');
    assert.equal(winning.winner.seat, 0);
    assert.equal(winning.phase.deadline, null);
    const snapshot = JSON.stringify(winning);
    assert.equal(v1.apply(winning, 0, { type: 'roll' }, 1001).ok, false);
    assert.equal(JSON.stringify(winning), snapshot);
  }],
  ['V1: timer-expired faction draft remains reproducible', () => {
    const a = seededV1(2024), b = seededV1(2024);
    v1.apply(a, 0, { type: 'start' }, 1000);
    v1.apply(b, 0, { type: 'start' }, 1000);
    const end = a.phase.deadline;
    assert.equal(v1.tick(a, end).changed, true);
    assert.equal(v1.tick(b, end).changed, true);
    assert.deepEqual(a.players.map(p => p.faction), b.players.map(p => p.faction));
    assert.deepEqual(a.secrets.rng, b.secrets.rng);
  }],
  ['V2: deterministic start, private player identity and no secrets in public view', () => {
    const a = seededV2(2701), b = seededV2(2701);
    assert.equal(v2.apply(a, 0, { type: 'start' }, 2000).ok, true);
    assert.equal(v2.apply(b, 0, { type: 'start' }, 2000).ok, true);
    assert.deepEqual(a.board, b.board);
    assert.deepEqual(a.secrets.rng, b.secrets.rng);
    const pub = v2.publicView(a);
    assert.equal(Object.prototype.hasOwnProperty.call(pub, 'secrets'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(pub.players[0], 'hand'), false);
    assert.equal(v2.seatForToken(a, 'incorrect'), -1);
  }]
];

module.exports = { cases, seededV1, seededV2, randFor };
