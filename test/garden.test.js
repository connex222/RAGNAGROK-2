'use strict';
/* Rule-by-rule tests for the V2 engine ("The Last Garden Show").
   Each test builds a small, controlled situation and checks one ruling from the rulebook.
   Run: node test/garden.test.js */

const assert = require('assert');
const E = require('../src/engine/garden');
const { getTopology } = require('../src/engine/topology');

const C = E.CONTENT;
let passed = 0;
const failures = [];

function test(name, fn) {
  try { fn(); passed += 1; console.log('  ✔ ' + name); }
  catch (err) { failures.push(name); console.log('  ✘ ' + name + '\n    ' + err.message); }
}

const ok = r => { if (!r.ok) throw new Error(r.error); return r; };
const full = () => ({ turf: 9, fertiliser: 9, sprinklers: 9, compost: 9, gnomeDust: 9 });
const none = () => ({ turf: 0, fertiliser: 0, sprinklers: 0, compost: 0, gnomeDust: 0 });

/* A game in the Plan phase of round 1, with a blank board we control. */
function setup(gods, opts = {}) {
  const s = E.createGame({ seed: opts.seed || 7, now: 1000 });
  gods.forEach((g, i) => E.addPlayer(s, { name: 'P' + i }, 1000));
  ok(E.apply(s, 0, { type: 'setOption', length: opts.length || 'standard' }, 1000));
  ok(E.apply(s, 0, { type: 'start' }, 1000));
  while (s.phase.stage === 'draft') ok(E.apply(s, s.phase.draftQueue[0], { type: 'chooseGod', god: gods[s.phase.draftQueue[0]] }, 1000));
  E.advance(s); // omens → plan
  assert.strictEqual(s.phase.step, 'plan');
  s.board.plots.forEach(p => { p.owner = null; p.health = 2; p.condition = null; p.feature = null; p.terrain = 'turf'; });
  s.players.forEach(p => { p.hand = full(); });
  s.forecast.now = [];
  s.emergency = null;
  s.earlyBird = 0;
  return s;
}

const topo = s => getTopology(s.board.layoutId);
const plot = (s, id) => s.board.plots[s.board.index[id]];
const own = (s, id, seat, extra = {}) => Object.assign(plot(s, id), { owner: seat }, extra);
const nb = (s, id) => topo(s).hexById[id].neighbors;
const centre = s => topo(s).hexes.find(h => h.q === 0 && h.r === 0).id;
const rest = { kind: 'carBoot', supplies: ['turf', 'turf'] };

function plan(s, seat, a, b) {
  ok(E.apply(s, seat, { type: 'plan', slots: [a, b || rest] }, 2000));
}
function lockAll(s) {
  s.players.forEach(p => { if (s.phase.step === 'plan' && !p.locked) ok(E.apply(s, p.seat, { type: 'lock' }, 2000)); });
}
const events = s => s.resolution.events;
const evOf = (s, seat, kind) => events(s).find(e => e.seat === seat && e.kind === kind);
function toHarvestEnd(s) { while (['resolve', 'disasters'].includes(s.phase.step)) E.advance(s); }

console.log('V2 rules tests');

test('Shelter blocks Meddle on the same plot', () => {
  const s = setup(['thor', 'freya']);
  const c = centre(s); const [a] = nb(s, c);
  own(s, c, 0); own(s, a, 1);
  plan(s, 0, { kind: 'shelter', target: c });
  plan(s, 1, { kind: 'meddle', target: c, mode: 'trample' });
  lockAll(s);
  const e = evOf(s, 1, 'meddle');
  assert.strictEqual(e.ok, false); assert.match(e.reason, /sheltered/);
  assert.strictEqual(plot(s, c).health, 2);
});

