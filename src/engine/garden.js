'use strict';
/* Ragnagrok V2 rules engine: "The Last Garden Show".

   Same public API shape as the v0.5 engine (rules.js), so the server can switch over later:
     createGame, addPlayer, removePlayer, seatForToken, setConnected,
     apply(state, seat, action, now)  → { ok, error, events }
     tick(state, now)                 → { changed, events }
     publicView(state), privateView(state, seat), clientTopology(layoutId)
   Plus advance(state) for tests and robots: jumps the clock to the current deadline.

   All game content (gods, features, disasters, categories) lives in src/data/v2.json. */

const crypto = require('crypto');
const { next, int, shuffle } = require('./rng');
const { getTopology, clientTopology } = require('./topology');
const { LAYOUTS } = require('./board');
const C = require('../data/v2.json');

const SCHEMA_VERSION = 4;
const SUP = C.supplies;
const ORDER = C.actions.order;
const GOD_IDS = Object.keys(C.gods);
const COLOURS = ['#E4572E', '#3B8EEA', '#F2C14E', '#7AC74F', '#B565D8', '#F28AB2', '#3CC6C0', '#E8E2D0'];
const BAD_CONDITIONS = Object.keys(C.conditions).filter(k => C.conditions[k].bad);

const DEFAULT_CONFIG = {
  maxPlayers: 8,
  length: C.defaultLength,
  planSec: null,       // null = the game length's own timer
  planBonusLarge: 15,  // extra seconds with 5+ players
  draftSec: 30,
  omensSec: 6,
  resolvePerEventSec: 1.2,
  resolveMinSec: 4,
  resolveMaxSec: 30,
  disastersSec: 6,
  harvestSec: 3,
  showSec: 14,
  disconnectGraceSec: 8
};

/* ---------- small helpers ---------- */

const emptyHand = () => ({ turf: 0, fertiliser: 0, sprinklers: 0, compost: 0, gnomeDust: 0 });
const handTotal = h => SUP.reduce((n, r) => n + (h[r] || 0), 0);
const hasAll = (h, c) => SUP.every(r => (h[r] || 0) >= ((c && c[r]) || 0));
const isSupply = r => SUP.includes(r);
const randFn = s => () => next(s.secrets.rng);
const P = (s, seat) => s.players[seat];
const nameOf = (s, seat) => (s.players[seat] ? s.players[seat].name : '?');
const godOf = (s, seat) => (s.players[seat] ? s.players[seat].god : null);
const seatWithGod = (s, g) => { const p = s.players.find(x => x.god === g); return p ? p.seat : null; };
const lengthCfg = s => C.lengths[s.config.length] || C.lengths.standard;
const sizeKey = s => (s.players.length <= 4 ? 'small' : 'large');
const slotCount = s => lengthCfg(s).slotsByAct[Math.max(0, (s.act || 1) - 1)];
const planSeconds = s => (s.config.planSec || lengthCfg(s).planSec) + (s.players.length >= 5 ? s.config.planBonusLarge : 0);

function pay(s, seat, cost) {
  const h = P(s, seat).hand;
  SUP.forEach(r => { h[r] -= (cost && cost[r]) || 0; });
}
function gain(s, seat, bundle) {
  const h = P(s, seat).hand;
  SUP.forEach(r => { h[r] += (bundle && bundle[r]) || 0; });
}
function cleanBundle(b) {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return null;
  const out = emptyHand();
  for (const [k, v] of Object.entries(b)) {
    if (!isSupply(k) || !Number.isInteger(v) || v < 0 || v > 99) return null;
    out[k] = v;
  }
  return out;
}
const describe = b => SUP.filter(r => b[r] > 0).map(r => `${b[r]} ${r}`).join(', ');

function mkCtx(state, now) {
  return { state, now, events: [], topo: state.board ? getTopology(state.board.layoutId) : null };
}
function emit(ctx, type, data = {}) { ctx.events.push({ type, ...data }); }
function log(ctx, type, text, seat = null) {
  const s = ctx.state;
  s.log.push({ round: s.round, at: ctx.now, type, seat, text });
  if (s.log.length > 80) s.log.splice(0, s.log.length - 80);
}
function setStep(ctx, step, sec) {
  ctx.state.phase.step = step;
  ctx.state.phase.deadline = sec !== null && sec !== undefined ? ctx.now + Math.round(sec * 1000) : null;
}

/* ---------- geometry ---------- */

const ringOf = h => Math.max(Math.abs(h.q), Math.abs(h.r), Math.abs(h.q + h.r));
function sectorOf(h) {
  if (h.q === 0 && h.r === 0) return -1;
  const a = Math.atan2(h.y, h.x);
  return Math.floor(((a + Math.PI) / (2 * Math.PI)) * 6 + 1e-9) % 6;
}
const plotById = (s, id) => s.board.plots[s.board.index[id]];
const ownedBy = (s, seat) => s.board.plots.filter(p => p.owner === seat);
function touchesGarden(s, topo, seat, plotId, extra) {
  return topo.hexById[plotId].neighbors.some(n => {
    const p = plotById(s, n);
    return (p && p.owner === seat) || (extra && extra.includes(n));
  });
}
/* BFS keeps Loki's two-plot influence on the actual board topology. */
function distance(topo, source, destination, max) {
  if (!topo.hexById[source] || !topo.hexById[destination]) return Infinity;
  const seen = new Set([source]);
  let edge = [source];
  for (let hops = 1; hops <= max; hops++) {
    edge = edge.flatMap(id => topo.hexById[id].neighbors).filter(id => {
      if (seen.has(id)) return false;
      seen.add(id); return true;
    });
    if (edge.includes(destination)) return hops;
  }
  return Infinity;
}
function prayError(s, topo, seat, slot) {
  if (!Number.isInteger(slot.index) || slot.index < 0 || slot.index >= s.forecast.now.length)
    return 'Choose a disaster forecast for this round';
  const d = s.forecast.now[slot.index];
  if (!d.plots.includes(slot.target)) return 'That plot is not on the selected forecast';
  if (!s.board.index.hasOwnProperty(slot.to)) return 'Choose a plot on the board';
  if (d.plots.includes(slot.to)) return 'The disaster is already hitting that plot';
  const maximum = godOf(s, seat) === 'loki' ? C.pray.lokiMaxDistance : C.pray.maxDistance;
  if (distance(topo, slot.target, slot.to, maximum) > maximum) return `Pick a plot within ${maximum} step${maximum > 1 ? 's' : ''}`;
  const dest = plotById(s, slot.to);
  if (dest.owner !== null && godOf(s, dest.owner) === 'heimdall') return 'Heimdall spotted the divine paperwork';
  return null;
}

const featureDef = key => typeof key === 'string' && Object.hasOwn(C.features, key) ? C.features[key] : null;
const hasTag = (plot, tag) => !!(plot.feature && featureDef(plot.feature).tags.includes(tag));

function capHealth(plot) {
  plot.health = Math.max(0, Math.min(3, plot.health));
  if (plot.condition === 'ash') plot.health = Math.min(plot.health, C.conditions.ash.healthCap);
  if (plot.health === 0) plot.feature = null;
}

/* ---------- board ---------- */

function buildBoard(s, rand) {
  const size = sizeKey(s) === 'small' ? 'standard' : 'expanded';
  const L = LAYOUTS[size];
  const topo = getTopology(L.layoutId);
  const terrains = [];
  Object.entries(L.terrain).forEach(([t, c]) => { for (let i = 0; i < c; i++) terrains.push(t); });
  shuffle(rand, terrains);
  const plots = topo.hexes.map((h, i) => ({
    id: h.id, q: h.q, r: h.r, terrain: terrains[i], health: 2, owner: null, condition: null, feature: null
  }));
  const index = {};
  plots.forEach((p, i) => { index[p.id] = i; });
  s.board = { layoutId: L.layoutId, radius: topo.radius, plots, index, sectors: {} };
  topo.hexes.forEach(h => { s.board.sectors[h.id] = sectorOf(h); });
  dealStarts(s, topo, rand);
}

