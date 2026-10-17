'use strict';
/* Robot simulation test.
   Plays complete games with random-but-legal robot players and checks the
   rules engine after EVERY action:
     - no resource cards are created or destroyed
     - no hand or bank ever goes negative
     - board pieces always match each player's remaining pieces
     - no Perk cards are lost
     - the state survives a save/load (JSON round trip)
     - every game reaches a winner
   Run:  npm test            (default 120 games)
         node test/sim.js 1000 */

const assert = require('assert');
const E = require('../src/engine/rules');
const { next } = require('../src/engine/rng');

const RES = E.RESOURCES;
const GAMES = Number(process.argv[2]) || 120;
const PLAYER_COUNTS = [2, 3, 4, 5, 6, 8];

function makeBot(seed) {
  const st = { s: seed >>> 0 };
  const rand = () => next(st);
  const pick = arr => arr[Math.floor(rand() * arr.length)];
  return { rand, pick };
}

function must(res, what) {
  if (!res.ok) throw new Error(`${what} failed: ${res.error}`);
  return res;
}

function checkInvariants(st, bankStart, deckTotal) {
  RES.forEach(r => {
    const inHands = st.players.reduce((s, p) => s + p.hand[r], 0);
    assert.strictEqual(st.bank.resources[r] + inHands, bankStart, `${r} not conserved`);
    assert.ok(st.bank.resources[r] >= 0, `bank ${r} negative`);
    st.players.forEach(p => assert.ok(p.hand[r] >= 0, `${p.name} ${r} negative`));
  });

  st.players.forEach(p => {
    const shacks = Object.values(st.board.buildings).filter(b => b.owner === p.seat && b.type === 'shack').length;
    const manors = Object.values(st.board.buildings).filter(b => b.owner === p.seat && b.type === 'manor').length;
    const paths = Object.values(st.board.paths).filter(o => o === p.seat).length;
    assert.strictEqual(shacks, E.PIECES.shacks - p.piecesLeft.shacks, `${p.name} shack count`);
    assert.strictEqual(manors, E.PIECES.manors - p.piecesLeft.manors, `${p.name} manor count`);
    assert.strictEqual(paths, E.PIECES.paths - p.piecesLeft.paths, `${p.name} path count`);
  });

  const odin = Object.values(st.secrets.odinChoice).reduce((s, c) => s + c.length, 0);
  const perks = st.players.reduce((s, p) => s + p.perks.held.length + p.perks.boughtThisTurn.length + p.perks.played.length, 0);
  assert.strictEqual(st.secrets.perkDeckOrder.length + odin + perks, deckTotal, 'Perk cards lost');
}

function playablePerks(view) {
  if (view.players[view.me.seat] && view.me.perks) {
    return view.me.perks.held.filter(c => c.type !== 'vp');
  }
  return [];
}

function perkParams(st, card, bot) {
  const topo = E.clientTopology(st.board.layoutId);
  switch (card.type) {
    case 'bumperCrop': return { resources: [bot.pick(RES), bot.pick(RES)] };
    case 'binDay': return { resource: bot.pick(RES) };
    case 'sinkhole': {
      const h = bot.pick(topo.hexes);
      return { a: h.id, b: bot.pick(h.neighbors) };
    }
    default: return {};
  }
}

function randomCards(hand, n, bot) {
  const pool = [];
  RES.forEach(r => { for (let i = 0; i < hand[r]; i++) pool.push(r); });
  const cards = {};
  RES.forEach(r => { cards[r] = 0; });
  for (let i = 0; i < n; i++) {
    const k = Math.floor(bot.rand() * pool.length);
    cards[pool[k]] += 1;
    pool.splice(k, 1);
  }
  return cards;
}

function tradeChatter(st, now, bot) {
  if (st.phase.stage !== 'playing') return;
  const seat = Math.floor(bot.rand() * st.players.length);
  const view = E.privateView(st, seat);
  const openForMe = view.me.trades.filter(t => t.from !== seat);
  if (openForMe.length && bot.rand() < 0.6) {
    E.apply(st, seat, { type: 'respondTrade', id: bot.pick(openForMe).id, accept: bot.rand() < 0.5 }, now);
    return;
  }
  const have = RES.filter(r => view.me.hand[r] > 0);
  if (!have.length) return;
  const give = bot.pick(have);
  const want = bot.pick(RES.filter(r => r !== give));
  const others = st.players.map(p => p.seat).filter(x => x !== seat);
  E.apply(st, seat, {
    type: 'offerTrade',
    to: bot.rand() < 0.5 ? null : [bot.pick(others)],
    give: { [give]: 1 },
    want: { [want]: 1 }
  }, now);
}