test('Shelter protects from disasters; Blessed absorbs one hit', () => {
  const s = setup(['thor', 'freya']);
  const c = centre(s); const [a, b] = nb(s, c);
  own(s, c, 0); own(s, a, 0, { condition: 'blessed' }); own(s, b, 0);
  s.forecast.now = [{ key: 'hail', name: 'Hail', good: false, health: -1, condition: null, target: { kind: 'random' }, plots: [c, a, b] }];
  plan(s, 0, { kind: 'shelter', target: c }); plan(s, 1, rest);
  lockAll(s); E.advance(s);
  assert.strictEqual(plot(s, c).health, 2, 'sheltered plot unhurt');
  assert.strictEqual(plot(s, a).health, 2, 'blessed plot unhurt');
  assert.strictEqual(plot(s, a).condition, null, 'blessing used up');
  assert.strictEqual(plot(s, b).health, 1, 'unprotected plot hit');
});

test('Contested Claim: Early Bird wins, loser pays nothing', () => {
  const s = setup(['freya', 'hel']);
  const c = centre(s); const [a, , , b] = nb(s, c);
  own(s, a, 0); own(s, b, 1);
  s.earlyBird = 1;
  plan(s, 0, { kind: 'claim', target: c }); plan(s, 1, { kind: 'claim', target: c });
  lockAll(s);
  assert.strictEqual(plot(s, c).owner, 1);
  assert.strictEqual(evOf(s, 0, 'claim').ok, false);
  assert.strictEqual(s.players[0].hand.turf, 9 + 2, 'loser keeps Turf (and gets Car-Boot Turf)');
});

test('Claim then Cultivate the same plot in one round', () => {
  const s = setup(['freya', 'hel']);
  const c = centre(s); const [a] = nb(s, c);
  own(s, a, 0);
  plan(s, 0, { kind: 'cultivate', target: c, feature: 'prizeMarrow' }, { kind: 'claim', target: c });
  plan(s, 1, rest); lockAll(s);
  assert.strictEqual(plot(s, c).owner, 0);
  assert.strictEqual(plot(s, c).feature, 'prizeMarrow');
});

test('Two chained Claims: slot 1 then slot 2', () => {
  const s = setup(['freya', 'hel']);
  const c = centre(s);
  const ring1 = nb(s, c);
  const outerOf = id => nb(s, id).find(x => x !== c && !ring1.includes(x));
  const a = ring1[0]; const far = outerOf(a);
  own(s, far, 0);
  plan(s, 0, { kind: 'claim', target: a }, { kind: 'claim', target: c });
  plan(s, 1, rest); lockAll(s);
  assert.strictEqual(plot(s, a).owner, 0); assert.strictEqual(plot(s, c).owner, 0);
});

test('An unaffordable plan cannot be locked or double-spend a later Car-Boot', () => {
  const s = setup(['freya', 'hel']);
  const c = centre(s); own(s, c, 0);
  s.players[0].hand = none();
  plan(s, 0, { kind: 'cultivate', target: c, feature: 'goldenGazebo' }, { kind: 'carBoot', supplies: ['turf', 'compost'] });
  plan(s, 1, rest);
  const rejected = E.apply(s, 0, { type: 'lock' }, 2000);
  assert.strictEqual(rejected.ok, false);
  assert.match(rejected.error, /more supplies/);
  assert.strictEqual(s.players[0].locked, false);
  assert.strictEqual(plot(s, c).feature, null);
  // The player can edit the plan instead of losing the whole action to a fizzle.
  plan(s, 0, rest); lockAll(s);
  assert.strictEqual(evOf(s, 0, 'carBoot').ok, true);
});


test('Disconnect never counts as a lock and the grace period is honoured', () => {
  const s = setup(['freya', 'hel']);
  plan(s, 0, rest);
  const originalDeadline = s.phase.deadline;
  E.setConnected(s, 1, false, originalDeadline - 1000);
  ok(E.apply(s, 0, { type: 'lock' }, originalDeadline - 500));
  assert.strictEqual(s.phase.step, 'plan');
  E.tick(s, originalDeadline);
  assert.strictEqual(s.phase.step, 'plan');
  assert.ok(s.phase.deadline >= originalDeadline + 7000);
  E.advance(s);
  assert.strictEqual(s.phase.step, 'resolve');
  assert.ok(s.resolution.events.some(e => e.seat === 1 && e.kind === 'carBoot'));
});