function dealStarts(s, topo, rand) {
  const n = s.players.length;
  const R = topo.radius;
  const outer = topo.hexes.filter(h => ringOf(h) === R).sort((a, b) => Math.atan2(a.y, a.x) - Math.atan2(b.y, b.x));
  const L = outer.length;
  const inward = h => topo.hexById[h.id].neighbors.map(id => topo.hexById[id]).find(x => ringOf(x) === R - 1);
  let best = null;

  for (let attempt = 0; attempt < 200; attempt++) {
    const offset = int(rand, L);
    const pairs = [];
    for (let i = 0; i < n; i++) {
      const a = outer[(Math.round((i * L) / n) + offset) % L];
      const b = n <= 4 ? outer[(Math.round((i * L) / n) + offset + 1) % L] : inward(a);
      pairs.push([a.id, b.id]);
    }
    const all = pairs.flat();
    if (new Set(all).size !== all.length) continue;
    let touches = 0;
    pairs.forEach((pa, i) => pairs.forEach((pb, j) => {
      if (j <= i) return;
      pa.forEach(x => pb.forEach(y => { if (topo.hexById[x].neighbors.includes(y)) touches++; }));
    }));
    if (!best || touches < best.touches) best = { pairs, touches };
    if (touches === 0) break;
  }

  const starts = new Set(best.pairs.flat());
  const swapIn = (plot, ok) => {
    const options = s.board.plots.filter(p => !starts.has(p.id) && ok(p.terrain));
    if (!options.length) return;
    const o = options[int(rand, options.length)];
    [plot.terrain, o.terrain] = [o.terrain, plot.terrain];
  };
  best.pairs.forEach((pair, seat) => {
    const [a, b] = pair.map(id => plotById(s, id));
    if (a.terrain === 'scorched') swapIn(a, t => t !== 'scorched' && t !== b.terrain);
    if (b.terrain === 'scorched' || b.terrain === a.terrain) swapIn(b, t => t !== 'scorched' && t !== a.terrain);
    [a, b].forEach(p => { p.owner = seat; p.health = 2; });
  });
}

/* ---------- disasters ---------- */

function actOf(s, round) { return Math.min(3, Math.ceil(round / lengthCfg(s).actLength)); }

function drawDisasterKey(s, act) {
  const decks = s.secrets.decks;
  if (!decks[act] || !decks[act].length) decks[act] = shuffle(randFn(s), C.disasters[act].map(d => d.key));
  return decks[act].pop();
}

function targetPlots(s, topo, target, inst) {
  const plots = s.board.plots;
  const rand = randFn(s);
  const small = sizeKey(s) === 'small';
  switch (target.kind) {
    case 'sector': {
      if (inst.sector === undefined) inst.sector = int(rand, 6);
      return plots.filter(p => s.board.sectors[p.id] === inst.sector).map(p => p.id);
    }
    case 'coast': {
      if (inst.sector === undefined) inst.sector = int(rand, 6);
      const k2 = (inst.sector + 1) % 6;
      return plots.filter(p => ringOf(p) === topo.radius && [inst.sector, k2].includes(s.board.sectors[p.id])).map(p => p.id);
    }
    case 'random': {
      const n = target.count[small ? 0 : 1];
      return shuffle(rand, plots.map(p => p.id)).slice(0, n);
    }
    case 'terrain': return plots.filter(p => p.terrain === target.terrain).map(p => p.id);
    case 'tag': return plots.filter(p => hasTag(p, target.tag)).map(p => p.id);
    case 'line': {
      if (inst.axis === undefined) {
        inst.axis = int(rand, 3);
        inst.value = int(rand, 2 * topo.radius - 1) - (topo.radius - 1);
      }
      const coord = p => [p.q, p.r, -p.q - p.r][inst.axis];
      return plots.filter(p => coord(p) === inst.value).map(p => p.id);
    }
    case 'half': {
      if (inst.sector === undefined) inst.sector = int(rand, 6);
      const half = [0, 1, 2].map(k => (inst.sector + k) % 6);
      return plots.filter(p => half.includes(s.board.sectors[p.id])).map(p => p.id);
    }
    case 'all': return plots.map(p => p.id);
    default: return [];
  }
}

function makeDisaster(s, act) {
  const key = drawDisasterKey(s, act);
  const def = C.disasters[act].find(d => d.key === key);
  return { key, name: def.name, act, good: !!def.good, health: def.health || 0, setHealth: def.setHealth, condition: def.condition || null, target: def.target, plots: [] };
}

/* Targets are fixed when a disaster is revealed; tag and terrain targets are refreshed at that moment. */
function reveal(s, topo, inst) {
  inst.plots = targetPlots(s, topo, inst.target, inst);
  return inst;
}

function queueFor(s, round) {
  const q = s.secrets.queue;
  if (!q[round]) {
    const n = C.disastersPerRound[sizeKey(s)][actOf(s, round)];
    q[round] = [];
    for (let i = 0; i < n; i++) q[round].push(makeDisaster(s, actOf(s, round)));
  }
  return q[round];
}

/* ---------- turn flow ---------- */

function initiativeOrder(s) {
  const n = s.players.length;
  return [...Array(n).keys()].map(i => (s.earlyBird + i) % n);
}

function beginGame(ctx) {
  const s = ctx.state;
  s.phase.stage = 'playing';
  s.round = 0;
  s.earlyBird = 0;
  beginRound(ctx, 1);
}

function beginRound(ctx, round) {
  const s = ctx.state;
  const cfg = lengthCfg(s);
  s.round = round;
  s.act = actOf(s, round);
  s.roundState = { sheltered: [], helGained: 0 };

  // This round's disasters were revealed last round; now reveal next round's.
  s.forecast.now = round === 1 ? queueFor(s, 1).map(d => reveal(s, ctx.topo, d)) : s.forecast.next;
  s.forecast.next = round < cfg.rounds ? queueFor(s, round + 1).map(d => reveal(s, ctx.topo, d)) : [];
  if (round + 2 <= cfg.rounds) queueFor(s, round + 2);
  // Extra disasters from a failed emergency join next round's forecast.
  (s.secrets.pendingExtra || []).splice(0).forEach(d => s.forecast.next.push(reveal(s, ctx.topo, d)));

  // Show categories are announced ahead of time.
  cfg.showRounds.forEach((after, i) => {
    const revealAt = i === 0 ? 1 : cfg.showRounds[i - 1] + 1;
    if (round === revealAt && !s.shows[i].categories) s.shows[i].categories = drawCategories(s, i);
  });

  s.emergency = null;
  if (cfg.emergencyRounds.includes(round)) {
    const def = C.emergencies[String(s.act)];
    s.emergency = { key: def.key, name: def.name, act: s.act, target: Math.ceil(def.perPlayer * s.players.length), fail: def.fail, result: null, total: null, paid: null };
  }

  s.players.forEach(p => { p.locked = false; p.disconnectedAt = p.connected ? null : (p.disconnectedAt || ctx.now); });
  s.secrets.plans = {};
  s.secrets.pledges = {};
  s.resolution = null;
  s.disasterReport = null;
  s.harvestReport = null;
  setStep(ctx, 'omens', s.config.omensSec);
  emit(ctx, 'omens', { round, act: s.act, emergency: !!s.emergency });
  log(ctx, 'round', `Round ${round} of ${cfg.rounds}.`);
}

function drawCategories(s, showIndex, guaranteed = []) {
  const cfg = lengthCfg(s);
  const pool = s.secrets.categoryPool;
  const want = cfg.categoriesPerShow[showIndex];
  const picked = [...guaranteed];
  for (let pass = 0; pass < 2 && picked.length < want; pass++) {
    if (pass === 1) pool.push(...shuffle(randFn(s), Object.keys(C.categories)).filter(k => !picked.includes(k)));
    for (let i = pool.length - 1; i >= 0 && picked.length < want; i--) {
      const key = pool[i];
      if (showIndex === 0 && C.categories[key].notFirstShow) continue;
      if (picked.includes(key)) continue;
      picked.push(key);
      pool.splice(i, 1);
    }
  }
  return picked;
}