function botAct(st, now, bot) {
  const ph = st.phase;

  if (ph.stage === 'factions') {
    const taken = st.players.map(p => p.faction).filter(Boolean);
    const free = ['thor', 'loki', 'freya', 'hel', 'odin', 'heimdall', 'frigg', 'njord'].filter(f => !taken.includes(f));
    must(E.apply(st, ph.draftQueue[0], { type: 'chooseFaction', faction: bot.pick(free) }, now), 'chooseFaction');
    return;
  }

  if (ph.stage === 'setup') {
    const seat = ph.activeSeat;
    const L = E.privateView(st, seat).me.legal;
    if (ph.step === 'placeShack') must(E.apply(st, seat, { type: 'build', what: 'shack', at: bot.pick(L.shack) }, now), 'setup shack');
    else must(E.apply(st, seat, { type: 'build', what: 'path', at: bot.pick(L.path) }, now), 'setup path');
    return;
  }

  if (bot.rand() < 0.35) tradeChatter(st, now, bot);
  if (st.phase.stage !== 'playing') return;

  // Faction bonuses can be claimed by anyone they belong to.
  if (ph.pendingBonus) {
    const r = RES.find(x => st.bank.resources[x] > 0);
    if (r) E.apply(st, ph.pendingBonus.seat, { type: 'claimBonus', resource: r }, now);
  }
  if (ph.pendingSkim) {
    const r = RES.find(x => ph.pendingSkim.pool[x] > 0 && st.bank.resources[x] > 0);
    if (r) E.apply(st, ph.pendingSkim.seat, { type: 'skim', resource: r }, now);
  }

  const seat = ph.activeSeat;
  const view = E.privateView(st, seat);
  const me = view.me;
  const L = me.legal;

  switch (ph.step) {
    case 'roll': {
      const perks = playablePerks(view);
      if (perks.length && !st.players[seat].playedPerkThisTurn && bot.rand() < 0.3) {
        const c = bot.pick(perks);
        const res = E.apply(st, seat, { type: 'playPerk', id: c.id, ...perkParams(st, c, bot) }, now);
        if (res.ok) return;
      }
      must(E.apply(st, seat, { type: 'roll' }, now), 'roll');
      return;
    }
    case 'discard':
      Object.entries(ph.pendingDiscards).forEach(([k, owe]) => {
        const s = Number(k);
        must(E.apply(st, s, { type: 'discard', cards: randomCards(st.players[s].hand, owe, bot) }, now), 'discard');
      });
      return;
    case 'moveMower':
      must(E.apply(st, seat, { type: 'moveMower', hex: bot.pick(L.mower) }, now), 'moveMower');
      return;
    case 'steal': {
      const victim = bot.pick(ph.pendingSteal.victims);
      let picks;
      if (me.stealPeek) {
        const hand = me.stealPeek[victim];
        const n = Math.min(2, RES.reduce((s, r) => s + hand[r], 0));
        const c = randomCards(hand, n, bot);
        picks = [];
        RES.forEach(r => { for (let i = 0; i < c[r]; i++) picks.push(r); });
      }
      must(E.apply(st, seat, { type: 'steal', victim, picks }, now), 'steal');
      return;
    }
    case 'main': {
      if (me.odinChoice) { must(E.apply(st, seat, { type: 'keepPerk', id: me.odinChoice[0].id }, now), 'keepPerk'); return; }
      if (L.afford.manor && L.manor.length) { must(E.apply(st, seat, { type: 'build', what: 'manor', at: bot.pick(L.manor) }, now), 'manor'); return; }
      if (L.afford.shack && L.shack.length) { must(E.apply(st, seat, { type: 'build', what: 'shack', at: bot.pick(L.shack) }, now), 'shack'); return; }
      if (L.afford.path && L.path.length && bot.rand() < 0.6) { must(E.apply(st, seat, { type: 'build', what: 'path', at: bot.pick(L.path) }, now), 'path'); return; }
      if (L.afford.perk && bot.rand() < 0.5) { must(E.apply(st, seat, { type: 'buyPerk' }, now), 'buyPerk'); return; }
      const perks = playablePerks(view);
      if (perks.length && !st.players[seat].playedPerkThisTurn && bot.rand() < 0.4) {
        const c = bot.pick(perks);
        const res = E.apply(st, seat, { type: 'playPerk', id: c.id, ...perkParams(st, c, bot) }, now);
        if (res.ok) return;
      }
      const tradable = RES.filter(r => me.hand[r] >= L.bankRatios[r]);
      if (tradable.length && bot.rand() < 0.5) {
        const give = bot.pick(tradable);
        const get = bot.pick(RES.filter(r => r !== give && st.bank.resources[r] > 0));
        if (get) { must(E.apply(st, seat, { type: 'bankTrade', give, get }, now), 'bankTrade'); return; }
      }
      must(E.apply(st, seat, { type: 'endTurn' }, now), 'endTurn');
      return;
    }
    case 'specialBuild': {
      const s = bot.pick(ph.specialBuildPending);
      const L2 = E.privateView(st, s).me.legal;
      if (L2.afford.shack && L2.shack.length && bot.rand() < 0.7) {
        must(E.apply(st, s, { type: 'build', what: 'shack', at: bot.pick(L2.shack) }, now), 'sb shack');
      } else {
        must(E.apply(st, s, { type: 'doneSpecialBuild' }, now), 'doneSpecialBuild');
      }
      return;
    }
    default:
      throw new Error('Unhandled step ' + ph.step);
  }
}