test('Reconnected player keeps an unfinished plan and can lock it', () => {
  const s = setup(['freya', 'hel']);
  plan(s, 0, rest); plan(s, 1, rest);
  E.setConnected(s, 1, false, 2000);
  ok(E.apply(s, 0, { type: 'lock' }, 2000));
  assert.strictEqual(s.phase.step, 'plan');
  E.setConnected(s, 1, true, 3000);
  assert.strictEqual(s.players[1].disconnectedAt, null);
  assert.strictEqual(s.secrets.plans[1][0].kind, 'carBoot');
  ok(E.apply(s, 1, { type: 'lock' }, 3000));
  assert.strictEqual(s.phase.step, 'resolve');
});

test('Locking closes outgoing trade offers, and trading cannot change a locked hand', () => {
  const s = setup(['freya', 'hel']);
  plan(s, 0, rest); plan(s, 1, rest);
  const offer = { type: 'offerTrade', give: { turf: 1 }, want: { compost: 1 } };
  ok(E.apply(s, 0, offer, 2000));
  const id = s.trades[0].id;
  ok(E.apply(s, 0, { type: 'lock' }, 2000));
  assert.strictEqual(s.trades[0].status, 'expired');
  const a = JSON.stringify(s.players.map(p => p.hand));
  assert.strictEqual(E.apply(s, 1, { type: 'respondTrade', id, accept: true }, 2000).ok, false);
  assert.strictEqual(E.apply(s, 0, offer, 2000).ok, false);
  assert.strictEqual(JSON.stringify(s.players.map(p => p.hand)), a);
});

test('Locked recipient cannot accept trade while unlocked proposer remains available', () => {
  const s = setup(['freya', 'hel']);
  plan(s, 0, rest); plan(s, 1, rest);
  ok(E.apply(s, 0, { type: 'offerTrade', give: { turf: 1 }, want: { compost: 1 } }, 2000));
  ok(E.apply(s, 1, { type: 'lock' }, 2000));
  const before = JSON.stringify(s.players.map(p => p.hand));
  const r = E.apply(s, 1, { type: 'respondTrade', id: s.trades[0].id, accept: true }, 2000);
  assert.strictEqual(r.ok, false);
  assert.deepStrictEqual(JSON.stringify(s.players.map(p => p.hand)), before);
});

test('Prototype property names cannot be used as commands or features', () => {
  const s = setup(['freya', 'hel']);
  const initial = JSON.stringify(s);
  for (const type of ['toString', 'constructor', '__proto__']) {
    const r = E.apply(s, 0, { type }, 3000);
    assert.strictEqual(r.ok, false, type + ' was accepted');
  }
  assert.strictEqual(JSON.stringify(s), initial, 'invalid command mutated state');
  const c = centre(s); own(s, c, 0);
  for (const feature of ['toString', 'constructor', '__proto__']) {
    assert.strictEqual(E.apply(s, 0, { type: 'plan', slots: [{ kind: 'cultivate', target: c, feature }, rest] }, 3000).ok, false);
  }
});

test('Invalid combined lobby settings do not partly update game state', () => {
  const s = E.createGame({ seed: 1, now: 1000 });
  E.addPlayer(s, { name: 'One' }, 1000);
  const before = JSON.stringify(s);
  const r = E.apply(s, 0, { type: 'setOption', length: 'epic', planSec: -1 }, 2000);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(JSON.stringify(s), before);
  ok(E.apply(s, 0, { type: 'setOption', length: 'epic', planSec: 120 }, 2000));
  assert.strictEqual(s.config.length, 'epic');
  assert.strictEqual(s.config.planSec, 120);
});

test('Lock rejects a pledge that would double-spend planned supplies', () => {
  const s = setup(['frigg', 'hel']);
  const c = centre(s); own(s, c, 0);
  s.emergency = { target: 2, result: null };
  s.players[0].hand = { ...none(), turf: 1, compost: 1 };
  plan(s, 0, { kind: 'shelter', target: c });
  ok(E.apply(s, 0, { type: 'pledge', supplies: { turf: 1 } }, 2000));
  const res = E.apply(s, 0, { type: 'lock' }, 2000);
  assert.strictEqual(res.ok, false);
});

