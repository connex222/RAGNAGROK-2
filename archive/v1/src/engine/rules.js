'use strict';
/* Ragnagrok rules engine.

   Pure game logic: no sockets, no screens, no timers of its own.
   The server owns one state object per room and calls:

     createGame()      new room in the lobby
     addPlayer()       a phone joins (returns its seat and secret token)
     apply()           a player asks to do something; returns { ok, error, events }
     tick()            called about once a second; handles timeouts and expiring trades
     publicView()      what the TV may see
     privateView()     what one phone may see (includes legal moves for the UI)

   Every change goes through apply() or tick(), so every rule is enforced here
   and nowhere else. */

const crypto = require('crypto');
const { next, int, shuffle } = require('../../../../src/engine/rng');
const { getTopology, clientTopology } = require('../../../../src/engine/topology');
const { LAYOUTS, generateBoard } = require('../../../../src/engine/board');
const CARDS = require('../data/cards.json');

const RESOURCES = ['compost', 'fertilizer', 'sprinklers', 'turf', 'gnomeDust'];
const RESOURCE_NAMES = {
  compost: 'Eldritch Compost', fertilizer: 'Asgardian Fertilizer', sprinklers: 'Hellfire Sprinklers',
  turf: 'Yggdrasil Turf', gnomeDust: 'Gnome Dust'
};
const COSTS = {
  path:  { turf: 1, sprinklers: 1 },
  shack: { turf: 1, sprinklers: 1, fertilizer: 1, gnomeDust: 1 },
  manor: { fertilizer: 2, compost: 3 },
  perk:  { compost: 1, fertilizer: 1, gnomeDust: 1 }
};
const PIECES = { paths: 15, shacks: 5, manors: 4 };
const COLOURS = ['#E4572E', '#3B8EEA', '#F2C14E', '#7AC74F', '#B565D8', '#F28AB2', '#3CC6C0', '#E8E2D0'];
const FACTION_IDS = CARDS.factions.map(f => f.id);
const FROZEN_STEPS = ['discard', 'moveMower', 'steal'];
const MAX_OPEN_OFFERS = 3;
const SCHEMA_VERSION = 1;

const DEFAULT_CONFIG = {
  boardSize: null,
  playerCount: 0,
  maxPlayers: 8,
  victoryTarget: 10,
  discardThreshold: 8,
  turnTimerSec: 90,
  setupTimerSec: 60,
  draftTimerSec: 30,
  discardTimerSec: 45,
  mowerTimerSec: 30,
  specialBuildSec: 20,
  tradeOfferLifetimeSec: 45,
  disconnectGraceSec: 8,
  specialBuildPhase: false,
  sinkholeRedNumbersMayTouch: true,
  mowerTravelsWithHex: true
};

/* ---------- small helpers ---------- */

const emptyHand = () => ({ compost: 0, fertilizer: 0, sprinklers: 0, turf: 0, gnomeDust: 0 });
const handTotal = h => RESOURCES.reduce((s, r) => s + (h[r] || 0), 0);
const isResource = r => RESOURCES.includes(r);
const hasAll = (h, c) => RESOURCES.every(r => (h[r] || 0) >= (c[r] || 0));
const describe = b => RESOURCES.filter(r => b[r] > 0).map(r => `${b[r]} ${RESOURCE_NAMES[r]}`).join(', ');

function cleanBundle(b) {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return null;
  const out = emptyHand();
  for (const [k, v] of Object.entries(b)) {
    if (!isResource(k)) return null;
    if (!Number.isInteger(v) || v < 0 || v > 99) return null;
    out[k] = v;
  }
  return out;
}

function mkCtx(state, now) {
  return { state, now, events: [], topo: state.board ? getTopology(state.board.layoutId) : null };
}

function emit(ctx, type, data = {}) {
  ctx.events.push({ type, ...data });
}

function log(ctx, type, text, seat = null) {
  const s = ctx.state;
  s.log.push({ turn: s.phase.turn, at: ctx.now, type, seat, text });
  if (s.log.length > 60) s.log.splice(0, s.log.length - 60);
}

const randFn = state => () => next(state.secrets.rng);
const P = (s, seat) => s.players[seat];
const nameOf = (s, seat) => s.players[seat].name;
const factionOf = (s, seat) => s.players[seat].faction;
const seatWithFaction = (s, f) => { const p = s.players.find(x => x.faction === f); return p ? p.seat : null; };

function payBank(s, seat, cost) {
  const h = P(s, seat).hand;
  RESOURCES.forEach(r => { const n = cost[r] || 0; h[r] -= n; s.bank.resources[r] += n; });
}

function takeBank(s, seat, r, n) {
  const k = Math.min(n, s.bank.resources[r]);
  s.bank.resources[r] -= k;
  P(s, seat).hand[r] += k;
  return k;
}

function moveCard(s, from, to, r, n) {
  P(s, from).hand[r] -= n;
  P(s, to).hand[r] += n;
}

function setStep(ctx, step, sec) {
  const ph = ctx.state.phase;
  ph.step = step;
  ph.deadline = sec ? ctx.now + sec * 1000 : null;
}

/* ---------- geometry rules ---------- */

function shackSpotFree(s, topo, v) {
  const vert = topo.vertexById[v];
  if (!vert || s.board.buildings[v]) return false;
  return vert.neighbors.every(n => !s.board.buildings[n]); // distance rule
}

function shackLegal(s, topo, seat, v, needPath) {
  if (!shackSpotFree(s, topo, v)) return false;
  if (!needPath) return true;
  return topo.vertexById[v].edges.some(e => s.board.paths[e] === seat);
}

function pathLegal(s, topo, seat, e) {
  const edge = topo.edgeById[e];
  if (!edge || s.board.paths[e] !== undefined) return false;
  return edge.v.some(v => {
    const b = s.board.buildings[v];
    if (b && b.owner === seat) return true;
    if (b) return false; // an opponent's building blocks the junction
    return topo.vertexById[v].edges.some(e2 => e2 !== e && s.board.paths[e2] === seat);
  });
}

function manorLegal(s, seat, v) {
  const b = s.board.buildings[v];
  return !!b && b.owner === seat && b.type === 'shack';
}

function bestRatio(s, topo, seat, r) {
  let best = 4;
  if (factionOf(s, seat) === 'frigg') best = 3;
  for (const port of s.board.ports) {
    const owns = topo.edgeById[port.edge].v.some(v => s.board.buildings[v] && s.board.buildings[v].owner === seat);
    if (!owns) continue;
    if (port.resource === null) best = Math.min(best, 3);
    else if (port.resource === r) best = Math.min(best, 2);
  }
  return best;
}

/* ---------- awards and victory points ---------- */