function playGame(n, seed) {
  const bot = makeBot(seed * 7919 + 13);
  let now = 1_700_000_000_000;
  let st = E.createGame({ seed, now });
  for (let i = 0; i < n; i++) must(E.addPlayer(st, { name: 'Bot ' + i, avatar: '🤖' }, now), 'join');
  must(E.apply(st, 0, { type: 'start' }, now), 'start');

  const bankStart = st.bank.resources.compost;
  const deckTotal = st.secrets.perkDeckOrder.length;
  let actions = 0;

  while (st.phase.stage !== 'gameOver') {
    actions++;
    if (actions > 40000) throw new Error(`Game ${seed} (${n}p) never finished`);
    now += 1000;

    if (bot.rand() < 0.01) {
      now += 200_000; // someone wanders off: force a timeout
      E.tick(st, now);
    } else {
      E.tick(st, now);
      if (st.phase.stage !== 'gameOver') botAct(st, now, bot);
    }

    if (st.board) checkInvariants(st, bankStart, deckTotal);
    if (actions % 250 === 0) st = JSON.parse(JSON.stringify(st)); // simulate save/load

    // The views must never leak another player's hand or secrets.
    if (actions % 50 === 0 && st.board) {
      const pub = E.publicView(st);
      assert.ok(!('secrets' in pub), 'public view leaked secrets');
      assert.ok(pub.players.every(p => !('hand' in p)), 'public view leaked hands');
    }
  }

  const w = st.players[st.winner.seat];
  assert.ok(w.vp.public + w.vp.hidden >= st.config.victoryTarget, 'winner below target');
  return { turns: st.phase.turn, faction: w.faction };
}

const started = Date.now();
const summary = {};
const factionWins = {};
let played = 0;

for (let g = 0; g < GAMES; g++) {
  const n = PLAYER_COUNTS[g % PLAYER_COUNTS.length];
  const r = playGame(n, g + 1);
  summary[n] = summary[n] || { games: 0, turns: 0 };
  summary[n].games += 1;
  summary[n].turns += r.turns;
  factionWins[r.faction] = (factionWins[r.faction] || 0) + 1;
  played++;
}

console.log(`✔ ${played} games played, all rules checks passed (${((Date.now() - started) / 1000).toFixed(1)}s)`);
Object.keys(summary).forEach(n => {
  console.log(`  ${n} players: ${summary[n].games} games, average ${(summary[n].turns / summary[n].games).toFixed(0)} turns`);
});
console.log('  Wins by deity (random robots, NOT a balance test):', factionWins);