/* Sympathy Vote: lowest Prestige chooses a category, not bonus points. */
function beginSympathy(ctx) {
  const s = ctx.state;
  const scores = s.players.map(p => scoreOf(s, p.seat));
  const worst = Math.min(...scores.map(r => r.total));
  const chooser = scores.filter(r => r.total === worst).sort((a,b) => a.seat-b.seat)[0].seat;
  const nextIndex = lengthCfg(s).showRounds.indexOf(s.round) + 1;
  const options = shuffle(randFn(s), Object.keys(C.categories)).slice(0, C.sympathyVote.choices);
  s.sympathy = { chooser, nextIndex, options };
  setStep(ctx, 'sympathy', C.sympathyVote.durationSec);
  // The three choices are private to the chooser's authenticated seat view.
  // Never broadcast them in public events, even while the vote is pending.
  emit(ctx, 'sympathyStart', { chooser });
  log(ctx, 'sympathy', `${nameOf(s, chooser)} has been given the Sympathy Vote.`);
}
function finishSympathy(ctx, category) {
  const s = ctx.state;
  const vote = s.sympathy;
  s.shows[vote.nextIndex].categories = drawCategories(s, vote.nextIndex, [category]);
  emit(ctx, 'sympathyChosen', { chooser: vote.chooser, category });
  log(ctx, 'sympathy', `🥀 The judges took pity on ${nameOf(s, vote.chooser)}. They've chosen ${C.categories[category].name}.`);
  s.sympathy = null;
  nextRound(ctx);
}

function startPlan(ctx) {
  const s = ctx.state;
  setStep(ctx, 'plan', planSeconds(s));
  emit(ctx, 'planStart', { round: s.round, slots: slotCount(s) });
}

function defaultPlan(s, seat) {
  // Car-Boot Sales of the supplies this player holds least of.
  const h = P(s, seat).hand;
  const least = SUP.slice().sort((a, b) => h[a] - h[b]);
  return [...Array(slotCount(s))].map(() => ({ kind: 'carBoot', supplies: [least[0], least[1]] }));
}
const planComplete = (s, plan) => !!plan && plan.length === slotCount(s) && plan.every(Boolean);

function endPlan(ctx) {
  const s = ctx.state;
  s.players.forEach(p => {
    if (!planComplete(s, s.secrets.plans[p.seat])) s.secrets.plans[p.seat] = defaultPlan(s, p.seat);
    autoCompost(s, p.seat);
  });
  resolveActions(ctx);
  const n = s.resolution.events.length;
  const sec = Math.max(s.config.resolveMinSec, Math.min(s.config.resolveMaxSec, n * s.config.resolvePerEventSec));
  setStep(ctx, 'resolve', sec);
  emit(ctx, 'resolve', { round: s.round });
}

function compostedHand(s, seat) {
  // Work from a copy, reserving what an already committed plan will need.
  // If supplies fit within shed capacity, there is nothing to discard.
  const hand = { ...P(s, seat).hand };
  const amount = Math.min(s.secrets.compostOwed[seat] || 0, Math.max(0, handTotal(hand) - C.shedCapacity));
  const due = P(s, seat).locked ? planCommitment(s, seat) : emptyHand();
  for (let i = 0; i < amount; i++) {
    const pick = SUP.filter(r => hand[r] > 0).sort((a, b) =>
      (hand[b] - due[b]) - (hand[a] - due[a]) || hand[b] - hand[a])[0];
    if (pick) hand[pick] -= 1;
  }
  return hand;
}
function autoCompost(s, seat) {
  if (!s.secrets.compostOwed[seat]) return;
  P(s, seat).hand = compostedHand(s, seat);
  delete s.secrets.compostOwed[seat];
}

/* ---------- resolving actions ---------- */

function actionCost(s, seat, slot, plot) {
  const god = godOf(s, seat);
  switch (slot.kind) {
    case 'shelter': return C.actions.shelter.cost;
    case 'meddle':
      return ownedBy(s, seat).some(p => p.feature === 'gnomeBattalion') ? {} : C.actions.meddle.cost;
    case 'pray':
      return ownedBy(s, seat).some(p => p.feature === 'gnomeBattalion') ? {} : C.actions.pray.cost;
    case 'tend': {
      if (!plot) return C.actions.tend.cost;
      const topo = getTopology(s.board.layoutId);
      const near = [plot.id, ...topo.hexById[plot.id].neighbors].map(id => plotById(s, id));
      return C.actions.tend.cost;
    }
    case 'claim': return god === 'thor' ? { turf: 1 } : C.actions.claim.cost;
    case 'cultivate': return featureDef(slot.feature) ? featureDef(slot.feature).cost : null;
    default: return {};
  }
}

function resolveActions(ctx) {
  const s = ctx.state;
  const topo = ctx.topo;
  const plans = s.secrets.plans;
  const order = initiativeOrder(s);
  const sheltered = new Set();
  const events = [];

  ORDER.forEach(kind => {
    const entries = [];
    order.forEach(seat => (plans[seat] || []).forEach((slot, i) => { if (slot && slot.kind === kind) entries.push({ seat, slot, i }); }));
    // Every submitted Pray targeting one original forecast hit counts towards the
    // conflict, regardless of initiative. Ordinary prayers cancel one another;
    // Loki's special prayer cannot be cancelled.
    const conflicts = new Map();
    const validPrayers = new Set();
    if (kind === 'pray') entries.forEach(e => {
      const key = `${e.slot.index}:${e.slot.target}`;
      if (prayError(s, topo, e.seat, e.slot) === null) {
        validPrayers.add(e);
        conflicts.set(key, (conflicts.get(key) || 0) + 1);
      }
    });
    entries.forEach(e => events.push(doAction(ctx, topo, e, sheltered, conflicts, validPrayers)));
  });

  s.roundState.sheltered = [...sheltered];
  s.resolution = {
    round: s.round,
    plans: Object.fromEntries(Object.entries(plans).map(([seat, plan]) => [seat, plan])),
    events
  };
  const fizzled = events.filter(e => !e.ok).length;
  s.stats.actions += events.length;
  s.stats.fizzled += fizzled;
  events.forEach(e => { s.stats.byKind[e.kind] = (s.stats.byKind[e.kind] || 0) + 1; });
}