function longestPathFor(s, topo, seat) {
  const own = Object.keys(s.board.paths).filter(e => s.board.paths[e] === seat);
  if (!own.length) return 0;
  const blocked = v => { const b = s.board.buildings[v]; return !!b && b.owner !== seat; };
  const used = new Set();

  function dfs(v) {
    let best = 0;
    for (const e of topo.vertexById[v].edges) {
      if (s.board.paths[e] !== seat || used.has(e)) continue;
      const edge = topo.edgeById[e];
      const u = edge.v[0] === v ? edge.v[1] : edge.v[0];
      used.add(e);
      const len = 1 + (blocked(u) ? 0 : dfs(u));
      used.delete(e);
      if (len > best) best = len;
    }
    return best;
  }

  const starts = new Set();
  own.forEach(e => topo.edgeById[e].v.forEach(v => starts.add(v)));
  let best = 0;
  starts.forEach(v => { best = Math.max(best, dfs(v)); });
  return best;
}

function updateLongestPath(ctx) {
  const s = ctx.state;
  const award = s.awards.longestPath;
  const lengths = s.players.map(p => longestPathFor(s, ctx.topo, p.seat));
  const max = Math.max(...lengths);
  const before = award.holder;

  if (award.holder !== null && lengths[award.holder] === max && max >= 5) {
    award.length = max;
  } else {
    const leaders = lengths.map((l, i) => (l === max ? i : -1)).filter(i => i >= 0);
    if (max >= 5 && leaders.length === 1) {
      award.holder = leaders[0];
      award.length = max;
    } else {
      award.holder = null;
      award.length = max >= 5 ? max : 0;
    }
  }

  if (award.holder !== before) {
    emit(ctx, 'award', { award: 'longestPath', holder: award.holder, from: before });
    log(ctx, 'award', award.holder === null
      ? 'Longest Mulch Path is up for grabs.'
      : `${nameOf(s, award.holder)} takes Longest Mulch Path (${award.length}).`, award.holder);
  }
}

function updateLargestMilitia(ctx, seat) {
  const s = ctx.state;
  const award = s.awards.largestMilitia;
  const size = P(s, seat).militia;
  if (size < 3) return;
  if (award.holder === seat) { award.size = size; return; }
  if (award.holder === null || size > P(s, award.holder).militia) {
    const from = award.holder;
    award.holder = seat;
    award.size = size;
    emit(ctx, 'award', { award: 'largestMilitia', holder: seat, from });
    log(ctx, 'award', `${nameOf(s, seat)} commands the Largest Gnome Militia.`, seat);
  }
}

function recalcVP(s) {
  const index = s.secrets.perkIndex || {};
  s.players.forEach(p => {
    const shacks = PIECES.shacks - p.piecesLeft.shacks;
    const manors = PIECES.manors - p.piecesLeft.manors;
    let pub = shacks + manors * 2;
    if (s.awards.longestPath.holder === p.seat) pub += s.awards.longestPath.vp;
    if (s.awards.largestMilitia.holder === p.seat) pub += s.awards.largestMilitia.vp;
    const hidden = [...p.perks.held, ...p.perks.boughtThisTurn].filter(id => index[id] && index[id].type === 'vp').length;
    p.vp = { public: pub, hidden };
  });
}

function checkWin(ctx) {
  const s = ctx.state;
  if (s.phase.stage !== 'playing') return;
  const seat = s.phase.activeSeat;
  const p = P(s, seat);
  if (p.vp.public + p.vp.hidden < s.config.victoryTarget) return;
  s.winner = { seat, at: ctx.now, vp: p.vp.public + p.vp.hidden };
  s.phase.stage = 'gameOver';
  s.phase.step = null;
  s.phase.deadline = null;
  s.room.status = 'finished';
  s.trades.forEach(t => { if (t.status === 'open') t.status = 'cancelled'; });
  emit(ctx, 'win', { seat });
  log(ctx, 'win', `${p.name} wins the Golden Flamingo with ${s.winner.vp} VP!`, seat);
}

/* ---------- turn flow ---------- */

function resolveOdin(s) {
  const choices = s.secrets.odinChoice;
  Object.keys(choices).forEach(seatKey => {
    const [keep, back] = choices[seatKey];
    const p = P(s, Number(seatKey));
    p.perks.boughtThisTurn.push(keep);
    if (back) s.secrets.perkDeckOrder.unshift(back);
    delete choices[seatKey];
  });
  s.bank.perksRemaining = s.secrets.perkDeckOrder.length;
}

function startTurn(ctx, seat) {
  const s = ctx.state;
  const ph = s.phase;
  resolveOdin(s);
  ph.activeSeat = seat;
  ph.turn += 1;
  ph.pendingBonus = null;
  ph.pendingSkim = null;
  ph.pendingSteal = null;
  ph.pendingDiscards = {};
  ph.discardPool = null;
  ph.returnStep = null;
  ph.specialBuildPending = [];
  s.dice.rolledThisTurn = false;
  s.players.forEach(p => {
    p.perks.held.push(...p.perks.boughtThisTurn);
    p.perks.boughtThisTurn = [];
    p.playedPerkThisTurn = false;
    p.thorUsed = false;
    p.freePaths = 0;
  });
  s.trades = s.trades.filter(t => t.status === 'open');
  setStep(ctx, 'roll', s.config.turnTimerSec);
  emit(ctx, 'turnStart', { seat });
  log(ctx, 'turn', `${nameOf(s, seat)}'s turn.`, seat);
  recalcVP(s);
  checkWin(ctx);
}

function nextTurn(ctx) {
  const s = ctx.state;
  startTurn(ctx, (s.phase.activeSeat + 1) % s.players.length);
}

function beginSetup(ctx) {
  const s = ctx.state;
  const n = s.players.length;
  const order = [...Array(n).keys()];
  s.phase.stage = 'setup';
  s.phase.setupQueue = [...order, ...order.slice().reverse()];
  s.phase.activeSeat = s.phase.setupQueue[0];
  s.phase.setupLastShack = null;
  setStep(ctx, 'placeShack', s.config.setupTimerSec);
  emit(ctx, 'setupTurn', { seat: s.phase.activeSeat });
}

function beginPlaying(ctx) {
  const s = ctx.state;
  s.phase.stage = 'playing';
  s.phase.turn = 0;
  s.phase.setupQueue = [];
  s.phase.setupLastShack = null;
  emit(ctx, 'gamePlaying');
  startTurn(ctx, 0);
}