test('Trample ruins a plot at 0 and destroys its feature', () => {
  const s = setup(['thor', 'freya']);
  const c = centre(s); const [a] = nb(s, c);
  own(s, c, 0, { health: 1, feature: 'roseArch' }); own(s, a, 1);
  plan(s, 0, rest); plan(s, 1, { kind: 'meddle', target: c, mode: 'trample' });
  lockAll(s);
  assert.strictEqual(plot(s, c).health, 0); assert.strictEqual(plot(s, c).feature, null);
});

test('Pilfer takes the plot\'s supply from its owner', () => {
  const s = setup(['thor', 'freya']);
  const c = centre(s); const [a] = nb(s, c);
  own(s, c, 0, { terrain: 'compost' }); own(s, a, 1);
  plan(s, 0, rest); plan(s, 1, { kind: 'meddle', target: c, mode: 'pilfer' });
  lockAll(s);
  assert.strictEqual(s.players[0].hand.compost, 8);
  assert.strictEqual(s.players[1].hand.compost, 10);
});

test('Hedge Maze blocks Meddle, except Loki', () => {
  const s1 = setup(['thor', 'freya']);
  const c = centre(s1); const [a] = nb(s1, c);
  own(s1, c, 0, { feature: 'hedgeMaze' }); own(s1, a, 1);
  plan(s1, 0, rest); plan(s1, 1, { kind: 'meddle', target: c, mode: 'trample' }); lockAll(s1);
  assert.strictEqual(plot(s1, c).health, 2);
  const s2 = setup(['thor', 'loki']);
  own(s2, c, 0, { feature: 'hedgeMaze' }); own(s2, a, 1, { health: 1 });
  plan(s2, 0, rest); plan(s2, 1, { kind: 'meddle', target: c, mode: 'trample' }); lockAll(s2);
  assert.strictEqual(plot(s2, c).health, 1, 'Loki tramples through the maze');
  assert.strictEqual(plot(s2, a).health, 2, 'and moves the health to his own plot');
  assert.strictEqual(evOf(s2, 1, 'meddle').power, 'loki', 'Loki\'s power is announced');
});

test('Heimdall: Meddle fails and he receives the Gnome Dust', () => {
  const s = setup(['heimdall', 'thor']);
  const c = centre(s); const [a] = nb(s, c);
  own(s, c, 0); own(s, a, 1);
  plan(s, 0, rest); plan(s, 1, { kind: 'meddle', target: c, mode: 'trample' }); lockAll(s);
  assert.strictEqual(plot(s, c).health, 2);
  assert.strictEqual(s.players[0].hand.gnomeDust, 10);
  assert.strictEqual(s.players[1].hand.gnomeDust, 8);
  assert.strictEqual(evOf(s, 1, 'meddle').power, 'heimdall', 'Heimdall\'s power is announced');
});

test('Tend clears a condition; Freya also adds health', () => {
  const s = setup(['freya', 'thor']);
  const c = centre(s); const [a] = nb(s, c);
  own(s, c, 0, { condition: 'frozen', health: 1 }); own(s, a, 1, { condition: 'frozen', health: 1 });
  plan(s, 0, { kind: 'tend', target: c }); plan(s, 1, { kind: 'tend', target: a }); lockAll(s);
  assert.strictEqual(plot(s, c).condition, null); assert.strictEqual(plot(s, c).health, 3, 'Freya +2');
  assert.strictEqual(plot(s, a).condition, null); assert.strictEqual(plot(s, a).health, 2, 'others clear and heal 1');
});

test('Tend clears a hazard and repairs the plot in the same action', () => {
  const s = setup(['thor', 'freya']);
  const c = centre(s); const [a] = nb(s, c);
  own(s, c, 0, { health: 1, condition: 'frozen' });
  own(s, a, 1, { health: 1, condition: 'frozen' });
  plan(s, 0, { kind: 'tend', target: c });
  plan(s, 1, { kind: 'tend', target: a });
  lockAll(s);
  assert.strictEqual(plot(s, c).condition, null);
  assert.strictEqual(plot(s, c).health, 2);
  assert.strictEqual(plot(s, a).condition, null);
  assert.strictEqual(plot(s, a).health, 3);
});