function doAction(ctx, topo, e, sheltered, prayConflicts = new Map(), validPrayers = new Set()) {
  const s = ctx.state;
  const { seat, slot } = e;
  const p = P(s, seat);
  const god = p.god;
  const ev = { seat, slot: e.i, kind: slot.kind, target: slot.target || null, ok: false, reason: null };
  const plot = slot.target ? plotById(s, slot.target) : null;
  const fail = reason => { ev.reason = reason; return ev; };

  switch (slot.kind) {
    case 'pray': {
      if (!validPrayers.has(e)) return fail('Invalid or changed forecast target');
      const cost = actionCost(s, seat, slot);
      if (!hasAll(p.hand, cost)) return fail('could not afford it');
      pay(s, seat, cost); // conflict always costs Dust, as promised
      const d = s.forecast.now[slot.index];
      ev.from = slot.target;
      ev.to = slot.to;
      ev.disasterIndex = slot.index;
      ev.disasterName = d.name;
      ev.good = d.good;
      ev.victim = plotById(s, slot.to).owner;
      if (god !== 'loki' && (prayConflicts.get(`${slot.index}:${slot.target}`) || 0) > 1)
        return fail('The gods received conflicting requests and did nothing.');
      if (!d.plots.includes(slot.target)) return fail('The apocalypse has already moved');
      if (d.plots.includes(slot.to)) return fail('The disaster already moved there');
      d.plots.splice(d.plots.indexOf(slot.target), 1, slot.to);
      ev.ok = true;
      ev.blame = C.prayLines[int(randFn(s), C.prayLines.length)]
        .replaceAll('{actor}', nameOf(s, seat)).replaceAll('{victim}', ev.victim === null ? 'an unclaimed plot' : nameOf(s, ev.victim))
        .replaceAll('{disaster}', d.name);
      if (god === 'loki') ev.power = 'loki';
      log(ctx, 'pray', `${nameOf(s, seat)} forwarded ${d.name} to another garden.`, seat);
      return ev;
    }
    case 'shelter': {
      if (!plot || plot.owner !== seat) return fail('not your plot');
      const cost = actionCost(s, seat, slot, plot);
      if (!hasAll(p.hand, cost)) return fail('could not afford it');
      pay(s, seat, cost);
      sheltered.add(plot.id);
      ev.ok = true;
      return ev;
    }
    case 'meddle': {
      if (!plot || plot.owner === null || plot.owner === seat) return fail('nobody to meddle with');
      if (!touchesGarden(s, topo, seat, plot.id)) return fail('not next to your garden');
      const cost = actionCost(s, seat, slot, plot);
      if (!hasAll(p.hand, cost)) return fail('could not afford it');
      pay(s, seat, cost);
      ev.victim = plot.owner;
      if (sheltered.has(plot.id)) return fail('the plot was sheltered');
      if (godOf(s, plot.owner) === 'heimdall') {
        gain(s, plot.owner, cost);
        ev.power = 'heimdall';
        return fail('Heimdall saw it coming');
      }
      if (slot.mode === 'pilfer') {
        // A plot tells you where to look first. If its usual supply has run
        // out, nick the victim's most abundant supply instead. No invisible
        // hand information is revealed until this action actually resolves.
        const preferred = C.terrainSupply[plot.terrain];
        const victim = P(s, plot.owner);
        const alternative = SUP.slice().sort((a, b) => victim.hand[b] - victim.hand[a])[0];
        const sup = preferred && victim.hand[preferred] > 0 ? preferred
          : C.actions.meddle.pilferFallback === 'mostAbundant' && victim.hand[alternative] > 0 ? alternative : null;
        if (sup) {
          victim.hand[sup] -= 1;
          p.hand[sup] += 1;
        }
        ev.took = sup;
      } else {
        const before = plot.health;
        plot.health -= 1;
        capHealth(plot);
        ev.damage = before - plot.health;
        s.stats.damage.meddle += ev.damage;
        if (god === 'loki' && ev.damage > 0) {
          const mine = topo.hexById[plot.id].neighbors.map(id => plotById(s, id))
            .filter(x => x.owner === seat && x.health < (x.condition === 'ash' ? 2 : 3))
            .sort((a, b) => a.health - b.health)[0];
          if (mine) { mine.health += 1; capHealth(mine); ev.lokiTo = mine.id; ev.power = 'loki'; }
        }
      }
      ev.blame = C.meddleLines[int(randFn(s), C.meddleLines.length)]
        .replaceAll('{actor}', nameOf(s, seat)).replaceAll('{victim}', nameOf(s, ev.victim));
      ev.ok = true;
      return ev;
    }
    case 'tend': {
      if (!plot || plot.owner !== seat) return fail('not your plot');
      const cost = actionCost(s, seat, slot, plot);
      if (!hasAll(p.hand, cost)) return fail('could not afford it');
      pay(s, seat, cost);
      if (plot.condition && C.conditions[plot.condition].bad) {
        ev.cleared = plot.condition;
        plot.condition = null;
        // Clearing a hazard also restores the plot; Freya remains twice as effective.
        plot.health += god === 'freya' ? 2 : 1;
      } else {
        plot.health += god === 'freya' ? 2 : 1;
      }
      if (god === 'freya') ev.power = 'freya';
      capHealth(plot);
      s.stats.repaired += 1;
      ev.ok = true;
      return ev;
    }
    case 'claim': {
      if (!plot || plot.owner !== null) return fail('someone got there first');
      if (!touchesGarden(s, topo, seat, plot.id)) return fail('not next to your garden');
      const cost = actionCost(s, seat, slot, plot);
      if (!hasAll(p.hand, cost)) return fail('could not afford it');
      pay(s, seat, cost);
      plot.owner = seat;
      if (god === 'thor') ev.power = 'thor';
      ev.ok = true;
      return ev;
    }
    case 'cultivate': {
      const def = featureDef(slot.feature);
      if (!def) return fail('unknown feature');
      if (!plot || plot.owner !== seat) return fail('not your plot');
      if (plot.feature) return fail('already has a feature');
      if (plot.health < 1) return fail('the plot is ruined');
      if (!hasAll(p.hand, def.cost)) return fail('could not afford it');
      pay(s, seat, def.cost);
      plot.feature = slot.feature;
      ev.feature = slot.feature;
      ev.ok = true;
      return ev;
    }
    case 'carBoot': {
      const picks = Array.isArray(slot.supplies) ? slot.supplies.filter(isSupply).slice(0, C.actions.carBoot.gain) : [];
      while (picks.length < C.actions.carBoot.gain) picks.push(SUP[picks.length]);
      picks.forEach(r => { p.hand[r] += 1; });
      ev.gained = picks;
      ev.ok = true;
      return ev;
    }
    default:
      return fail('unknown action');
  }
}

/* ---------- disasters, emergencies, harvest, shows ---------- */

function strikeDisasters(ctx) {
  const s = ctx.state;
  const sheltered = new Set(s.roundState.sheltered);
  const hel = seatWithGod(s, 'hel');
  const report = [];

  s.forecast.now.forEach(d => {
    const hits = [];
    d.plots.forEach(id => {
      const plot = plotById(s, id);
      if (d.good) {
        if (d.setHealth !== undefined) plot.health = d.setHealth;
        else plot.health += d.health;
        if (d.condition) plot.condition = d.condition;
        capHealth(plot);
        hits.push({ id, result: 'blessed' });
        return;
      }
      if (sheltered.has(id)) { hits.push({ id, result: 'sheltered' }); return; }
      if (plot.condition === 'blessed') { plot.condition = null; hits.push({ id, result: 'absorbed' }); return; }
      const before = plot.health;
      const hadFeature = plot.feature;
      plot.health += d.health;
      if (d.condition) {
        const immune = plot.feature && (featureDef(plot.feature).immune || []).includes(d.condition);
        if (!immune) plot.condition = d.condition;
      }
      capHealth(plot);
      const lost = hadFeature && !plot.feature;
      if (plot.owner !== null) {
        s.stats.damage.disaster += before - plot.health;
        s.stats.byDisaster = s.stats.byDisaster || {};
        s.stats.byDisaster[d.key] = (s.stats.byDisaster[d.key] || 0) + (before - plot.health);
      }
      if (plot.health < before && hel !== null && plot.owner !== hel && s.roundState.helGained < C.hel.perRoundCap) {
        P(s, hel).hand.compost += 1;
        s.roundState.helGained += 1;
        if (s.roundState.helGained === 1) emit(ctx, 'godPower', { seat: hel, god: 'hel' });
      }
      hits.push({ id, result: lost ? 'featureLost' : plot.health < before ? 'damaged' : 'condition', owner: plot.owner });
    });
    report.push({ key: d.key, name: d.name, good: d.good, hits });
    if (hits.some(h => h.result === 'featureLost')) emit(ctx, 'featureLost', { key: d.key });
    s.stats.disasters += 1;
  });
  s.disasterReport = report;
  emit(ctx, 'disasters', { count: report.length, keys: report.map(r => r.key) });
  report.forEach(r => log(ctx, 'disaster', `${r.name}!`));

  if (s.emergency) resolveEmergency(ctx);
}