function produce(ctx, total) {
  const s = ctx.state;
  const owed = {};
  RESOURCES.forEach(r => { owed[r] = {}; });

  s.board.hexes.forEach(hex => {
    if (hex.token !== total || !isResource(hex.terrain)) return;
    ctx.topo.hexById[hex.id].vertices.forEach(v => {
      const b = s.board.buildings[v];
      if (!b) return;
      if (s.board.mowerHex === hex.id && factionOf(s, b.owner) !== 'heimdall') return;
      owed[hex.terrain][b.owner] = (owed[hex.terrain][b.owner] || 0) + (b.type === 'manor' ? 2 : 1);
    });
  });

  const gains = {};
  RESOURCES.forEach(r => {
    const seats = Object.keys(owed[r]).map(Number);
    if (!seats.length) return;
    const need = seats.reduce((sum, seat) => sum + owed[r][seat], 0);
    // Bank shortage: everyone is paid, or (if several players are owed) nobody is.
    if (s.bank.resources[r] < need && seats.length > 1) {
      log(ctx, 'shortage', `The bank has run dry of ${RESOURCE_NAMES[r]}. Nobody collects it.`);
      return;
    }
    seats.forEach(seat => {
      const got = takeBank(s, seat, r, owed[r][seat]);
      if (got > 0) {
        gains[seat] = gains[seat] || emptyHand();
        gains[seat][r] += got;
      }
    });
  });

  const resources = RESOURCES.filter(r => Object.values(gains).some(g => g[r] > 0));
  emit(ctx, 'production', { total, gains, resources });
  Object.keys(gains).forEach(seat => log(ctx, 'production', `${nameOf(s, Number(seat))} collects ${describe(gains[seat])}.`, Number(seat)));

  const active = s.phase.activeSeat;
  if (factionOf(s, active) === 'freya' && !gains[active]) {
    s.phase.pendingBonus = { seat: active, count: 1, source: 'freya' };
    emit(ctx, 'bonusAvailable', { seat: active, privateTo: [active] });
  }
}

function toMower(ctx, returnStep) {
  ctx.state.phase.returnStep = returnStep;
  setStep(ctx, 'moveMower', ctx.state.config.mowerTimerSec);
}

function seven(ctx) {
  const s = ctx.state;
  const ph = s.phase;
  emit(ctx, 'mower');
  log(ctx, 'seven', "A 7! Surtur's Lawn Mower roars to life.");

  const njord = seatWithFaction(s, 'njord');
  if (njord !== null && takeBank(s, njord, 'sprinklers', 1)) {
    emit(ctx, 'factionPower', { seat: njord, faction: 'njord' });
    log(ctx, 'faction', `Burst Main! ${nameOf(s, njord)} collects a Hellfire Sprinkler.`, njord);
  }

  const owed = {};
  s.players.forEach(p => {
    if (p.faction === 'hel') return;
    const n = handTotal(p.hand);
    if (n >= s.config.discardThreshold) owed[p.seat] = Math.floor(n / 2);
  });

  if (Object.keys(owed).length) {
    ph.pendingDiscards = owed;
    ph.discardPool = emptyHand();
    setStep(ctx, 'discard', s.config.discardTimerSec);
    emit(ctx, 'discardRequired', { seats: Object.keys(owed).map(Number) });
  } else {
    toMower(ctx, 'main');
  }
}

function finishDiscards(ctx) {
  const s = ctx.state;
  const ph = s.phase;
  const hel = seatWithFaction(s, 'hel');
  if (hel !== null && ph.discardPool && handTotal(ph.discardPool) > 0) {
    ph.pendingSkim = { seat: hel, pool: ph.discardPool };
    emit(ctx, 'bonusAvailable', { seat: hel, privateTo: [hel] });
  }
  ph.discardPool = null;
  toMower(ctx, 'main');
}

function stealVictims(s, topo, hexId, thief) {
  const seats = new Set();
  topo.hexById[hexId].vertices.forEach(v => {
    const b = s.board.buildings[v];
    if (b && b.owner !== thief && handTotal(P(s, b.owner).hand) > 0) seats.add(b.owner);
  });
  return [...seats].sort((a, b) => a - b);
}

function finishMower(ctx) {
  const ph = ctx.state.phase;
  const ret = ph.returnStep || 'main';
  ph.returnStep = null;
  ph.pendingSteal = null;
  setStep(ctx, ret, ctx.state.config.turnTimerSec);
}

function doSteal(ctx, thief, victim, picks) {
  const s = ctx.state;
  const isLoki = factionOf(s, thief) === 'loki';
  const vh = P(s, victim).hand;
  const n = Math.min(isLoki ? 2 : 1, handTotal(vh));
  let take = [];

  if (isLoki && Array.isArray(picks) && picks.length) {
    if (picks.length !== n) return `Pick exactly ${n} card${n > 1 ? 's' : ''}`;
    const tmp = { ...vh };
    for (const r of picks) {
      if (!isResource(r) || tmp[r] <= 0) return "They don't have that card";
      tmp[r] -= 1;
    }
    take = picks;
  } else {
    const pool = [];
    RESOURCES.forEach(r => { for (let i = 0; i < vh[r]; i++) pool.push(r); });
    shuffle(randFn(s), pool);
    take = pool.slice(0, n);
  }

  take.forEach(r => moveCard(s, victim, thief, r, 1));
  emit(ctx, 'steal', { from: victim, to: thief, count: take.length, hidden: isLoki });
  emit(ctx, 'stolenDetail', { from: victim, to: thief, resources: take, privateTo: [victim, thief] });
  log(ctx, 'steal', `${nameOf(s, thief)} pinches ${take.length === 1 ? 'a card' : take.length + ' cards'} from ${nameOf(s, victim)}.`, thief);
  finishMower(ctx);
  return null;
}

/* ---------- building ---------- */

function canBuildNow(s, seat) {
  const ph = s.phase;
  if (ph.stage !== 'playing') return false;
  if (seat === ph.activeSeat && ph.step === 'main') return true;
  return ph.step === 'specialBuild' && ph.specialBuildPending.includes(seat);
}

function pathCost(s, seat) {
  const p = P(s, seat);
  const ph = s.phase;
  if (p.freePaths > 0 && seat === ph.activeSeat && ph.step === 'main') return { cost: null, how: 'free' };
  if (p.faction === 'thor' && !p.thorUsed && p.hand.turf >= 1) return { cost: { turf: 1 }, how: 'thor' };
  return { cost: COSTS.path, how: 'normal' };
}

function setupBuild(ctx, seat, what, at) {
  const s = ctx.state;
  const ph = s.phase;
  const p = P(s, seat);
  if (seat !== ph.activeSeat) return 'Not your turn';

  if (ph.step === 'placeShack') {
    if (what !== 'shack') return 'Place a Gardener Shack first';
    if (!shackLegal(s, ctx.topo, seat, at, false)) return "You can't build a Shack there";
    s.board.buildings[at] = { owner: seat, type: 'shack' };
    p.piecesLeft.shacks -= 1;
    ph.setupLastShack = at;
    emit(ctx, 'buildShack', { seat, at });

    if (PIECES.shacks - p.piecesLeft.shacks === 2) {
      const gained = emptyHand();
      ctx.topo.vertexById[at].hexes.forEach(hid => {
        const hex = s.board.hexes[ctx.topo.hexIndex[hid]];
        if (isResource(hex.terrain)) gained[hex.terrain] += takeBank(s, seat, hex.terrain, 1);
      });
      if (handTotal(gained)) log(ctx, 'production', `${p.name} starts with ${describe(gained)}.`, seat);
    }
    updateLongestPath(ctx);
    setStep(ctx, 'placePath', s.config.setupTimerSec);
    return null;
  }

  if (ph.step === 'placePath') {
    if (what !== 'path') return 'Place a Mulch Path next to your new Shack';
    const edge = ctx.topo.edgeById[at];
    if (!edge || s.board.paths[at] !== undefined || !edge.v.includes(ph.setupLastShack)) {
      return 'The path must touch the Shack you just placed';
    }
    s.board.paths[at] = seat;
    p.piecesLeft.paths -= 1;
    emit(ctx, 'buildPath', { seat, at });
    updateLongestPath(ctx);
    ph.setupQueue.shift();
    ph.setupLastShack = null;
    if (!ph.setupQueue.length) {
      beginPlaying(ctx);
    } else {
      ph.activeSeat = ph.setupQueue[0];
      setStep(ctx, 'placeShack', s.config.setupTimerSec);
      emit(ctx, 'setupTurn', { seat: ph.activeSeat });
    }
    return null;
  }
  return 'Nothing to place right now';
}