test('Garden Design rewards intentional neighbouring features only', () => {
  const s = setup(['freya', 'hel']);
  const c = centre(s); const [a, b, d] = nb(s, c);
  own(s, c, 0, { feature: 'beeHotel' });
  own(s, a, 0, { feature: 'roseArch' });
  own(s, b, 0, { feature: 'waterFeature' });
  own(s, d, 0, { feature: 'hedgeMaze' });
  assert.strictEqual(E.gardenDesignBonus(s, 0), 3, 'bee, water and hedge placements each score 1');
  // A Hedge Maze needs TWO neighbouring owned features, not just plots.
  const hb = nb(s, d).find(x => x !== c && x !== a && x !== b);
  if (hb) own(s, hb, 0, { feature: 'prizeMarrow' });
  assert.strictEqual(E.gardenDesignBonus(s, 0), 3);
  assert.strictEqual(E.scoreOf(s, 0).designBonus, 3);
  plot(s, a).condition = 'infested';
  assert.strictEqual(E.gardenDesignBonus(s, 0), 1, 'infestation disables linked bonuses');
});

test('Automatic overflow composting preserves locked action supplies if possible', () => {
  const s = setup(['freya', 'hel']);
  const c = centre(s); own(s, c, 0);
  s.players[0].hand = { turf: 1, fertiliser: 2, sprinklers: 4, compost: 4, gnomeDust: 1 };
  s.secrets.compostOwed[0] = 2;
  plan(s, 0, { kind: 'shelter', target: c });
  plan(s, 1, rest);
  lockAll(s);
  assert.strictEqual(evOf(s, 0, 'shelter').ok, true);
  assert.strictEqual(s.players[0].hand.turf, 2, 'Shelter paid before the Car-Boot Sale restored 2 Turf');
  assert.strictEqual(s.secrets.compostOwed[0], undefined);
});

test('Ash caps health at Healthy; Greenhouse is immune to Ash', () => {
  const s = setup(['thor', 'freya']);
  const c = centre(s); const [a] = nb(s, c);
  own(s, c, 0, { health: 3 }); own(s, a, 0, { health: 3, feature: 'greenhouse' });
  s.forecast.now = [{ key: 'smoulder', name: 'Ash', good: false, health: 0, condition: 'ash', target: { kind: 'random' }, plots: [c, a] }];
  plan(s, 0, rest); plan(s, 1, rest); lockAll(s); E.advance(s);
  assert.strictEqual(plot(s, c).health, 2); assert.strictEqual(plot(s, c).condition, 'ash');
  assert.strictEqual(plot(s, a).health, 3); assert.strictEqual(plot(s, a).condition, null);
});

test('Harvest: yield by health; Frozen yields nothing; Blessed +1', () => {
  const s = setup(['thor', 'freya']);
  const [h1, h2, h3] = nb(s, centre(s));
  own(s, h1, 0, { health: 3, terrain: 'compost' });
  own(s, h2, 0, { health: 3, terrain: 'compost', condition: 'frozen' });
  own(s, h3, 0, { health: 2, terrain: 'compost', condition: 'blessed' });
  plan(s, 0, rest); plan(s, 1, rest); lockAll(s); toHarvestEnd(s);
  assert.strictEqual(s.harvestReport[0].compost, 2 + 0 + 2);
});

test('Hel gains Compost when disasters damage others (capped at 2)', () => {
  const s = setup(['hel', 'thor']);
  const ids = nb(s, centre(s));
  ids.forEach(id => own(s, id, 1));
  s.players[0].hand = none();
  s.forecast.now = [{ key: 'hail', name: 'Hail', good: false, health: -1, condition: null, target: { kind: 'random' }, plots: ids }];
  plan(s, 0, { kind: 'carBoot', supplies: ['turf', 'turf'] }); plan(s, 1, rest); lockAll(s); E.advance(s);
  assert.strictEqual(s.players[0].hand.compost, 2);
});