function resolveEmergency(ctx) {
  const s = ctx.state;
  const em = s.emergency;
  const paid = {};
  let total = 0;
  s.players.forEach(p => {
    const pledge = s.secrets.pledges[p.seat];
    if (!pledge) return;
    const actual = emptyHand();
    SUP.forEach(r => { actual[r] = Math.min(pledge[r] || 0, p.hand[r]); });
    pay(s, p.seat, actual);
    const count = handTotal(actual);
    if (!count) return;
    paid[p.seat] = actual;
    total += count * (p.god === 'frigg' ? 2 : 1);
  });
  em.total = total;
  em.paid = Object.fromEntries(Object.entries(paid).map(([seat, b]) => [seat, handTotal(b)]));
  em.result = total >= em.target ? 'success' : 'failed';
  s.stats.emergencies.push(em.result);

  if (em.result === 'success') {
    const top = Math.max(0, ...Object.values(em.paid));
    Object.entries(em.paid).forEach(([seatKey, n]) => {
      const p = P(s, Number(seatKey));
      p.goodwill += Math.max(1, Math.floor(n / 2));
      if (n === top) p.goodwill += 1;
      if (p.god === 'frigg') { p.goodwill += 1; emit(ctx, 'godPower', { seat: p.seat, god: 'frigg' }); }
    });
    log(ctx, 'emergency', `${em.name}: averted! (${total} of ${em.target})`);
  } else {
    Object.entries(paid).forEach(([seatKey, b]) => {
      const refund = emptyHand();
      SUP.forEach(r => { refund[r] = Math.floor(b[r] / 2); });
      gain(s, Number(seatKey), refund);
    });
    applyEmergencyFailure(s, em.fail);
    if (s.round < lengthCfg(s).rounds) {
      const extra = reveal(s, ctx.topo, makeDisaster(s, actOf(s, s.round + 1)));
      s.forecast.next.push(extra);
    }
    log(ctx, 'emergency', `${em.name}: the street failed (${total} of ${em.target}).`);
  }
  emit(ctx, 'emergency', { result: em.result, total, target: em.target });
}

function applyEmergencyFailure(s, fail) {
  if (fail.kind === 'loseSupplies') {
    s.players.forEach(p => {
      for (let i = 0; i < fail.count; i++) {
        const most = SUP.slice().sort((a, b) => p.hand[b] - p.hand[a])[0];
        if (p.hand[most] > 0) p.hand[most] -= 1;
      }
    });
  }
  if (fail.kind === 'damageBest') {
    s.players.forEach(p => {
      ownedBy(s, p.seat).sort((a, b) => b.health - a.health).slice(0, fail.count).forEach(plot => {
        const before = plot.health;
        plot.health += fail.health;
        capHealth(plot);
        s.stats.damage.emergency += before - plot.health;
        if (fail.loseFeaturesWithered && plot.health === 1) plot.feature = null;
      });
    });
  }
  if (fail.kind === 'damageOwned') {
    s.board.plots.forEach(plot => {
      if (plot.owner === null) return;
      const before = plot.health;
      plot.health += fail.health;
      s.stats.damage.emergency += before - Math.max(0, plot.health);
      capHealth(plot);
      if (fail.loseFeaturesWithered && plot.health === 1) plot.feature = null;
    });
  }
}

function plotYield(s, plot) {
  const sup = C.terrainSupply[plot.terrain];
  if (!sup) return 0;
  // A ruined plot cannot harvest even when Blessed. The blessing boosts
  // a living garden; it must not revive a dead one via a yield bonus.
  if (plot.health <= 0) return 0;
  let n = C.yieldByHealth[plot.health];
  const cond = plot.condition ? C.conditions[plot.condition] : null;
  if (cond && cond.yieldZero && !(plot.condition === 'blighted' && godOf(s, plot.owner) === 'njord')) n = 0;
  if (plot.condition === 'blighted' && godOf(s, plot.owner) === 'njord' && n > 0) s.roundState.njordPower = true;
  if (cond && cond.yieldBonus) n += cond.yieldBonus;
  if (plot.feature && featureDef(plot.feature).lushYieldBonus && plot.health === 3) n += featureDef(plot.feature).lushYieldBonus;
  return n;
}

function harvest(ctx) {
  const s = ctx.state;
  const gains = {};
  s.board.plots.forEach(plot => {
    if (plot.owner === null) return;
    const n = plotYield(s, plot);
    if (!n) return;
    const sup = C.terrainSupply[plot.terrain];
    P(s, plot.owner).hand[sup] += n;
    gains[plot.owner] = gains[plot.owner] || emptyHand();
    gains[plot.owner][sup] += n;
  });
  s.players.forEach(p => {
    const over = handTotal(p.hand) - C.shedCapacity;
    if (over > 0) s.secrets.compostOwed[p.seat] = over;
  });
  s.harvestReport = gains;
  emit(ctx, 'harvest', { gains });
  if (s.roundState.njordPower) emit(ctx, 'godPower', { seat: seatWithGod(s, 'njord'), god: 'njord' });
}

function metric(s, seat, cat) {
  const plots = ownedBy(s, seat);
  const counted = plots.filter(p => p.feature);
  switch (cat.measure) {
    case 'tag': return counted.reduce((n, p) => n + (featureDef(p.feature).tags.includes(cat.tag)
      ? (cat.tag === 'water' && godOf(s, seat) === 'njord' ? 2 : 1) : 0), 0);
    case 'lush': return plots.filter(p => p.health === 3).length;
    case 'plots': return plots.length;
    case 'health': return plots.reduce((n, p) => n + p.health, 0);
    case 'undamaged': return plots.filter(p => p.health <= 1).length; // lower is better
    case 'goodwill': return P(s, seat).goodwill;
    default: return 0;
  }
}

/* Rank a Show category against the *current* public garden. Used for both
   provisional Show previews and final judging so the two cannot disagree.
   Tied players share the same rank and award; ties never consume extra places. */
function categoryStandings(s, key) {
  const cat = C.categories[key];
  const pts = C.showPoints[String(s.players.length)] || C.showPoints['8'];
  const lowerBetter = cat.measure === 'undamaged';
  const rows = s.players.map(p => ({ seat: p.seat, value: metric(s, p.seat, cat), plots: ownedBy(s, p.seat).length }))
    .filter(r => cat.minPlots ? r.plots >= cat.minPlots : r.value >= 1);
  rows.forEach(r => {
    const better = rows.filter(o => lowerBetter ? o.value < r.value : o.value > r.value).length;
    r.rank = better + 1;
    r.points = better < pts.length ? pts[better] : 0;
  });
  return rows.sort((a, b) => a.rank - b.rank || a.seat - b.seat);
}

/* Public, read-only snapshot: not a prediction of secret actions or disasters.
   Only the next already-announced Show is exposed; unannounced categories remain
   sealed. No state or RNG mutation is permitted while calculating a preview. */
function upcomingShowStandings(s) {
  if (!s.board || s.phase.stage !== 'playing') return null;
  const show = s.shows.find(sh => sh.categories && !sh.results);
  if (!show) return null;
  return {
    after: show.after,
    categories: show.categories.map(key => ({ key, rows: categoryStandings(s, key) })),
    provisional: true
  };
}

function scoreShow(ctx, showIndex) {
  const s = ctx.state;
  const show = s.shows[showIndex];
  const results = {};
  show.categories.forEach(key => {
    const rows = categoryStandings(s, key);
    rows.forEach(r => { P(s, r.seat).showPoints += r.points; });
    results[key] = rows;
  });
  show.results = results;
  s.stats.showLeaders.push(currentLeader(s));
  emit(ctx, 'show', { index: showIndex });
  log(ctx, 'show', `Village Garden Show ${showIndex + 1} judged.`);
}

/* Simplified party rules: no invisible adjacency Prestige. */
function gardenDesignBonus() { return 0; }

function featurePrestige(s, seat) {
  const njord = godOf(s, seat) === 'njord';
  return ownedBy(s, seat).reduce((n, p) => {
    if (!p.feature) return n;
    const def = featureDef(p.feature);
    return n + def.prestige + (njord && def.tags.includes('water') ? C.njordWaterBonus : 0);
  }, 0);
}

function scoreOf(s, seat) {
  const p = P(s, seat);
  const designBonus = 0;
  const features = featurePrestige(s, seat);
  return { seat, designBonus, shows: p.showPoints, features, goodwill: p.goodwill, total: p.showPoints + features + p.goodwill,
    featureCount: ownedBy(s, seat).filter(x => x.feature).length, health: ownedBy(s, seat).reduce((n, x) => n + x.health, 0) };
}

function currentLeader(s) {
  const scores = s.players.map(p => scoreOf(s, p.seat)).sort((a, b) => b.total - a.total);
  return scores[0] ? scores[0].seat : null;
}