function playBuild(ctx, seat, what, at) {
  const s = ctx.state;
  const p = P(s, seat);
  if (!canBuildNow(s, seat)) return "You can't build right now";

  if (what === 'path') {
    if (p.piecesLeft.paths <= 0) return 'You have no Mulch Paths left';
    if (!pathLegal(s, ctx.topo, seat, at)) return "You can't build a path there";
    const { cost, how } = pathCost(s, seat);
    if (cost && !hasAll(p.hand, cost)) return 'Not enough resources';
    if (cost) payBank(s, seat, cost);
    if (how === 'free') p.freePaths -= 1;
    if (how === 'thor') {
      p.thorUsed = true;
      emit(ctx, 'factionPower', { seat, faction: 'thor' });
    }
    s.board.paths[at] = seat;
    p.piecesLeft.paths -= 1;
    emit(ctx, 'buildPath', { seat, at });
    log(ctx, 'build', `${p.name} lays a Mulch Path.`, seat);
    updateLongestPath(ctx);
    return null;
  }

  if (what === 'shack') {
    if (p.piecesLeft.shacks <= 0) return 'You have no Shacks left';
    if (!shackLegal(s, ctx.topo, seat, at, true)) return "You can't build a Shack there";
    if (!hasAll(p.hand, COSTS.shack)) return 'Not enough resources';
    payBank(s, seat, COSTS.shack);
    s.board.buildings[at] = { owner: seat, type: 'shack' };
    p.piecesLeft.shacks -= 1;
    emit(ctx, 'buildShack', { seat, at });
    log(ctx, 'build', `${p.name} builds a Gardener Shack.`, seat);
    updateLongestPath(ctx);
    return null;
  }

  if (what === 'manor') {
    if (p.piecesLeft.manors <= 0) return 'You have no Manors left';
    if (!manorLegal(s, seat, at)) return 'Upgrade one of your own Shacks';
    if (!hasAll(p.hand, COSTS.manor)) return 'Not enough resources';
    payBank(s, seat, COSTS.manor);
    s.board.buildings[at] = { owner: seat, type: 'manor' };
    p.piecesLeft.manors -= 1;
    p.piecesLeft.shacks += 1;
    emit(ctx, 'buildManor', { seat, at });
    log(ctx, 'build', `${p.name} upgrades to a Garden Manor.`, seat);
    return null;
  }
  return 'Unknown building';
}

/* ---------- actions ---------- */

