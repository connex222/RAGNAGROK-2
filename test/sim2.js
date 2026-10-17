'use strict';
/* V2 balance simulation and rules check.

   Plays seeded games of "The Last Garden Show" with five robot play styles and
   checks the rules after every step. Then reports balance against the targets
   in the rulebook.

   Run:  node test/sim2.js            (default 700 games)
         node test/sim2.js 2000
   Writes reports/balance-v2.md

   Limits: robots don't trade, bluff or hold grudges, so trading and the social
   side of emergencies are under-modelled. This catches broken numbers and
   runaway gods; it cannot prove the game is fun. */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const E = require('../src/engine/garden');
const { next, shuffle } = require('../src/engine/rng');

const C = E.CONTENT;
const SUP = E.SUPPLIES;
const GAMES = Number(process.argv[2]) || 700;
const LENGTH = process.argv[3] || 'long';
const COUNTS = [2, 3, 4, 5, 6, 7, 8];
const STRATS = ['gardener', 'baron', 'chaser', 'menace', 'random'];
const GODS = Object.keys(C.gods);

/* ---------- robots ---------- */

function rng(seed) { const st = { s: seed >>> 0 }; return () => next(st); }
const pick = (rand, arr) => arr[Math.floor(rand() * arr.length)];
const canPay = (hand, cost) => SUP.every(r => (hand[r] || 0) >= ((cost && cost[r]) || 0));
const payIn = (hand, cost) => SUP.forEach(r => { hand[r] -= (cost && cost[r]) || 0; });

function upcomingTags(v) {
  const show = v.shows.find(sh => sh.categories && !sh.results);
  if (!show) return [];
  return show.categories.map(k => C.categories[k]).filter(c => c.measure === 'tag').map(c => c.tag);
}
function upcomingMeasures(v) {
  const show = v.shows.find(sh => sh.categories && !sh.results);
  return show ? show.categories.map(k => C.categories[k].measure) : [];
}

function neededSupply(hand, feature) {
  const cost = C.features[feature].cost;
  const short = SUP.filter(r => (cost[r] || 0) > hand[r]);
  return short.length ? short : SUP.slice().sort((a, b) => hand[a] - hand[b]);
}