/* End-of-game honours celebrate different playstyles; these are cosmetic,
   award every tied leader and deliberately do not affect victory or score. */
function gardenHonours(s, scores) {
  const categories = [
    { key: 'showstopper', name: 'Showstopper', icon: '🏆', description: 'Most Garden Show points', measure: row => row.shows },
    { key: 'neighbour', name: 'Neighbourhood Hero', icon: '🤝', description: 'Most Goodwill', measure: row => row.goodwill },
    { key: 'lush', name: 'Lush Legend', icon: '🌱', description: 'Most surviving Lush plots',
      measure: row => ownedBy(s, row.seat).filter(p => p.health === 3).length }
  ];
  return categories.map(c => {
    const best = Math.max(0, ...scores.map(c.measure));
    if (best <= 0) return null; // never celebrate a nonexistent achievement
    return { key: c.key, name: c.name, icon: c.icon, description: c.description,
      value: best, seats: scores.filter(row => c.measure(row) === best).map(row => row.seat) };
  }).filter(Boolean);
}

function finishGame(ctx) {
  const s = ctx.state;
  const scores = s.players.map(p => scoreOf(s, p.seat));
  const cmp = (a, b) => b.total - a.total || b.goodwill - a.goodwill || b.featureCount - a.featureCount || b.health - a.health;
  scores.sort(cmp);
  const top = scores[0];
  const winners = scores.filter(x => cmp(x, top) === 0).map(x => x.seat);
  s.final = { scores, winners, honours: gardenHonours(s, scores) };
  s.winner = { seats: winners, at: ctx.now };
  s.phase.stage = 'gameOver';
  s.phase.step = null;
  s.phase.deadline = null;
  s.room.status = 'finished';
  emit(ctx, 'win', { seats: winners });
  log(ctx, 'win', `${winners.map(w => nameOf(s, w)).join(' & ')} win${winners.length > 1 ? '' : 's'} the Golden Flamingo!`);
}

/* The step machine: called when a step's time is up. */
function advanceStep(ctx) {
  const s = ctx.state;
  const cfg = lengthCfg(s);
  switch (s.phase.step) {
    case 'omens': startPlan(ctx); return;
    case 'plan': endPlan(ctx); return;
    case 'resolve': strikeDisasters(ctx); setStep(ctx, 'disasters', s.config.disastersSec); return;
    case 'disasters': harvest(ctx); setStep(ctx, 'harvest', s.config.harvestSec); return;
    case 'harvest': {
      const showIndex = cfg.showRounds.indexOf(s.round);
      if (showIndex >= 0) { scoreShow(ctx, showIndex); setStep(ctx, 'show', s.config.showSec); return; }
      nextRound(ctx);
      return;
    }
    case 'show': {
      const i = cfg.showRounds.indexOf(s.round);
      if (i >= 0 && i < cfg.showRounds.length - 1) beginSympathy(ctx);
      else nextRound(ctx);
      return;
    }
    case 'sympathy': finishSympathy(ctx, s.sympathy.options[0]); return;
    default:
  }
}

function nextRound(ctx) {
  const s = ctx.state;
  if (s.round >= lengthCfg(s).rounds) { finishGame(ctx); return; }
  s.earlyBird = (s.earlyBird + 1) % s.players.length;
  beginRound(ctx, s.round + 1);
}

/* ---------- planning ---------- */

function validateSlot(s, topo, seat, slot, idx, slots) {
  if (!slot || typeof slot !== 'object' || !ORDER.includes(slot.kind)) return 'Choose an action';
  const plot = slot.target ? plotById(s, slot.target) : null;
  const others = slots.filter((x, i) => x && i !== idx);
  const claims = others.filter(x => x.kind === 'claim').map(x => x.target);
  const earlierClaims = slots.slice(0, idx).filter(x => x && x.kind === 'claim').map(x => x.target);
  switch (slot.kind) {
    case 'pray': return prayError(s, topo, seat, slot);
    case 'shelter':
    case 'tend':
      if (!plot || plot.owner !== seat) return 'Pick one of your own plots';
      return null;
    case 'meddle':
      if (!plot || plot.owner === null || plot.owner === seat) return "Pick a rival's plot";
      if (!touchesGarden(s, topo, seat, plot.id)) return 'It must be next to your garden';
      if (!['trample', 'pilfer'].includes(slot.mode)) return 'Choose Trample or Pilfer';
      return null;
    case 'claim':
      if (!plot || plot.owner !== null) return 'Pick an unowned plot';
      if (!touchesGarden(s, topo, seat, plot.id, earlierClaims)) return 'It must be next to your garden';
      if (claims.includes(plot.id)) return 'You are already claiming that plot';
      return null;
    case 'cultivate':
      if (!featureDef(slot.feature)) return 'Choose a feature';
      if (!plot) return 'Pick a plot';
      if (plot.owner !== seat && !claims.includes(plot.id)) return 'Pick one of your plots';
      if (plot.feature) return 'That plot already has a feature';
      if (plot.health < 1) return 'That plot is ruined';
      if (others.some(x => x.kind === 'cultivate' && x.target === plot.id)) return 'Only one feature per plot';
      return null;
    case 'carBoot':
      if (!Array.isArray(slot.supplies) || slot.supplies.length !== C.actions.carBoot.gain || !slot.supplies.every(isSupply)) return 'Choose 2 supplies';
      return null;
    default:
      return 'Unknown action';
  }
}

function cleanSlot(slot) {
  if (!slot || typeof slot !== 'object') return null;
  const out = { kind: slot.kind };
  if (typeof slot.target === 'string') out.target = slot.target.slice(0, 8);
  if (Number.isInteger(slot.index)) out.index = slot.index;
  if (typeof slot.to === 'string') out.to = slot.to.slice(0, 8);
  if (typeof slot.mode === 'string') out.mode = slot.mode;
  if (typeof slot.feature === 'string') out.feature = slot.feature;
  if (Array.isArray(slot.supplies)) out.supplies = slot.supplies.slice(0, 2).map(String);
  return out;
}

function allLocked(s) {
  // Disconnection is not consent: an offline player keeps their planning time.
  // An uncommitted plan is resolved only when the deadline (and any grace) expires.
  return s.players.length > 0 && s.players.every(p => p.locked);
}

function planCommitment(s, seat) {
  const due = emptyHand();
  for (const slot of s.secrets.plans[seat] || []) {
    const plot = slot.target ? plotById(s, slot.target) : null;
    const cost = actionCost(s, seat, slot, plot) || {};
    SUP.forEach(r => { due[r] += cost[r] || 0; });
  }
  // Emergency pledges are spent after actions. Reserve them as well; a pledged
  // card must not be double-spent on a garden action.
  const pledge = s.secrets.pledges[seat] || {};
  SUP.forEach(r => { due[r] += pledge[r] || 0; });
  return due;
}


/* ---------- actions ---------- */