const ACTIONS = {
  start(ctx, seat) {
    const s = ctx.state;
    if (s.phase.stage !== 'lobby') return 'The game has already started';
    if (seat !== 0) return 'Only the host can start the game';
    if (s.players.length < 2) return 'You need at least 2 players';

    const n = s.players.length;
    const size = n <= 4 ? 'standard' : 'expanded';
    const rand = randFn(s);
    s.config.boardSize = size;
    s.config.playerCount = n;
    s.config.specialBuildPhase = n >= 5;

    s.board = { ...generateBoard(rand, size), buildings: {}, paths: {} };
    ctx.topo = getTopology(s.board.layoutId);

    const bankEach = LAYOUTS[size].bank;
    s.bank = { resources: {}, perksRemaining: 0 };
    RESOURCES.forEach(r => { s.bank.resources[r] = bankEach; });

    const deck = [];
    const index = {};
    let k = 1;
    CARDS.perkTypes.forEach(t => {
      for (let i = 0; i < t.count[size]; i++) {
        const id = 'pk' + String(k++).padStart(2, '0');
        index[id] = { type: t.type, name: t.type === 'vp' ? t.variants[i % t.variants.length].name : t.name };
        deck.push(id);
      }
    });
    shuffle(rand, deck);
    s.secrets.perkDeckOrder = deck;
    s.secrets.perkIndex = index;
    s.bank.perksRemaining = deck.length;

    s.room.status = 'inGame';
    s.phase.stage = 'factions';
    s.phase.draftQueue = [...Array(n).keys()].reverse();
    s.phase.activeSeat = s.phase.draftQueue[0];
    setStep(ctx, 'chooseFaction', s.config.draftTimerSec);
    emit(ctx, 'gameStarted', { boardSize: size, layoutId: s.board.layoutId });
    log(ctx, 'start', `The yard is open: ${n} gardeners on the ${size} board.`);
    return null;
  },

  chooseFaction(ctx, seat, a) {
    const s = ctx.state;
    const ph = s.phase;
    if (ph.stage !== 'factions') return 'Deity draft is not running';
    if (ph.draftQueue[0] !== seat) return "It isn't your pick yet";
    if (!FACTION_IDS.includes(a.faction)) return 'Unknown deity';
    if (s.players.some(p => p.faction === a.faction)) return 'That deity is taken';
    P(s, seat).faction = a.faction;
    ph.draftQueue.shift();
    emit(ctx, 'factionChosen', { seat, faction: a.faction });
    log(ctx, 'faction', `${nameOf(s, seat)} worships ${CARDS.factions.find(f => f.id === a.faction).name}.`, seat);
    if (!ph.draftQueue.length) {
      beginSetup(ctx);
    } else {
      ph.activeSeat = ph.draftQueue[0];
      setStep(ctx, 'chooseFaction', s.config.draftTimerSec);
    }
    return null;
  },

  build(ctx, seat, a) {
    const s = ctx.state;
    if (!['path', 'shack', 'manor'].includes(a.what)) return 'Unknown building';
    if (typeof a.at !== 'string') return 'Choose a spot';
    if (s.phase.stage === 'setup') return setupBuild(ctx, seat, a.what, a.at);
    return playBuild(ctx, seat, a.what, a.at);
  },

  roll(ctx, seat) {
    const s = ctx.state;
    const ph = s.phase;
    if (ph.stage !== 'playing' || ph.step !== 'roll') return "You can't roll now";
    if (seat !== ph.activeSeat) return 'Not your turn';
    const rand = randFn(s);
    const d = [1 + int(rand, 6), 1 + int(rand, 6)];
    const total = d[0] + d[1];
    s.dice.last = d;
    s.dice.total = total;
    s.dice.rolledThisTurn = true;
    s.dice.rollCounts[total] += 1;
    emit(ctx, 'dice', { seat, dice: d, total });
    log(ctx, 'roll', `${nameOf(s, seat)} rolled ${total}.`, seat);
    if (total === 7) {
      seven(ctx);
    } else {
      produce(ctx, total);
      setStep(ctx, 'main', s.config.turnTimerSec);
    }
    return null;
  },

  discard(ctx, seat, a) {
    const s = ctx.state;
    const ph = s.phase;
    if (ph.step !== 'discard') return 'No discards needed';
    const owe = ph.pendingDiscards[seat];
    if (!owe) return "You don't need to discard";
    const c = cleanBundle(a.cards);
    if (!c) return 'Invalid cards';
    if (handTotal(c) !== owe) return `Discard exactly ${owe} cards`;
    if (!hasAll(P(s, seat).hand, c)) return "You don't have those cards";
    payBank(s, seat, c);
    RESOURCES.forEach(r => { ph.discardPool[r] += c[r]; });
    delete ph.pendingDiscards[seat];
    emit(ctx, 'discarded', { seat, count: owe });
    log(ctx, 'discard', `${nameOf(s, seat)} throws ${owe} cards on the compost.`, seat);
    if (!Object.keys(ph.pendingDiscards).length) finishDiscards(ctx);
    return null;
  },

  moveMower(ctx, seat, a) {
    const s = ctx.state;
    const ph = s.phase;
    if (ph.step !== 'moveMower') return 'The Mower is parked';
    if (seat !== ph.activeSeat) return 'Not your turn';
    if (!ctx.topo.hexById[a.hex]) return 'Unknown hex';
    if (a.hex === s.board.mowerHex) return 'The Mower must move to a different hex';
    s.board.mowerHex = a.hex;
    emit(ctx, 'mowerMoved', { seat, hex: a.hex });
    const victims = stealVictims(s, ctx.topo, a.hex, seat);
    if (!victims.length) {
      finishMower(ctx);
    } else if (victims.length === 1 && factionOf(s, seat) !== 'loki') {
      doSteal(ctx, seat, victims[0], null);
    } else {
      ph.pendingSteal = { victims };
      setStep(ctx, 'steal', s.config.mowerTimerSec);
    }
    return null;
  },

  steal(ctx, seat, a) {
    const s = ctx.state;
    const ph = s.phase;
    if (ph.step !== 'steal' || !ph.pendingSteal) return 'Nothing to steal';
    if (seat !== ph.activeSeat) return 'Not your turn';
    if (!ph.pendingSteal.victims.includes(a.victim)) return "You can't steal from them";
    return doSteal(ctx, seat, a.victim, a.picks);
  },

  buyPerk(ctx, seat) {
    const s = ctx.state;
    const p = P(s, seat);
    if (!canBuildNow(s, seat)) return "You can't buy a Perk right now";
    if (s.secrets.odinChoice[seat]) return 'Choose which Odin card to keep first';
    const deck = s.secrets.perkDeckOrder;
    if (!deck.length) return 'The Perk deck is empty';
    if (!hasAll(p.hand, COSTS.perk)) return 'Not enough resources';
    payBank(s, seat, COSTS.perk);
    if (p.faction === 'odin' && deck.length >= 2) {
      s.secrets.odinChoice[seat] = [deck.pop(), deck.pop()];
      emit(ctx, 'factionPower', { seat, faction: 'odin' });
    } else {
      p.perks.boughtThisTurn.push(deck.pop());
    }
    s.bank.perksRemaining = deck.length;
    emit(ctx, 'perkBought', { seat });
    log(ctx, 'perk', `${p.name} buys an Apocalypse Perk.`, seat);
    return null;
  },

  keepPerk(ctx, seat, a) {
    const s = ctx.state;
    const choice = s.secrets.odinChoice[seat];
    if (!choice) return 'No Odin choice waiting';
    if (!choice.includes(a.id)) return 'Pick one of the two cards';
    const other = choice.find(id => id !== a.id);
    P(s, seat).perks.boughtThisTurn.push(a.id);
    s.secrets.perkDeckOrder.unshift(other);
    delete s.secrets.odinChoice[seat];
    s.bank.perksRemaining = s.secrets.perkDeckOrder.length;
    return null;
  },

  playPerk(ctx, seat, a) {
    const s = ctx.state;
    const ph = s.phase;
    const p = P(s, seat);
    if (ph.stage !== 'playing' || seat !== ph.activeSeat) return 'Not your turn';
    if (!['roll', 'main'].includes(ph.step)) return "You can't play a Perk right now";
    if (p.playedPerkThisTurn) return 'Only one Perk per turn';
    if (p.perks.boughtThisTurn.includes(a.id)) return "You can't play a Perk the turn you bought it";
    if (!p.perks.held.includes(a.id)) return "You don't hold that Perk";
    const card = s.secrets.perkIndex[a.id];
    if (card.type === 'vp') return 'Victory Point cards are never played';

    const markPlayed = () => {
      p.perks.held = p.perks.held.filter(id => id !== a.id);
      p.perks.played.push(a.id);
      p.playedPerkThisTurn = true;
      emit(ctx, 'perkPlayed', { seat, id: a.id, perk: card.type });
    };

    switch (card.type) {
      case 'militia': {
        const returnTo = ph.step;
        markPlayed();
        p.militia += 1;
        updateLargestMilitia(ctx, seat);
        log(ctx, 'perk', `${p.name} sends in the Gnome Militia!`, seat);
        toMower(ctx, returnTo);
        return null;
      }
      case 'mulchSpreader': {
        const n = Math.min(2, p.piecesLeft.paths);
        if (!n) return 'You have no Mulch Paths left';
        markPlayed();
        p.freePaths = n;
        log(ctx, 'perk', `${p.name} fires up the Mulch Spreader.`, seat);
        return null;
      }
      case 'bumperCrop': {
        const picks = a.resources;
        if (!Array.isArray(picks) || picks.length !== 2 || !picks.every(isResource)) return 'Choose 2 resources';
        const want = emptyHand();
        picks.forEach(r => { want[r] += 1; });
        const short = RESOURCES.find(r => want[r] > s.bank.resources[r]);
        if (short) return `The bank is out of ${RESOURCE_NAMES[short]}`;
        markPlayed();
        picks.forEach(r => takeBank(s, seat, r, 1));
        log(ctx, 'perk', `${p.name} enjoys a Bumper Crop.`, seat);
        return null;
      }
      case 'binDay': {
        if (!isResource(a.resource)) return 'Name a resource';
        markPlayed();
        let got = 0;
        s.players.forEach(o => {
          if (o.seat === seat || !o.hand[a.resource]) return;
          got += o.hand[a.resource];
          moveCard(s, o.seat, seat, a.resource, o.hand[a.resource]);
        });
        emit(ctx, 'binDay', { seat, resource: a.resource, count: got });
        log(ctx, 'perk', `Bin Day! ${p.name} confiscates ${got} ${RESOURCE_NAMES[a.resource]}.`, seat);
        return null;
      }
      case 'sinkhole': {
        const ha = ctx.topo.hexById[a.a];
        const hb = ctx.topo.hexById[a.b];
        if (!ha || !hb || a.a === a.b) return 'Choose two hexes';
        if (!ha.neighbors.includes(a.b)) return 'The hexes must be next to each other';
        markPlayed();
        const A = s.board.hexes[ctx.topo.hexIndex[a.a]];
        const B = s.board.hexes[ctx.topo.hexIndex[a.b]];
        [A.terrain, B.terrain] = [B.terrain, A.terrain];
        [A.token, B.token] = [B.token, A.token];
        if (s.config.mowerTravelsWithHex) {
          if (s.board.mowerHex === a.a) s.board.mowerHex = a.b;
          else if (s.board.mowerHex === a.b) s.board.mowerHex = a.a;
        }
        emit(ctx, 'sinkhole', { seat, a: a.a, b: a.b });
        log(ctx, 'perk', `A Suburban Sinkhole swallows the neighbourhood. ${p.name} swaps two plots.`, seat);
        return null;
      }
      default:
        return 'Unknown Perk';
    }
  },

  bankTrade(ctx, seat, a) {
    const s = ctx.state;
    const ph = s.phase;
    if (ph.stage !== 'playing' || seat !== ph.activeSeat || ph.step !== 'main') return 'Bank trades are only on your turn';
    if (!isResource(a.give) || !isResource(a.get) || a.give === a.get) return 'Choose two different resources';
    const times = a.times === undefined ? 1 : a.times;
    if (!Number.isInteger(times) || times < 1 || times > 10) return 'Invalid amount';
    const ratio = bestRatio(s, ctx.topo, seat, a.give);
    const p = P(s, seat);
    if (p.hand[a.give] < ratio * times) return `You need ${ratio * times} ${RESOURCE_NAMES[a.give]}`;
    if (s.bank.resources[a.get] < times) return `The bank is out of ${RESOURCE_NAMES[a.get]}`;
    p.hand[a.give] -= ratio * times;
    s.bank.resources[a.give] += ratio * times;
    takeBank(s, seat, a.get, times);
    emit(ctx, 'bankTrade', { seat, give: a.give, get: a.get, ratio, times });
    log(ctx, 'trade', `${p.name} trades ${ratio * times} ${RESOURCE_NAMES[a.give]} with the bank for ${times} ${RESOURCE_NAMES[a.get]}.`, seat);
    return null;
  },

  offerTrade(ctx, seat, a) {
    const s = ctx.state;
    if (s.phase.stage !== 'playing') return 'Trading opens once the game starts';
    if (FROZEN_STEPS.includes(s.phase.step)) return 'Trading is frozen while the Mower is out';
    const give = cleanBundle(a.give);
    const want = cleanBundle(a.want);
    if (!give || !want || !handTotal(give) || !handTotal(want)) return 'Choose what to give and what you want';
    if (RESOURCES.some(r => give[r] > 0 && want[r] > 0)) return "Don't give and want the same resource";
    let to = null;
    if (a.to !== null && a.to !== undefined) {
      if (!Array.isArray(a.to) || !a.to.length) return 'Choose who to offer to';
      to = [...new Set(a.to)];
      if (to.some(x => !Number.isInteger(x) || !s.players[x] || x === seat)) return 'Invalid player';
    }
    if (!hasAll(P(s, seat).hand, give)) return "You don't have those cards";
    if (s.trades.filter(t => t.from === seat && t.status === 'open').length >= MAX_OPEN_OFFERS) {
      return `You can have ${MAX_OPEN_OFFERS} offers open at once`;
    }
    s.secrets.tradeSeq += 1;
    const t = {
      id: 't' + s.secrets.tradeSeq, from: seat, to, give, want, status: 'open',
      declinedBy: [], createdAt: ctx.now, expiresAt: ctx.now + s.config.tradeOfferLifetimeSec * 1000
    };
    s.trades.push(t);
    emit(ctx, 'tradeOffer', { id: t.id, from: seat, broadcast: to === null, privateTo: to || undefined });
    log(ctx, 'trade', to === null
      ? `${nameOf(s, seat)} offers ${describe(give)} for ${describe(want)} to anyone.`
      : `${nameOf(s, seat)} sends a private offer.`, seat);
    return null;
  },

  respondTrade(ctx, seat, a) {
    const s = ctx.state;
    const t = s.trades.find(x => x.id === a.id);
    if (!t || t.status !== 'open') return 'That offer has closed';
    if (t.from === seat) return "You can't answer your own offer";
    if (t.to !== null && !t.to.includes(seat)) return 'That offer is not for you';
    if (FROZEN_STEPS.includes(s.phase.step)) return 'Trading is frozen while the Mower is out';

    if (!a.accept) {
      if (!t.declinedBy.includes(seat)) t.declinedBy.push(seat);
      const audience = t.to || s.players.map(p => p.seat).filter(x => x !== t.from);
      if (audience.every(x => t.declinedBy.includes(x))) t.status = 'declined';
      emit(ctx, 'tradeDeclined', { id: t.id, by: seat, privateTo: [t.from] });
      return null;
    }

    if (!hasAll(P(s, seat).hand, t.want)) return "You don't have the cards they want";
    if (!hasAll(P(s, t.from).hand, t.give)) {
      t.status = 'void';
      emit(ctx, 'tradeVoid', { id: t.id, privateTo: [t.from, seat] });
      log(ctx, 'trade', `${nameOf(s, t.from)}'s offer fell through.`, t.from);
      return null;
    }
    RESOURCES.forEach(r => {
      if (t.give[r]) moveCard(s, t.from, seat, r, t.give[r]);
      if (t.want[r]) moveCard(s, seat, t.from, r, t.want[r]);
    });
    t.status = 'done';
    t.acceptedBy = seat;
    emit(ctx, 'tradeAccepted', { id: t.id, from: t.from, with: seat });
    log(ctx, 'trade', `${nameOf(s, t.from)} and ${nameOf(s, seat)} shake on a deal.`, seat);
    return null;
  },

  cancelTrade(ctx, seat, a) {
    const t = ctx.state.trades.find(x => x.id === a.id);
    if (!t || t.status !== 'open') return 'That offer has closed';
    if (t.from !== seat) return 'Not your offer';
    t.status = 'cancelled';
    emit(ctx, 'tradeCancelled', { id: t.id });
    return null;
  },

  claimBonus(ctx, seat, a) {
    const s = ctx.state;
    const b = s.phase.pendingBonus;
    if (!b || b.seat !== seat) return 'No bonus waiting';
    if (!isResource(a.resource)) return 'Choose a resource';
    if (s.bank.resources[a.resource] < 1) return `The bank is out of ${RESOURCE_NAMES[a.resource]}`;
    takeBank(s, seat, a.resource, 1);
    s.phase.pendingBonus = null;
    emit(ctx, 'factionPower', { seat, faction: 'freya' });
    log(ctx, 'faction', `Late Bloomer! ${nameOf(s, seat)} gathers ${RESOURCE_NAMES[a.resource]}.`, seat);
    return null;
  },

  skim(ctx, seat, a) {
    const s = ctx.state;
    const k = s.phase.pendingSkim;
    if (!k || k.seat !== seat) return 'Nothing to collect';
    if (!isResource(a.resource) || !k.pool[a.resource]) return 'Pick a card from the discards';
    if (s.bank.resources[a.resource] < 1) return `The bank is out of ${RESOURCE_NAMES[a.resource]}`;
    takeBank(s, seat, a.resource, 1);
    s.phase.pendingSkim = null;
    emit(ctx, 'factionPower', { seat, faction: 'hel' });
    log(ctx, 'faction', `Green Waste Collection! ${nameOf(s, seat)} salvages ${RESOURCE_NAMES[a.resource]}.`, seat);
    return null;
  },

  endTurn(ctx, seat) {
    const s = ctx.state;
    const ph = s.phase;
    if (ph.stage !== 'playing' || seat !== ph.activeSeat) return 'Not your turn';
    if (ph.step !== 'main') return 'Finish what you are doing first';
    resolveOdin(s);
    if (s.config.specialBuildPhase) {
      ph.specialBuildPending = s.players.map(p => p.seat).filter(x => x !== seat);
      setStep(ctx, 'specialBuild', s.config.specialBuildSec);
      emit(ctx, 'specialBuild', { seats: ph.specialBuildPending });
    } else {
      nextTurn(ctx);
    }
    return null;
  },

  doneSpecialBuild(ctx, seat) {
    const ph = ctx.state.phase;
    if (ph.step !== 'specialBuild' || !ph.specialBuildPending.includes(seat)) return 'Nothing to finish';
    ph.specialBuildPending = ph.specialBuildPending.filter(x => x !== seat);
    if (!ph.specialBuildPending.length) nextTurn(ctx);
    return null;
  }
};