function makePlan(state, seat, strat, rand) {
  const v = E.privateView(state, seat);
  const me = v.me;
  const hand = { ...me.hand };
  // Plan against spendable supplies, not cards that the shed must discard
  // before resolution. This prevents the robot from repeatedly locking an
  // unaffordable plan and defaulting to Car-Boot Sales in long matches.
  const pendingCompost = Math.min(me.compostOwed || 0,
    Math.max(0, SUP.reduce((n, r) => n + hand[r], 0) - C.shedCapacity));
  for (let i = 0; i < pendingCompost; i++) {
    const largest = SUP.slice().sort((a, b) => hand[b] - hand[a])[0];
    if (hand[largest] > 0) hand[largest] -= 1;
  }
  const L = me.legal;
  const plots = v.board.plots;
  const byId = Object.fromEntries(plots.map(p => [p.id, p]));
  const god = v.players[seat].god;
  const threatened = new Set(v.forecast.now.filter(d => !d.good).flatMap(d => d.plots));
  const tags = upcomingTags(v);
  const measures = upcomingMeasures(v);
  const leader = v.players.filter(p => p.seat !== seat).sort((a, b) => b.score - a.score)[0];
  const slots = [];
  const used = new Set();
  const W = {
    gardener: { shelter: 3, tend: 2, claim: 1, cultivate: 2.2, meddle: 0, carBoot: 0.6 },
    baron: { shelter: 1, tend: 1, claim: 3, cultivate: 1.6, meddle: 0.3, carBoot: 0.6 },
    chaser: { shelter: 1.5, tend: 1.5, claim: 1.5, cultivate: 3, meddle: 0.2, carBoot: 0.6 },
    menace: { shelter: 1, tend: 1, claim: 1, cultivate: 1.5, meddle: 3, carBoot: 0.6 }
  }[strat];

  function options() {
    const opts = [];
    const add = (score, slot, cost) => { if (canPay(hand, cost)) opts.push({ score: score + rand() * 0.3, slot, cost }); };
    if (strat === 'random') {
      L.shelter.forEach(t => add(1, { kind: 'shelter', target: t }, C.actions.shelter.cost));
      L.tend.forEach(t => add(1, { kind: 'tend', target: t }, C.actions.tend.cost));
      L.claim.forEach(t => add(1, { kind: 'claim', target: t }, god === 'thor' ? { turf: 1 } : C.actions.claim.cost));
      L.meddle.forEach(t => add(1, { kind: 'meddle', target: t, mode: rand() < 0.5 ? 'trample' : 'pilfer' }, C.actions.meddle.cost));
      L.cultivate.forEach(t => Object.keys(C.features).forEach(f => add(1, { kind: 'cultivate', target: t, feature: f }, C.features[f].cost)));
      add(1, { kind: 'carBoot', supplies: [pick(rand, SUP), pick(rand, SUP)] }, {});
      return opts;
    }
    L.shelter.forEach(t => {
      const p = byId[t];
      if (!threatened.has(t) || used.has('shelter:' + t)) return;
      const value = 1 + p.health + (p.feature ? C.features[p.feature].prestige * 1.5 : 0);
      add(W.shelter * value / 2, { kind: 'shelter', target: t }, C.actions.shelter.cost);
    });
    L.tend.forEach(t => {
      const p = byId[t];
      if (used.has('tend:' + t)) return;
      const bad = p.condition && C.conditions[p.condition].bad;
      const need = bad ? 2.5 : (3 - p.health) * (measures.includes('lush') || measures.includes('health') ? 1.4 : 1);
      if (need <= 0) return;
      add(W.tend * need / 2, { kind: 'tend', target: t }, C.actions.tend.cost);
    });
    L.claim.forEach(t => {
      const p = byId[t];
      if (used.has('claim:' + t)) return;
      const value = (p.terrain === 'scorched' ? 0.4 : 1.4) + p.health * 0.3 + (measures.includes('plots') ? 1 : 0);
      add(W.claim * value, { kind: 'claim', target: t }, god === 'thor' ? { turf: 1 } : C.actions.claim.cost);
    });
    L.meddle.forEach(t => {
      const p = byId[t];
      const vsLeader = leader && p.owner === leader.seat ? 1.5 : 1;
      const mode = p.feature || rand() < 0.5 ? 'trample' : 'pilfer';
      add(W.meddle * vsLeader * (p.feature ? 1.5 : 0.8), { kind: 'meddle', target: t, mode }, C.actions.meddle.cost);
    });
    L.cultivate.forEach(t => {
      const p = byId[t];
      if (used.has('plot:' + t)) return;
      const risk = threatened.has(t) ? 0.5 : 1;
      Object.entries(C.features).forEach(([f, def]) => {
        let value = def.prestige + def.tags.filter(tag => tags.includes(tag)).length * (strat === 'chaser' ? 2.5 : 1);
        if (strat === 'baron') value = 3 - SUP.reduce((n, r) => n + (def.cost[r] || 0), 0) / 2 + def.prestige * 0.5;
        add(W.cultivate * value * risk / 2, { kind: 'cultivate', target: t, feature: f }, def.cost);
      });
    });
    // Car-Boot: buy what the best unaffordable feature needs.
    const goal = Object.keys(C.features).sort((a, b) => C.features[b].prestige - C.features[a].prestige)[Math.floor(rand() * 3)];
    const need = neededSupply(hand, goal);
    add(W.carBoot, { kind: 'carBoot', supplies: [need[0], need[1] || need[0]] }, {});
    return opts;
  }

  const nSlots = me.slots;
  for (let i = 0; i < nSlots; i++) {
    const opts = options();
    if (!opts.length) { slots.push({ kind: 'carBoot', supplies: [SUP[0], SUP[1]] }); continue; }
    const best = strat === 'random' ? pick(rand, opts) : opts.sort((a, b) => b.score - a.score)[0];
    payIn(hand, best.cost);
    slots.push(best.slot);
    if (best.slot.target) {
      used.add(best.slot.kind + ':' + best.slot.target);
      if (best.slot.kind === 'cultivate') used.add('plot:' + best.slot.target);
    }
  }

  // Pledge to an emergency from what's left.
  let pledge = null;
  if (v.emergency) {
    const share = Math.ceil(v.emergency.target / v.players.length);
    const want = { gardener: share, chaser: share + (measures.includes('goodwill') ? 2 : 0), baron: Math.ceil(share / 2), menace: 0, random: Math.floor(rand() * (share + 1)) }[strat];
    pledge = { turf: 0, fertiliser: 0, sprinklers: 0, compost: 0, gnomeDust: 0 };
    let n = 0;
    SUP.slice().sort((a, b) => hand[b] - hand[a]).forEach(r => {
      while (n < want && hand[r] > pledge[r]) { pledge[r] += 1; n += 1; }
    });
  }
  return { slots, pledge };
}