test('Emergency success: Goodwill, top pledger bonus, Frigg counts double', () => {
  const s = setup(['frigg', 'thor', 'freya']);
  s.emergency = { key: 'x', name: 'Test', act: 1, target: 6, fail: { kind: 'loseSupplies', count: 2 }, result: null, total: null, paid: null };
  ok(E.apply(s, 0, { type: 'pledge', supplies: { turf: 2 } }, 2000));
  ok(E.apply(s, 1, { type: 'pledge', supplies: { compost: 2 } }, 2000));
  [0, 1, 2].forEach(seat => plan(s, seat, rest));
  lockAll(s); E.advance(s);
  assert.strictEqual(s.emergency.total, 6);
  assert.strictEqual(s.emergency.result, 'success');
  assert.strictEqual(s.players[0].goodwill, 1 + 1 + 1, 'Frigg: base 1, top pledger 1, power 1');
  assert.strictEqual(s.players[1].goodwill, 2);
  assert.strictEqual(s.players[2].goodwill, 0);
});

test('Emergency failure: half refunded, penalty applied, extra disaster added', () => {
  const s = setup(['thor', 'freya']);
  s.emergency = { key: 'x', name: 'Test', act: 1, target: 50, fail: { kind: 'loseSupplies', count: 2 }, result: null, total: null, paid: null };
  const nextBefore = s.forecast.next.length;
  ok(E.apply(s, 0, { type: 'pledge', supplies: { turf: 4 } }, 2000));
  plan(s, 0, { kind: 'carBoot', supplies: ['compost', 'compost'] }); plan(s, 1, rest);
  lockAll(s); E.advance(s);
  assert.strictEqual(s.emergency.result, 'failed');
  assert.strictEqual(s.forecast.next.length, nextBefore + 1);
  assert.strictEqual(s.players[0].goodwill, 0);
});

test('Show scoring: ties share the higher place', () => {
  const s = setup(['thor', 'freya', 'hel']);
  const ids = nb(s, centre(s));
  own(s, ids[0], 0, { feature: 'roseArch' }); own(s, ids[1], 1, { feature: 'roseArch' }); own(s, ids[2], 2);
  s.shows[0].categories = ['bloomingMarvellous'];
  s.round = 3;
  plan(s, 0, rest); plan(s, 1, rest); plan(s, 2, rest);
  lockAll(s); toHarvestEnd(s); E.advance(s);
  const pts = C.showPoints['3'];
  assert.strictEqual(s.players[0].showPoints, pts[0]);
  assert.strictEqual(s.players[1].showPoints, pts[0]);
  assert.strictEqual(s.players[2].showPoints, 0, 'no Flora feature: does not place');
});

test('Odin shifts a sector disaster once per act', () => {
  const s = setup(['odin', 'thor']);
  s.forecast.now = [{ key: 'frost', name: 'Frost', good: false, health: 0, condition: 'frozen', target: { kind: 'sector' }, sector: 2, plots: [] }];
  const r = ok(E.apply(s, 0, { type: 'odinShift', index: 0, dir: 1 }, 2000));
  assert.ok(r.events.some(e => e.type === 'godPower' && e.god === 'odin'), 'Odin\'s power is announced');
  assert.strictEqual(s.forecast.now[0].sector, 3);
  assert.ok(s.forecast.now[0].plots.every(id => s.board.sectors[id] === 3));
  assert.strictEqual(E.apply(s, 0, { type: 'odinShift', index: 0, dir: 1 }, 2000).ok, false);
});

test('Illegal plans are refused with a reason', () => {
  const s = setup(['thor', 'freya']);
  const c = centre(s); const [a] = nb(s, c);
  own(s, a, 1);
  const r1 = E.apply(s, 0, { type: 'plan', slots: [{ kind: 'tend', target: a }, rest] }, 2000);
  assert.strictEqual(r1.ok, false); assert.match(r1.error, /own plots/);
  const r2 = E.apply(s, 0, { type: 'plan', slots: [{ kind: 'meddle', target: a, mode: 'trample' }, rest] }, 2000);
  assert.strictEqual(r2.ok, false); assert.match(r2.error, /next to your garden/);
  assert.strictEqual(E.apply(s, 0, { type: 'lock' }, 2000).ok, false, 'cannot lock an empty plan');
});