/* ---------- public API ---------- */

function createGame({ roomCode = 'TEST', seed, config = {}, now = Date.now() } = {}) {
  const s = (seed === undefined ? crypto.randomBytes(4).readUInt32LE(0) : seed) >>> 0;
  const rollCounts = {};
  for (let n = 2; n <= 12; n++) rollCounts[n] = 0;
  return {
    schema: 'ragnagrok.gamestate',
    schemaVersion: SCHEMA_VERSION,
    stateVersion: 0,
    createdAt: now,
    updatedAt: now,
    room: { code: roomCode, status: 'lobby' },
    config: { ...DEFAULT_CONFIG, ...config },
    phase: {
      stage: 'lobby', step: null, turn: 0, activeSeat: null, deadline: null,
      draftQueue: [], setupQueue: [], setupLastShack: null,
      pendingDiscards: {}, discardPool: null, pendingSteal: null,
      pendingBonus: null, pendingSkim: null, returnStep: null, specialBuildPending: []
    },
    dice: { last: null, total: null, rolledThisTurn: false, rollCounts },
    board: null,
    players: [],
    bank: null,
    awards: {
      longestPath: { holder: null, length: 0, vp: 2 },
      largestMilitia: { holder: null, size: 0, vp: 2 }
    },
    trades: [],
    log: [],
    winner: null,
    secrets: { rng: { s }, playerTokens: {}, perkDeckOrder: [], perkIndex: {}, odinChoice: {}, tradeSeq: 0 }
  };
}