function botOdin(state, seat, rand) {
  const p = state.players[seat];
  if (p.god !== 'odin' || p.odinUsedAct === state.act) return;
  state.forecast.now.forEach((d, index) => {
    if (d.good || d.target.kind !== 'sector') return;
    const mine = d.plots.filter(id => state.board.plots[state.board.index[id]].owner === seat).length;
    if (mine > 0 && rand() < 0.8) E.apply(state, seat, { type: 'odinShift', index, dir: rand() < 0.5 ? 1 : -1 }, state.updatedAt);
  });
}

/* ---------- invariants ---------- */

function check(state) {
  state.players.forEach(p => SUP.forEach(r => {
    assert.ok(Number.isInteger(p.hand[r]) && p.hand[r] >= 0, `${p.name} has ${p.hand[r]} ${r}`);
  }));
  if (!state.board) return;
  state.board.plots.forEach(plot => {
    assert.ok(plot.health >= 0 && plot.health <= 3, `plot ${plot.id} health ${plot.health}`);
    if (plot.condition === 'ash') assert.ok(plot.health <= 2, `ash plot ${plot.id} above Healthy`);
    if (plot.feature) assert.ok(plot.owner !== null, `feature on unowned plot ${plot.id}`);
    if (plot.health === 0) assert.strictEqual(plot.feature, null, `ruined plot ${plot.id} kept its feature`);
    if (plot.owner !== null) assert.ok(state.players[plot.owner], `bad owner on ${plot.id}`);
  });
  const pub = E.publicView(state);
  assert.ok(!('secrets' in pub), 'public view leaked secrets');
  pub.players.forEach(p => assert.ok(!('hand' in p), 'public view leaked a hand'));
  if (state.phase.step === 'plan') assert.strictEqual(pub.resolution, null, 'plans visible during planning');
  state.players.forEach(p => {
    const mine = E.privateView(state, p.seat);
    assert.ok(!('secrets' in mine), 'private view leaked secrets');
  });
}

/* ---------- one game ---------- */

function playGame(gameNo, n, length = LENGTH) {
  const rand = rng(gameNo * 2654435761);
  let state = E.createGame({ seed: gameNo + 1, now: 1_700_000_000_000 });
  const strats = [];
  for (let i = 0; i < n; i++) {
    E.addPlayer(state, { name: 'Bot ' + i }, state.updatedAt);
    strats.push(pick(rand, STRATS));
  }
  const ok = r => { if (!r.ok) throw new Error(r.error); return r; };
  ok(E.apply(state, 0, { type: 'setOption', length }, state.updatedAt));
  ok(E.apply(state, 0, { type: 'start' }, state.updatedAt));
  const gods = shuffle(rand, GODS.slice()).slice(0, n);
  while (state.phase.stage === 'draft') ok(E.apply(state, state.phase.draftQueue[0], { type: 'chooseGod', god: gods[state.phase.draftQueue[0]] }, state.updatedAt));

  let steps = 0;
  const roundsEvents = [];
  while (state.phase.stage !== 'gameOver') {
    if (++steps > 2000) throw new Error('game did not finish');
    if (state.phase.step === 'plan') {
      for (let seat = 0; seat < n; seat++) {
        botOdin(state, seat, rand);
        const { slots, pledge } = makePlan(state, seat, strats[seat], rand);
        const r = E.apply(state, seat, { type: 'plan', slots }, state.updatedAt);
        if (!r.ok) ok(E.apply(state, seat, { type: 'plan', slots: slots.map(() => ({ kind: 'carBoot', supplies: ['turf', 'compost'] })) }, state.updatedAt));
        if (pledge && state.emergency) E.apply(state, seat, { type: 'pledge', supplies: pledge }, state.updatedAt);
        if (state.phase.step === 'plan') {
          let locked = E.apply(state, seat, { type: 'lock' }, state.updatedAt);
          // Robots must respect the same affordability/oversized-shed checks as
          // human players, including reserved emergency pledges. If denied,
          // revise the pledge first and then replace the plan with safe sales.
          if (!locked.ok && pledge && state.emergency) {
            ok(E.apply(state, seat, { type: 'pledge', supplies: {} }, state.updatedAt));
            locked = E.apply(state, seat, { type: 'lock' }, state.updatedAt);
          }
          if (!locked.ok) {
            const safe = slots.map(() => ({ kind: 'carBoot', supplies: ['turf', 'compost'] }));
            ok(E.apply(state, seat, { type: 'plan', slots: safe }, state.updatedAt));
            locked = E.apply(state, seat, { type: 'lock' }, state.updatedAt);
          }
          ok(locked);
        }
      }
      if (state.resolution) roundsEvents.push({ events: state.resolution.events.length, slots: E.slotCount(state) });
    } else {
      E.advance(state);
    }
    check(state);
    if (steps % 40 === 0) state = JSON.parse(JSON.stringify(state)); // save/load
  }

  state.final.scores.forEach(sc => assert.strictEqual(sc.total, sc.shows + sc.features + sc.goodwill, 'score parts do not add up'));
  return { state, strats, roundsEvents };
}