const ACTIONS = {
  sympathyPick(ctx, seat, a) {
    const s = ctx.state;
    if (s.phase.step !== 'sympathy' || !s.sympathy) return 'No Sympathy Vote is being held';
    if (seat !== s.sympathy.chooser) return 'The judges did not ask you';
    if (!s.sympathy.options.includes(a.category)) return 'Choose one of the three options';
    finishSympathy(ctx, a.category);
    return null;
  },
  setOption(ctx, seat, a) {
    const s = ctx.state;
    if (s.phase.stage !== 'lobby') return 'Options can only change in the lobby';
    if (seat !== 0) return 'Only the host can change options';
    // Validate the *whole* transaction before changing any setting.
    if (a.length !== undefined && !Object.hasOwn(C.lengths, a.length)) return 'Unknown game length';
    if (a.planSec !== undefined && a.planSec !== null &&
        (!Number.isInteger(a.planSec) || a.planSec < 30 || a.planSec > 180)) return 'Plan timer must be 30–180 seconds';
    if (a.length !== undefined) s.config.length = a.length;
    if (a.planSec !== undefined) s.config.planSec = a.planSec;
    return null;
  },

  start(ctx, seat) {
    const s = ctx.state;
    if (s.phase.stage !== 'lobby') return 'The game has already started';
    if (seat !== 0) return 'Only the host can start the game';
    if (s.players.length < 2) return 'You need at least 2 players';
    const rand = randFn(s);
    buildBoard(s, rand);
    ctx.topo = getTopology(s.board.layoutId);
    s.players.forEach(p => { p.hand = { ...C.startingSupplies }; });
    const cfg = lengthCfg(s);
    s.shows = cfg.showRounds.map(after => ({ after, categories: null, results: null }));
    s.secrets.categoryPool = shuffle(rand, Object.keys(C.categories));
    s.room.status = 'inGame';
    s.phase.stage = 'draft';
    s.phase.draftQueue = [...Array(s.players.length).keys()].reverse();
    s.phase.activeSeat = s.phase.draftQueue[0];
    setStep(ctx, 'draft', s.config.draftSec);
    emit(ctx, 'gameStarted', { layoutId: s.board.layoutId });
    log(ctx, 'start', `The street is open: ${s.players.length} gardeners, ${cfg.rounds} rounds.`);
    return null;
  },

  chooseGod(ctx, seat, a) {
    const s = ctx.state;
    const ph = s.phase;
    if (ph.stage !== 'draft') return 'The god draft is not running';
    if (ph.draftQueue[0] !== seat) return "It isn't your pick yet";
    if (!GOD_IDS.includes(a.god)) return 'Unknown god';
    if (s.players.some(p => p.god === a.god)) return 'That god is taken';
    P(s, seat).god = a.god;
    ph.draftQueue.shift();
    emit(ctx, 'godChosen', { seat, god: a.god });
    log(ctx, 'god', `${nameOf(s, seat)} worships ${C.gods[a.god].name}.`, seat);
    if (!ph.draftQueue.length) { ph.activeSeat = null; beginGame(ctx); }
    else { ph.activeSeat = ph.draftQueue[0]; setStep(ctx, 'draft', s.config.draftSec); }
    return null;
  },

  plan(ctx, seat, a) {
    const s = ctx.state;
    if (s.phase.stage !== 'playing' || s.phase.step !== 'plan') return 'Plans can only be made in the Plan phase';
    const p = P(s, seat);
    if (p.locked) return 'Unlock your plan to change it';
    const n = slotCount(s);
    if (!Array.isArray(a.slots) || a.slots.length !== n) return `A plan has ${n} actions this round`;
    const slots = a.slots.map(cleanSlot);
    for (let i = 0; i < n; i++) {
      if (!slots[i]) continue;
      const err = validateSlot(s, ctx.topo, seat, slots[i], i, slots);
      if (err) return `Action ${i + 1}: ${err}`;
    }
    s.secrets.plans[seat] = slots;
    return null;
  },

  lock(ctx, seat) {
    const s = ctx.state;
    if (s.phase.step !== 'plan') return 'Nothing to lock in';
    if (!planComplete(s, s.secrets.plans[seat])) return 'Choose all your actions first';
    if (!hasAll(compostedHand(s, seat), planCommitment(s, seat)))
      return 'Your plan and emergency pledge need more supplies than you hold. Edit the plan or lower your pledge before locking.';
    P(s, seat).locked = true;
    emit(ctx, 'locked', { seat });
    if (allLocked(s)) endPlan(ctx);
    return null;
  },

  unlock(ctx, seat) {
    const s = ctx.state;
    if (s.phase.step !== 'plan') return 'Too late to change your plan';
    P(s, seat).locked = false;
    return null;
  },

  pledge(ctx, seat, a) {
    const s = ctx.state;
    if (s.phase.step !== 'plan' || !s.emergency) return 'There is no emergency to pledge to';
    if (P(s, seat).locked) return 'Unlock your plan to change your pledge';
    const b = cleanBundle(a.supplies);
    if (!b) return 'Invalid pledge';
    if (!hasAll(P(s, seat).hand, b)) return "You don't have those supplies";
    s.secrets.pledges[seat] = b;
    return null;
  },

  compost(ctx, seat, a) {
    const s = ctx.state;
    const owed = s.secrets.compostOwed[seat];
    if (!owed) return 'Your shed is not over capacity';
    if (P(s, seat).locked) return 'Unlock your plan before changing supplies';
    const b = cleanBundle(a.cards);
    if (!b || handTotal(b) !== owed) return `Compost exactly ${owed}`;
    if (!hasAll(P(s, seat).hand, b)) return "You don't have those supplies";
    pay(s, seat, b);
    delete s.secrets.compostOwed[seat];
    return null;
  },

  odinShift(ctx, seat, a) {
    const s = ctx.state;
    const p = P(s, seat);
    if (p.god !== 'odin') return 'Only Odin can do that';
    if (s.phase.step !== 'plan') return 'Only during the Plan phase';
    if (p.odinUsedAct === s.act) return 'Already used this act';
    if (p.locked) return 'Unlock your plan before changing the forecast';
    const d = s.forecast.now[a.index];
    if (!d || d.target.kind !== 'sector') return 'Pick a sector disaster';
    if (a.dir !== 1 && a.dir !== -1) return 'Choose a direction';
    d.sector = (d.sector + a.dir + 6) % 6;
    d.plots = targetPlots(s, ctx.topo, d.target, d);
    p.odinUsedAct = s.act;
    emit(ctx, 'odinShift', { seat, index: a.index, sector: d.sector });
    emit(ctx, 'godPower', { seat, god: 'odin' });
    log(ctx, 'god', `Odin nudges ${d.name} along the street.`, seat);
    return null;
  },

  skip(ctx, seat) {
    const s = ctx.state;
    if (seat !== 0) return 'Only the host can skip';
    if (!['omens', 'resolve', 'disasters', 'harvest', 'show', 'sympathy'].includes(s.phase.step)) return 'Nothing to skip';
    advanceStep(ctx);
    return null;
  }

};

/* ---------- public API ---------- */

function createGame({ roomCode = 'TEST', seed, config = {}, now = Date.now() } = {}) {
  const s = (seed === undefined ? crypto.randomBytes(4).readUInt32LE(0) : seed) >>> 0;
  return {
    schema: 'ragnagrok.gamestate',
    schemaVersion: SCHEMA_VERSION,
    stateVersion: 0,
    createdAt: now,
    updatedAt: now,
    room: { code: roomCode, status: 'lobby' },
    config: { ...DEFAULT_CONFIG, ...config },
    phase: { stage: 'lobby', step: null, deadline: null, draftQueue: [], activeSeat: null },
    round: 0, act: 0, earlyBird: 0,
    board: null,
    players: [],
    forecast: { now: [], next: [] },
    emergency: null,
    sympathy: null,
    shows: [],
    resolution: null, disasterReport: null, harvestReport: null,
    roundState: { sheltered: [], helGained: 0 },
    log: [],
    final: null, winner: null,
    stats: { actions: 0, fizzled: 0, byKind: {}, disasters: 0, emergencies: [], showLeaders: [], damage: { disaster: 0, meddle: 0, emergency: 0 }, repaired: 0 },
    secrets: { rng: { s }, playerTokens: {}, plans: {}, pledges: {}, compostOwed: {}, decks: {}, queue: {}, pendingExtra: [], categoryPool: [], }
  };
}