function addPlayer(state, { name, avatar } = {}, now = Date.now()) {
  if (state.phase.stage !== 'lobby') return { ok: false, error: 'The game has already started' };
  if (state.players.length >= state.config.maxPlayers) return { ok: false, error: 'The yard is full' };
  const seat = state.players.length;
  const clean = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 16) || `Gardener ${seat + 1}`;
  state.players.push({
    seat,
    name: clean,
    avatar: String(avatar || '🌱').slice(0, 8),
    colour: COLOURS[seat],
    faction: null,
    connected: true,
    hand: emptyHand(),
    perks: { held: [], boughtThisTurn: [], played: [] },
    playedPerkThisTurn: false,
    militia: 0,
    piecesLeft: { ...PIECES },
    vp: { public: 0, hidden: 0 },
    freePaths: 0,
    thorUsed: false
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
  state.players.forEach((p, i) => {
    p.seat = i;
    p.colour = COLOURS[i];
    state.secrets.playerTokens[i] = tokens[i];
  });
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
  state.stateVersion += 1;
  state.updatedAt = now;
}

function finalize(ctx) {
  const s = ctx.state;
  if (s.board) recalcVP(s);
  checkWin(ctx);
  s.stateVersion += 1;
  s.updatedAt = ctx.now;
}

function apply(state, seat, action, now = Date.now()) {
  if (!action || typeof action.type !== 'string' || !ACTIONS[action.type]) {
    return { ok: false, error: 'Unknown action', events: [] };
  }
  if (state.phase.stage === 'gameOver') return { ok: false, error: 'The game is over', events: [] };
  if (!Number.isInteger(seat) || !state.players[seat]) return { ok: false, error: 'Unknown player', events: [] };
  const ctx = mkCtx(state, now);
  const err = ACTIONS[action.type](ctx, seat, action);
  if (err) return { ok: false, error: err, events: [] };
  finalize(ctx);
  return { ok: true, events: ctx.events };
}

/* ---------- timeouts ---------- */

function randomPick(state, arr) {
  return arr[int(randFn(state), arr.length)];
}

function autoAct(ctx) {
  const s = ctx.state;
  const ph = s.phase;
  const seat = ph.activeSeat;

  if (ph.stage === 'factions') {
    const free = FACTION_IDS.filter(f => !s.players.some(p => p.faction === f));
    return ACTIONS.chooseFaction(ctx, ph.draftQueue[0], { faction: randomPick(s, free) });
  }

  if (ph.stage === 'setup') {
    if (ph.step === 'placeShack') {
      const spots = ctx.topo.vertices.map(v => v.id).filter(v => shackLegal(s, ctx.topo, seat, v, false));
      return setupBuild(ctx, seat, 'shack', randomPick(s, spots));
    }
    const edges = ctx.topo.vertexById[ph.setupLastShack].edges.filter(e => s.board.paths[e] === undefined);
    return setupBuild(ctx, seat, 'path', randomPick(s, edges));
  }

  if (ph.stage !== 'playing') return null;

  switch (ph.step) {
    case 'roll':
      return ACTIONS.roll(ctx, seat);
    case 'discard':
      Object.entries(ph.pendingDiscards).forEach(([k, owe]) => {
        const victim = Number(k);
        const pool = [];
        RESOURCES.forEach(r => { for (let i = 0; i < P(s, victim).hand[r]; i++) pool.push(r); });
        shuffle(randFn(s), pool);
        const cards = emptyHand();
        pool.slice(0, owe).forEach(r => { cards[r] += 1; });
        ACTIONS.discard(ctx, victim, { cards });
      });
      return null;
    case 'moveMower': {
      const options = ctx.topo.hexes.map(h => h.id).filter(id => id !== s.board.mowerHex);
      const juicy = options.filter(id => stealVictims(s, ctx.topo, id, seat).length > 0);
      return ACTIONS.moveMower(ctx, seat, { hex: randomPick(s, juicy.length ? juicy : options) });
    }
    case 'steal':
      return doSteal(ctx, seat, randomPick(s, ph.pendingSteal.victims), null);
    case 'main':
      return ACTIONS.endTurn(ctx, seat);
    case 'specialBuild':
      ph.specialBuildPending = [];
      nextTurn(ctx);
      return null;
    default:
      return null;
  }
}

function tick(state, now = Date.now()) {
  const ctx = mkCtx(state, now);
  let changed = false;
  const ph = state.phase;

  state.trades.forEach(t => {
    if (t.status === 'open' && now >= t.expiresAt) {
      t.status = 'expired';
      emit(ctx, 'tradeExpired', { id: t.id, privateTo: [t.from] });
      changed = true;
    }
  });

  // Don't make the table wait the full timer for someone whose phone has dropped.
  if (ph.deadline && ph.activeSeat !== null && state.players[ph.activeSeat] &&
      !state.players[ph.activeSeat].connected && ph.stage !== 'lobby') {
    const grace = now + state.config.disconnectGraceSec * 1000;
    if (ph.deadline > grace) { ph.deadline = grace; changed = true; }
  }

  if (ph.deadline && now >= ph.deadline && ph.stage !== 'gameOver') {
    const before = ph.deadline;
    autoAct(ctx);
    if (ph.deadline === before) ph.deadline = now + 5000; // safety: never spin on a stuck step
    changed = true;
  }

  if (changed) finalize(ctx);
  return { changed, events: ctx.events };
}

/* ---------- views ---------- */

function legalMoves(state, seat) {
  const s = state;
  const out = {
    shack: [], path: [], manor: [], mower: [],
    afford: { path: false, shack: false, manor: false, perk: false },
    bankRatios: {}, canRoll: false, canEndTurn: false, discardOwed: 0
  };
  if (!s.board) return out;
  const topo = getTopology(s.board.layoutId);
  const ph = s.phase;
  const p = s.players[seat];

  if (ph.stage === 'setup' && seat === ph.activeSeat) {
    if (ph.step === 'placeShack') {
      out.shack = topo.vertices.map(v => v.id).filter(v => shackLegal(s, topo, seat, v, false));
      out.afford.shack = true;
    } else if (ph.step === 'placePath') {
      out.path = topo.vertexById[ph.setupLastShack].edges.filter(e => s.board.paths[e] === undefined);
      out.afford.path = true;
    }
    return out;
  }
  if (ph.stage !== 'playing') return out;

  RESOURCES.forEach(r => { out.bankRatios[r] = bestRatio(s, topo, seat, r); });
  out.canRoll = seat === ph.activeSeat && ph.step === 'roll';
  out.canEndTurn = seat === ph.activeSeat && ph.step === 'main';
  out.discardOwed = ph.step === 'discard' ? (ph.pendingDiscards[seat] || 0) : 0;
  if (seat === ph.activeSeat && ph.step === 'moveMower') {
    out.mower = topo.hexes.map(h => h.id).filter(id => id !== s.board.mowerHex);
  }

  if (canBuildNow(s, seat)) {
    const { cost } = pathCost(s, seat);
    out.afford.path = p.piecesLeft.paths > 0 && (!cost || hasAll(p.hand, cost));
    out.afford.shack = p.piecesLeft.shacks > 0 && hasAll(p.hand, COSTS.shack);
    out.afford.manor = p.piecesLeft.manors > 0 && hasAll(p.hand, COSTS.manor);
    out.afford.perk = s.secrets.perkDeckOrder.length > 0 && hasAll(p.hand, COSTS.perk) && !s.secrets.odinChoice[seat];
    if (p.piecesLeft.paths > 0) out.path = topo.edges.map(e => e.id).filter(e => pathLegal(s, topo, seat, e));
    if (p.piecesLeft.shacks > 0) out.shack = topo.vertices.map(v => v.id).filter(v => shackLegal(s, topo, seat, v, true));
    if (p.piecesLeft.manors > 0) out.manor = Object.keys(s.board.buildings).filter(v => manorLegal(s, seat, v));
  }
  return out;
}

function publicView(state) {
  const s = JSON.parse(JSON.stringify(state));
  delete s.secrets;
  const index = state.secrets.perkIndex || {};
  const over = state.phase.stage === 'gameOver';
  s.players = state.players.map(p => ({
    seat: p.seat,
    name: p.name,
    avatar: p.avatar,
    colour: p.colour,
    faction: p.faction,
    connected: p.connected,
    handCount: handTotal(p.hand),
    perks: {
      heldCount: p.perks.held.length + p.perks.boughtThisTurn.length,
      played: p.perks.played.map(id => ({ id, ...index[id] })),
      revealed: over
        ? [...p.perks.held, ...p.perks.boughtThisTurn].filter(id => index[id].type === 'vp').map(id => ({ id, ...index[id] }))
        : undefined
    },
    militia: p.militia,
    piecesLeft: { ...p.piecesLeft },
    vp: over ? { public: p.vp.public, total: p.vp.public + p.vp.hidden } : { public: p.vp.public }
  }));
  s.trades = state.trades
    .filter(t => t.status === 'open')
    .map(t => (t.to === null
      ? JSON.parse(JSON.stringify(t))
      : { id: t.id, from: t.from, to: t.to, status: t.status, private: true, expiresAt: t.expiresAt }));
  return s;
}

function privateView(state, seat) {
  const view = publicView(state);
  const p = state.players[seat];
  if (!p) return view;
  const index = state.secrets.perkIndex || {};
  const card = id => ({ id, ...index[id] });
  const ph = state.phase;

  let stealPeek = null;
  if (ph.step === 'steal' && ph.pendingSteal && seat === ph.activeSeat && p.faction === 'loki') {
    stealPeek = {};
    ph.pendingSteal.victims.forEach(v => { stealPeek[v] = { ...state.players[v].hand }; });
  }

  view.me = {
    seat,
    hand: { ...p.hand },
    perks: { held: p.perks.held.map(card), boughtThisTurn: p.perks.boughtThisTurn.map(card) },
    vp: { ...p.vp },
    freePaths: p.freePaths,
    thorUsed: p.thorUsed,
    playedPerkThisTurn: p.playedPerkThisTurn,
    odinChoice: state.secrets.odinChoice[seat] ? state.secrets.odinChoice[seat].map(card) : null,
    stealPeek,
    trades: state.trades
      .filter(t => t.status === 'open' && (t.from === seat || t.to === null || t.to.includes(seat)))
      .map(t => JSON.parse(JSON.stringify(t))),
    legal: legalMoves(state, seat)
  };
  return view;
}

module.exports = {
  createGame,
  addPlayer,
  removePlayer,
  seatForToken,
  setConnected,
  apply,
  tick,
  publicView,
  privateView,
  clientTopology,
  RESOURCES,
  COSTS,
  PIECES,
  SCHEMA_VERSION
};