module.exports = { playGame, makePlan };

if (require.main === module) {
/* ---------- run and report ---------- */

const started = Date.now();
const agg = {
  games: 0, byCount: {}, god: {}, strat: {}, fizzled: 0, actions: 0, kinds: {},
  emergencies: { success: 0, failed: 0 }, ruined: 0, plots: 0, leaderWins: 0, leaderGames: 0,
  margins: [], sources: { shows: 0, features: 0, goodwill: 0 }, minutes: {}, peopleMinutes: {}
};
GODS.forEach(g => { agg.god[g] = { picked: 0, wins: 0, expected: 0, score: 0 }; });
STRATS.forEach(s => { agg.strat[s] = { picked: 0, wins: 0, expected: 0 }; });

for (let g = 0; g < GAMES; g++) {
  const n = COUNTS[g % COUNTS.length];
  const { state, strats, roundsEvents } = playGame(g, n);
  agg.games += 1;
  agg.byCount[n] = (agg.byCount[n] || 0) + 1;
  const winners = state.final.winners;
  const share = 1 / winners.length;
  state.players.forEach(p => {
    const won = winners.includes(p.seat) ? share : 0;
    const sc = state.final.scores.find(x => x.seat === p.seat);
    agg.god[p.god].picked += 1; agg.god[p.god].wins += won; agg.god[p.god].expected += 1 / n; agg.god[p.god].score += sc.total;
    agg.strat[strats[p.seat]].picked += 1; agg.strat[strats[p.seat]].wins += won; agg.strat[strats[p.seat]].expected += 1 / n;
    agg.sources.shows += sc.shows; agg.sources.features += sc.features; agg.sources.goodwill += sc.goodwill;
  });
  agg.actions += state.stats.actions; agg.fizzled += state.stats.fizzled;
  Object.entries(state.stats.byKind).forEach(([k, v]) => { agg.kinds[k] = (agg.kinds[k] || 0) + v; });
  state.stats.emergencies.forEach(r => { agg.emergencies[r] += 1; });
  agg.ruined += state.board.plots.filter(p => p.owner !== null && p.health === 0).length;
  agg.plots += state.board.plots.filter(p => p.owner !== null).length;
  const lead = state.stats.showLeaders[0];
  if (lead !== null && lead !== undefined) { agg.leaderGames += 1; if (winners.includes(lead)) agg.leaderWins += 1; }
  const sorted = state.final.scores.map(s => s.total).sort((a, b) => b - a);
  if (sorted[0] > 0) agg.margins.push((sorted[0] - sorted[1]) / sorted[0]);
  if (!strats.includes('random') && sorted[0] > 0) (agg.marginsNoRandom = agg.marginsNoRandom || []).push((sorted[0] - sorted[1]) / sorted[0]);
  // Estimated real duration: 6 s omens + 45 s planning + animated resolution + disasters + harvest, + shows + 2 min setup.
  // Robot estimate: 45 s planning (60 s with 3 actions). People: +20 s per round (+35 s with 3 actions) for talk and trading.
  const resolve = roundsEvents.reduce((t, e) => t + Math.min(30, Math.max(4, e.events * 1.2)), 0);
  const plan = roundsEvents.reduce((t, e) => t + (e.slots >= 3 ? 60 : 45), 0);
  const talk = roundsEvents.reduce((t, e) => t + (e.slots >= 3 ? 35 : 20), 0);
  const secs = state.round * (6 + 6 + 3) + plan + resolve + state.shows.length * 14 + 120;
  (agg.minutes[n] = agg.minutes[n] || []).push(secs / 60);
  (agg.peopleMinutes[n] = agg.peopleMinutes[n] || []).push((secs + talk) / 60);
}

const pct = x => (x * 100).toFixed(1) + '%';
const median = a => { const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length / 2)] || 0; };
const totalPts = agg.sources.shows + agg.sources.features + agg.sources.goodwill;
const emTotal = agg.emergencies.success + agg.emergencies.failed;