function addPlayer(state, { name, avatar } = {}, now = Date.now()) {
  if (state.phase.stage !== 'lobby') return { ok: false, error: 'The game has already started' };
  if (state.players.length >= state.config.maxPlayers) return { ok: false, error: 'The street is full' };
  const seat = state.players.length;
  const clean = String(name || '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16) || `Gardener ${seat + 1}`;
  state.players.push({
    seat, name: clean, avatar: String(avatar || '🌱').slice(0, 8), colour: COLOURS[seat],
    god: null, connected: true, disconnectedAt: null, hand: emptyHand(), showPoints: 0, goodwill: 0, locked: false, odinUsedAct: null
  });
  const token = crypto.randomBytes(12).toString('hex');
  state.secrets.playerTokens[seat] = token;
  state.stateVersion += 1;
  state.updatedAt = now;
  return { ok: true, seat, token, events: [{ type: 'playerJoined', seat }] };
}

function removePlayer(state, seat, now = Date.now()) {
  if (state.phase.stage !== 'lobby') return { ok: false, error: 'Players can only leave in the lobby' };
  if (!state.players[seat]) return { ok: false, error: 'Unknown player' };
  const tokens = state.players.map(p => state.secrets.playerTokens[p.seat]);
  state.players.splice(seat, 1);
  tokens.splice(seat, 1);
  state.secrets.playerTokens = {};
  state.players.forEach((p, i) => { p.seat = i; p.colour = COLOURS[i]; state.secrets.playerTokens[i] = tokens[i]; });
  state.stateVersion += 1;
  state.updatedAt = now;
  return { ok: true, events: [{ type: 'playerLeft' }] };
}

function seatForToken(state, token) {
  if (typeof token !== 'string') return -1;
  const hit = Object.entries(state.secrets.playerTokens).find(([, t]) => t === token);
  return hit ? Number(hit[0]) : -1;
}

function setConnected(state, seat, connected, now = Date.now()) {
  const p = state.players[seat];
  if (!p || p.connected === connected) return;
  p.connected = connected;
  p.disconnectedAt = connected ? null : now;
  state.stateVersion += 1;
  state.updatedAt = now;
}

function finalize(ctx) {
  ctx.state.stateVersion += 1;
  ctx.state.updatedAt = ctx.now;
}

function apply(state, seat, action, now = Date.now()) {
  if (!action || typeof action.type !== 'string' || !Object.hasOwn(ACTIONS, action.type)) return { ok: false, error: 'Unknown action', events: [] };
  if (state.phase.stage === 'gameOver') return { ok: false, error: 'The game is over', events: [] };
  if (!Number.isInteger(seat) || !state.players[seat]) return { ok: false, error: 'Unknown player', events: [] };
  const ctx = mkCtx(state, now);
  const err = ACTIONS[action.type](ctx, seat, action);
  if (err) return { ok: false, error: err, events: [] };
  finalize(ctx);
  return { ok: true, events: ctx.events };
}

function autoDraft(ctx) {
  const s = ctx.state;
  const free = GOD_IDS.filter(g => !s.players.some(p => p.god === g));
  ACTIONS.chooseGod(ctx, s.phase.draftQueue[0], { god: free[int(randFn(s), free.length)] });
}

function tick(state, now = Date.now()) {
  const ctx = mkCtx(state, now);
  const ph = state.phase;
  let changed = false;
  if (ph.stage === 'playing' && ph.step === 'plan' && allLocked(state) && state.players.some(p => p.locked)) {
    endPlan(ctx);
    changed = true;
  }
  if (ph.deadline && now >= ph.deadline && ph.stage !== 'gameOver') {
    // A recently disconnected planner gets at most the configured grace period
    // after dropping. A disconnect never shortens the original plan timer.
    const graceUntil = ph.stage === 'playing' && ph.step === 'plan'
      ? Math.max(0, ...state.players.filter(p => !p.connected && !p.locked)
        .map(p => (p.disconnectedAt || now) + state.config.disconnectGraceSec * 1000))
      : 0;
    if (graceUntil > now) ph.deadline = Math.max(ph.deadline, graceUntil);
    else if (ph.stage === 'draft') autoDraft(ctx);
    else advanceStep(ctx);
    changed = true;
  }
  if (changed) finalize(ctx);
  return { changed, events: ctx.events };
}

/* Tests and robots: jump to the current deadline. */
function advance(state) {
  return tick(state, state.phase.deadline || state.updatedAt);
}

/* ---------- views ---------- */

function legalTargets(state, seat) {
  const s = state;
  const out = { pray: [], shelter: [], tend: [], meddle: [], claim: [], cultivate: [], features: Object.keys(C.features) };
  if (!s.board || s.phase.stage !== 'playing') return out;
  const topo = getTopology(s.board.layoutId);
  // A forecast hit is a useful Pray choice only when *some* disaster hitting
  // it can legally be redirected. Do not offer dead ends to phone planners.
  out.pray = [...new Set(s.forecast.now.flatMap(d => d.plots || []))].filter(from =>
    s.forecast.now.some((d, index) => d.plots.includes(from) &&
      s.board.plots.some(dest => prayError(s, topo, seat, { index, target: from, to: dest.id }) === null)));

  s.board.plots.forEach(p => {
    if (p.owner === seat) {
      out.shelter.push(p.id);
      out.tend.push(p.id);
      if (!p.feature && p.health >= 1) out.cultivate.push(p.id);
    } else if (p.owner === null) {
      if (touchesGarden(s, topo, seat, p.id)) out.claim.push(p.id);
    } else if (touchesGarden(s, topo, seat, p.id)) out.meddle.push(p.id);
  });
  return out;
}

function publicView(state) {
  const v = JSON.parse(JSON.stringify(state));
  delete v.secrets;
  const over = state.phase.stage === 'gameOver';
  v.players = state.players.map(p => ({
    seat: p.seat, name: p.name, avatar: p.avatar, colour: p.colour, god: p.god, connected: p.connected,
    handCount: handTotal(p.hand), showPoints: p.showPoints, goodwill: p.goodwill, locked: p.locked,
    plots: state.board ? ownedBy(state, p.seat).length : 0,
    score: state.board ? scoreOf(state, p.seat).total : 0
  }));
  if (v.board) delete v.board.index;
  if (v.emergency && v.emergency.result === null) {
    v.emergency.paid = null;
    // Pledges stay sealed until resolution. Even a group total reveals rival's
    // contribution by subtraction in a two-person game. Do not broadcast it.
  }
  if (!over) v.final = null;
  // The Sympathy Vote is a private decision for the last-placed gardener.
  // Spectators and rival phones may know who is choosing, but must not receive
  // the three category options before that player actually makes the choice.
  if (v.sympathy) delete v.sympathy.options;
  v.showPreview = upcomingShowStandings(state);
  return v;
}

function privateView(state, seat) {
  const v = publicView(state);
  const p = state.players[seat];
  if (!p) return v;
  if (state.sympathy && state.sympathy.chooser === seat && v.sympathy) {
    v.sympathy.options = [...state.sympathy.options];
  }
  const odinPreview = p.god === 'odin' && state.round
    ? (state.secrets.queue[state.round + 2] || []).map(d => ({ key: d.key, name: d.name }))
    : null;
  v.me = {
    seat,
    slots: state.round ? slotCount(state) : 2,
    hand: { ...p.hand },
    plan: state.secrets.plans[seat] || null,
    pledge: state.secrets.pledges[seat] || null,
    compostOwed: state.secrets.compostOwed[seat] || 0,
    odinPreview,
    odinCanShift: p.god === 'odin' && p.odinUsedAct !== state.act,
    legal: legalTargets(state, seat),
    commit: commitStatus(state, seat)
  };
  return v;
}

/* The lock rule, computed once on the server so the phone never has to guess.
   short lists the supplies the current plan plus pledge is missing. */
function commitStatus(state, seat) {
  const s = state;
  if (!s.board || s.phase.stage !== 'playing' || s.phase.step !== 'plan') return null;
  if (!planComplete(s, s.secrets.plans[seat])) return { complete: false, canLock: false, short: emptyHand() };
  const have = compostedHand(s, seat);
  const due = planCommitment(s, seat);
  const short = emptyHand();
  SUP.forEach(r => { short[r] = Math.max(0, (due[r] || 0) - (have[r] || 0)); });
  return { complete: true, canLock: SUP.every(r => short[r] === 0), short };
}

module.exports = {
  createGame, addPlayer, removePlayer, seatForToken, setConnected,
  apply, tick, advance, publicView, privateView, clientTopology, legalTargets,
  scoreOf, gardenDesignBonus, categoryStandings, upcomingShowStandings, gardenHonours, plotYield, slotCount, SCHEMA_VERSION, SUPPLIES: SUP, CONTENT: C
};