test('Plans stay secret until revealed; phones see only their own', () => {
  const s = setup(['thor', 'freya']);
  plan(s, 0, { kind: 'carBoot', supplies: ['compost', 'compost'] });
  const tv = E.publicView(s);
  assert.ok(!('secrets' in tv)); assert.strictEqual(tv.resolution, null);
  assert.ok(E.privateView(s, 0).me.plan);
  assert.strictEqual(E.privateView(s, 1).me.plan, null);
  assert.ok(!JSON.stringify(E.privateView(s, 1)).includes('"compost","compost"'));
});

test('Timeout plays the safe default and the game moves on', () => {
  const s = setup(['thor', 'freya']);
  E.advance(s); // plan timer runs out
  assert.strictEqual(s.phase.step, 'resolve');
  assert.ok(events(s).every(e => e.kind === 'carBoot'));
});

test('Save and reload mid-plan keeps everything', () => {
  const s = setup(['thor', 'freya']);
  plan(s, 0, { kind: 'carBoot', supplies: ['compost', 'compost'] });
  const t = JSON.parse(JSON.stringify(s));
  assert.strictEqual(t.schemaVersion, 3);
  plan(t, 1, rest); lockAll(t);
  assert.strictEqual(t.phase.step, 'resolve');
});

test('A full standard game lasts exactly 9 rounds with 3 shows', () => {
  const s = setup(['thor', 'freya']);
  let guard = 0;
  while (s.phase.stage !== 'gameOver' && guard++ < 500) E.advance(s);
  assert.strictEqual(s.round, 9);
  assert.strictEqual(s.shows.filter(x => x.results).length, 3);
  assert.ok(s.final.winners.length >= 1);
});

test('Long is the default length: 12 rounds, shows after 4, 8 and 12', () => {
  const s = E.createGame({ seed: 3, now: 1000 });
  assert.strictEqual(s.config.length, 'long');
  ['a', 'b'].forEach(n => E.addPlayer(s, { name: n }, 1000));
  ok(E.apply(s, 0, { type: 'start' }, 1000));
  while (s.phase.stage === 'draft') ok(E.apply(s, s.phase.draftQueue[0], { type: 'chooseGod', god: ['thor', 'odin'][s.phase.draftQueue[0]] }, 1000));
  let guard = 0;
  while (s.phase.stage !== 'gameOver' && guard++ < 800) E.advance(s);
  assert.strictEqual(s.round, 12);
  assert.deepStrictEqual(s.shows.map(x => x.after), [4, 8, 12]);
});

test('Epic: 24 rounds, 6 shows, 2/3/4 actions by act, 100 s planning', () => {
  const s = setup(['thor', 'freya'], { length: 'epic' });
  assert.strictEqual(E.slotCount(s), 2, 'Act I has 2 actions');
  assert.strictEqual(s.phase.deadline - s.updatedAt, 100000, '100 s timer');
  assert.strictEqual(E.apply(s, 0, { type: 'plan', slots: [rest, rest, rest] }, 2000).ok, false, '3 actions refused in Act I');
  let guard = 0;
  while (s.round < 9 && guard++ < 600) E.advance(s);
  assert.strictEqual(s.act, 2);
  while (s.phase.step !== 'plan' && guard++ < 600) E.advance(s);
  assert.strictEqual(E.slotCount(s), 3);
  ok(E.apply(s, 0, { type: 'plan', slots: [rest, rest, rest] }, s.updatedAt));
  while (s.round < 17 && guard++ < 1200) E.advance(s);
  while (s.phase.step !== 'plan' && guard++ < 1200) E.advance(s);
  assert.strictEqual(E.slotCount(s), 4, 'Act III has 4 actions');
  while (s.phase.stage !== 'gameOver' && guard++ < 3000) E.advance(s);
  assert.strictEqual(s.round, 24);
  assert.strictEqual(s.shows.filter(x => x.results).length, 6);
  s.shows.forEach(sh => assert.strictEqual(new Set(sh.categories).size, sh.categories.length, 'no repeated category within a show'));
});

console.log(failures.length ? `✘ ${failures.length} failed, ${passed} passed` : `✔ All ${passed} V2 rules tests passed`);
process.exit(failures.length ? 1 : 0);