const godRows = GODS.map(g => {
  const d = agg.god[g];
  const ratio = d.wins / d.expected;
  return { g, picked: d.picked, rate: d.wins / d.picked, fair: d.expected / d.picked, ratio, avg: d.score / d.picked, ok: ratio >= 0.6 && ratio <= 1.4 };
}).sort((a, b) => b.ratio - a.ratio);
const stratRows = STRATS.map(s => ({ s, ratio: agg.strat[s].wins / agg.strat[s].expected, picked: agg.strat[s].picked })).sort((a, b) => b.ratio - a.ratio);

const checks = [
  ['God win rates within ±40% of fair share', godRows.every(r => r.ok), godRows.filter(r => !r.ok).map(r => r.g).join(', ') || 'all within'],
  ['Leader after Show 1 wins 35–55%', agg.leaderWins / agg.leaderGames >= 0.35 && agg.leaderWins / agg.leaderGames <= 0.55, pct(agg.leaderWins / agg.leaderGames)],
  ["Median winner's margin under 15%", median(agg.margins) < 0.15, pct(median(agg.margins))],
  ['Shows 40–60% of points', agg.sources.shows / totalPts >= 0.4 && agg.sources.shows / totalPts <= 0.6, pct(agg.sources.shows / totalPts)],
  ['Features 25–45% of points', agg.sources.features / totalPts >= 0.25 && agg.sources.features / totalPts <= 0.45, pct(agg.sources.features / totalPts)],
  ['Goodwill 5–20% of points', agg.sources.goodwill / totalPts >= 0.05 && agg.sources.goodwill / totalPts <= 0.2, pct(agg.sources.goodwill / totalPts)],
  ['Emergencies succeed 40–70%', agg.emergencies.success / emTotal >= 0.4 && agg.emergencies.success / emTotal <= 0.7, pct(agg.emergencies.success / emTotal)],
  ['Actions fizzling under 10%', agg.fizzled / agg.actions < 0.1, pct(agg.fizzled / agg.actions)],
  ['Owned plots Ruined at end 10–30%', agg.ruined / agg.plots >= 0.1 && agg.ruined / agg.plots <= 0.3, pct(agg.ruined / agg.plots)],
  ['Car-Boot Sale under 35% of actions', (agg.kinds.carBoot || 0) / agg.actions < 0.35, pct((agg.kinds.carBoot || 0) / agg.actions)]
];

let md = `# V2 balance report: ${LENGTH} game\n\n${agg.games} seeded robot games (2–8 players), ${((Date.now() - started) / 1000).toFixed(0)} s. Every rules check passed on every step.\n\n`;
md += '## Targets\n\n| Measure | Result | Target met |\n| --- | --- | --- |\n';
checks.forEach(([name, okay, val]) => { md += `| ${name} | ${val} | ${okay ? 'Yes' : '**No**'} |\n`; });
md += `\nWinner's margin in games with no random robot: median ${pct(median(agg.marginsNoRandom || []))} (${(agg.marginsNoRandom || []).length} games).\n`;
md += '\n## Gods (win rate when picked)\n\n| God | Games | Win rate | Fair share | Ratio | Avg score |\n| --- | --- | --- | --- | --- | --- |\n';
godRows.forEach(r => { md += `| ${C.gods[r.g].name} | ${r.picked} | ${pct(r.rate)} | ${pct(r.fair)} | ${r.ratio.toFixed(2)}${r.ok ? '' : ' ⚠'} | ${r.avg.toFixed(1)} |\n`; });
md += '\n## Robot play styles\n\n| Style | Ratio to fair share |\n| --- | --- |\n';
stratRows.forEach(r => { md += `| ${r.s} | ${r.ratio.toFixed(2)} |\n`; });
md += '\n## Action mix\n\n| Action | Share |\n| --- | --- |\n';
Object.entries(agg.kinds).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => { md += `| ${k} | ${pct(v / agg.actions)} |\n`; });
md += '\n## Estimated real length (minutes)\n\n| Players | Robots | Likely with people |\n| --- | --- | --- |\n';
Object.keys(agg.minutes).forEach(n => { md += `| ${n} | ${median(agg.minutes[n]).toFixed(0)} | ${median(agg.peopleMinutes[n]).toFixed(0)} |\n`; });
md += '\nEstimate: 45 s real planning per round, animated resolution, plus 2 minutes setup. Real tables will vary.\n';

fs.mkdirSync(path.join(__dirname, '..', 'reports'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '..', 'reports', `balance-v2-${LENGTH}.md`), md);
console.log(md);
}
