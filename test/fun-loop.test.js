'use strict';
/* The entertainment-facing view layer must reflect genuine engine scoring,
   must not reveal secret plans and must not quietly change the winner. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const E = require('../src/engine/garden');

let count = 0;
function test(label, check) {
  check(); count++;
  console.log('  ✔ ' + label);
}
function ok(out) { assert.equal(out.ok, true, out.error); }
function setup() {
  const state = E.createGame({ seed: 9501, roomCode: 'SHOW', now: 1000 });
  ok(E.addPlayer(state, { name: 'A' }, 1000));
  ok(E.addPlayer(state, { name: 'B' }, 1000));
  ok(E.apply(state, 0, { type: 'setOption', length: 'standard' }, 1000));
  ok(E.apply(state, 0, { type: 'start' }, 1000));
  while (state.phase.stage === 'draft') {
    const seat = state.phase.draftQueue[0];
    ok(E.apply(state, seat, { type: 'chooseGod', god: seat ? 'freya' : 'thor' }, 1000));
  }
  E.advance(state);
  return state;
}
console.log('Replayability / Show-race / Honours contracts');

test('Unannounced categories cannot appear in a preview', () => {
  const s = setup();
  s.shows[0].categories = null;
  assert.equal(E.publicView(s).showPreview, null);
});

test('The same seeded current garden yields stable provisional standings without mutation', () => {
  const s = setup();
  s.shows[0].categories = ['lushestLawn', 'hardyPerennial'];
  const ownedA = s.board.plots.filter(p => p.owner === 0);
  const ownedB = s.board.plots.filter(p => p.owner === 1);
  for (const p of ownedA) p.health = 3;
  for (const p of ownedB) p.health = 1;
  const before = JSON.stringify(s);
  const first = E.publicView(s).showPreview;
  assert.ok(first && first.provisional);
  assert.equal(first.after, 3);
  assert.deepEqual(first, E.privateView(s, 0).showPreview);
  assert.deepEqual(first, E.privateView(s, 1).showPreview);
  assert.equal(JSON.stringify(s), before, 'view projection must not mutate game or RNG');
  assert.equal(first.categories.length, 2);
  assert.equal(first.categories[0].rows[0].seat, 0);
  assert.equal(first.categories[0].rows[0].rank, 1);
  assert.equal(first.categories[1].rows.length, 0, 'minimum owned plots is enforced');
});

test('Tied category leaders receive identical rank and proposed points', () => {
  const s = setup();
  s.shows[0].categories = ['lushestLawn'];
  const rows = E.publicView(s).showPreview.categories[0].rows;
  assert.equal(rows.length, 0, 'health 2 is not Lush');
  s.board.plots.filter(p => p.owner !== null).forEach(p => { p.health = 3; });
  const tied = E.categoryStandings(s, 'lushestLawn');
  assert.equal(tied.length, 2);
  assert.deepEqual(tied.map(r => r.rank), [1, 1]);
  assert.deepEqual(tied.map(r => r.points), [3, 3]);
});

test('Actual Show judging uses the same calculation as the provisional preview', () => {
  const s = setup();
  s.shows[0].categories = ['lushestLawn', 'landBaron'];
  s.board.plots.filter(p => p.owner === 0).forEach(p => { p.health = 3; });
  const preview = E.upcomingShowStandings(s);
  const byCat = Object.fromEntries(preview.categories.map(c => [c.key, c.rows]));
  const before = s.players.map(p => p.showPoints);
  // Force the exact Show transition without planning/disaster changes; a
  // presentation-only snapshot must equal the real point allocations.
  s.round = 3;
  s.phase.step = 'harvest';
  s.phase.deadline = 2000;
  E.advance(s);
  assert.equal(s.phase.step, 'show');
  for (const key of s.shows[0].categories)
    assert.deepEqual(s.shows[0].results[key], byCat[key]);
  for (const p of s.players) {
    const expected = Object.values(byCat).reduce((total, rows) => total + (rows.find(r => r.seat === p.seat)?.points || 0), 0);
    assert.equal(p.showPoints - before[p.seat], expected);
  }
  assert.equal(E.publicView(s).showPreview, null, 'a judged Show stops displaying as upcoming');
});

test('Honours include legitimate ties, skip empty achievements and never change scores', () => {
  const s = setup();
  s.players[0].showPoints = 7;
  s.players[1].showPoints = 7;
  const scores = s.players.map(p => E.scoreOf(s, p.seat));
  const before = JSON.stringify(s);
  const honours = E.gardenHonours(s, scores);
  assert.deepEqual(honours.map(h => h.key), ['showstopper']);
  assert.deepEqual(honours[0].seats, [0, 1]);
  assert.equal(honours[0].value, 7);
  assert.equal(JSON.stringify(s), before);
  s.players[1].goodwill = 2;
  const next = E.gardenHonours(s, s.players.map(p => E.scoreOf(s, p.seat)));
  assert.deepEqual(next.find(h => h.key === 'neighbour').seats, [1]);
});

test('Final honours remain visible after a real end transition; victory is score-based', () => {
  const s = setup();
  s.players[0].showPoints = 6;
  s.players[1].goodwill = 4;
  s.round = 9;
  s.phase.step = 'show';
  s.phase.deadline = 2000;
  E.advance(s);
  assert.equal(s.phase.stage, 'gameOver');
  assert.deepEqual(s.final.winners, [0]);
  const final = E.publicView(s).final;
  assert.deepEqual(final.winners, [0]);
  assert.ok(final.honours.some(h => h.key === 'showstopper' && h.seats.includes(0)));
  assert.ok(final.honours.some(h => h.key === 'neighbour' && h.seats.includes(1)));
  assert.equal(final.scores[0].total, 6);
  assert.equal(final.scores[1].total, 4);
});

test('TV and phone scripts compile; game UI contains previews, honours and honest disclaimers', () => {
  for (const file of ['index.html', 'play.html']) {
    const page = fs.readFileSync(path.join(__dirname, '../public/v2', file), 'utf8');
    const scripts = [...page.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
    assert.ok(scripts.length >= 1);
    for (const script of scripts) new vm.Script(script, { filename: file });
    assert.match(page, /showPreview|renderShowRace/);
    assert.match(page, /f\.honours|honourCards/);
  }
  const phone = fs.readFileSync(path.join(__dirname, '../public/v2/play.html'), 'utf8');
  assert.match(phone, /Secret actions, upcoming disasters/);
  assert.match(phone, /<details class="card show-race"/);
});

test('Phone Show-race markup renders the actual standings, not just a static placeholder', () => {
  const s = setup();
  s.shows[0].categories = ['lushestLawn', 'landBaron'];
  s.board.plots.find(p => p.owner === 0).health = 3;
  const page = fs.readFileSync(path.join(__dirname, '../public/v2/play.html'), 'utf8');
  const begin = page.indexOf('function renderShowRace() {');
  const end = page.indexOf('function renderPlanTab() {', begin);
  assert.ok(begin >= 0 && end > begin);
  let v = E.privateView(s, 0);
  const escape = v => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
  const context = { view: v, C: E.CONTENT, mySeat: () => 0, document: { querySelector: () => null },
    nm: seat => v.players[seat].name, esc: escape };
  vm.createContext(context);
  vm.runInContext(page.slice(begin, end) + ';this.previewMarkup=renderShowRace;', context);
  const html = context.previewMarkup();
  assert.match(html, /<details class="card show-race"/);
  assert.match(html, /Lushest Lawn/);
  assert.match(html, /Land Baron/);
  assert.match(html, /Secret actions, upcoming disasters/);
  assert.match(html, /if judged now/);
  // No UI-script injection via escaped player names.
  context.view.players[1].name = 'A&B';
  assert.match(context.previewMarkup(), /A&amp;B/);
});

test('Phone and TV award screens render tied honours without modifying winner', () => {
  const s = setup();
  s.players[0].showPoints = 7;
  s.players[1].showPoints = 7;
  s.players[1].goodwill = 2;
  s.round = 9;
  s.phase.step = 'show';
  s.phase.deadline = 2000;
  E.advance(s);
  const v = E.privateView(s, 0);
  v.meta = { isHost: true }; // room manager adds transport metadata after engine projection
  assert.deepEqual(v.final.winners, [1]);
  const phone = fs.readFileSync(path.join(__dirname, '../public/v2/play.html'), 'utf8');
  const start = phone.indexOf('function renderGameOver() {');
  const end = phone.indexOf('/* ================= sheets', start);
  const escape = v => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
  const ctx = { view: v, ART: {}, mySeat: () => 0, pl: seat => v.players[seat],
    nm: seat => v.players[seat].name, esc: escape };
  vm.createContext(ctx);
  vm.runInContext(phone.slice(start, end) + ';this.awardMarkup=renderGameOver;', ctx);
  const html = ctx.awardMarkup();
  assert.match(html, /Your garden honours/);
  assert.match(html, /Showstopper/);
  assert.doesNotMatch(html, /You win the Golden Flamingo/);
  assert.match(html, /shared/);
  const tv = fs.readFileSync(path.join(__dirname, '../public/v2/index.html'), 'utf8');
  const a = tv.indexOf('function renderOver() {');
  const b = tv.indexOf('function tickClock() {', a);
  const elem = { innerHTML: '' };
  const tvctx = { view: v, ART: {}, C: E.CONTENT, QUIPS: ['Nice gardening!'],
    godIcon: () => '', pl: seat => v.players[seat], nm: seat => escape(v.players[seat].name),
    esc: escape, $: () => elem };
  vm.createContext(tvctx);
  vm.runInContext(tv.slice(a, b) + ';this.showFinal=renderOver;', tvctx);
  tvctx.showFinal();
  assert.match(elem.innerHTML, /Showstopper/);
  assert.match(elem.innerHTML, /Neighbourhood Hero/);
  assert.match(elem.innerHTML, /tie/);
});

console.log(`✔ All ${count} replayability / game feedback checks passed`);
