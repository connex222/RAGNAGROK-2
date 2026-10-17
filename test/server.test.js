'use strict';
/* End-to-end server test.
   Starts a real server, connects a TV and phones over real sockets, and checks:
     1. Lobby: join, bad codes, kick, leave, host-only start
     2. Privacy: no phone ever receives another player's hand; the TV never receives any hand
     3. A complete game played over the network to a winner
     4. A phone dropping mid-game, then rejoining with its saved token
     5. Pause / resume
     6. Server restart: saved to disk, reloaded, every phone rejoins, game finishes
     7. Rematch keeps the same phones in the same seats
   Run: npm run test:server */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { io: connect } = require('socket.io-client');
const { startServer } = require('../server/index');
const { next } = require('../src/engine/rng');

const RES = ['compost', 'fertilizer', 'sprinklers', 'turf', 'gnomeDust'];
const FACTIONS = ['thor', 'loki', 'freya', 'hel', 'odin', 'heimdall', 'frigg', 'njord'];
const FAST = { capacity: 100000, refillPerSec: 100000 }; // robots tap faster than humans
const sleep = ms => new Promise(r => setTimeout(r, ms));

const bstate = { s: 4242 };
const rand = () => next(bstate);
const pick = arr => arr[Math.floor(rand() * arr.length)];

function client(url, label) {
  const s = connect(url, { transports: ['websocket'], forceNew: true, reconnection: false });
  const c = { s, label, view: null, events: [], kicked: false, seat: null, token: null, code: null };
  s.on('state', v => {
    if (!c.view || v.stateVersion >= c.view.stateVersion) c.view = v;
    assertPrivacy(c, v);
  });
  s.on('events', ev => c.events.push(...ev));
  s.on('kicked', () => { c.kicked = true; });
  return c;
}

function assertPrivacy(c, v) {
  assert.ok(!('secrets' in v), `${c.label} received secrets`);
  v.players.forEach(p => assert.ok(!('hand' in p), `${c.label} received a hand in players[]`));
  if (c.label === 'tv') assert.ok(!v.me, 'TV received a private view');
  if (v.me) assert.strictEqual(v.players[v.me.seat] !== undefined, true);
}

async function call(c, event, data = {}) {
  return c.s.timeout(4000).emitWithAck(event, data);
}

async function waitFor(fn, what, ms = 4000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (fn()) return;
    await sleep(5);
  }
  throw new Error('Timed out waiting for ' + what);
}

async function connected(c) {
  await waitFor(() => c.s.connected, `${c.label} to connect`);
}

/* Wait until a phone has caught up with the version the TV has seen. */
async function fresh(c, tv) {
  await waitFor(() => c.view && tv.view && c.view.stateVersion >= tv.view.stateVersion, `${c.label} to catch up`);
}

function cardsFrom(hand, n) {
  const pool = [];
  RES.forEach(r => { for (let i = 0; i < hand[r]; i++) pool.push(r); });
  const out = {};
  RES.forEach(r => { out[r] = 0; });
  for (let i = 0; i < n; i++) {
    const k = Math.floor(rand() * pool.length);
    out[pool[k]] += 1;
    pool.splice(k, 1);
  }
  return out;
}

async function act(c, action) {
  const r = await call(c, 'action', action);
  return r;
}

async function mustAct(c, action) {
  const r = await act(c, action);
  if (!r.ok) throw new Error(`${c.label} ${action.type} failed: ${r.error}`);
  return r;
}

/* One robot decision, made only from what the screens were sent. */
async function step(tv, phones) {
  const pub = tv.view;
  const ph = pub.phase;

  if (ph.stage === 'factions') {
    const seat = ph.draftQueue[0];
    const taken = pub.players.map(p => p.faction).filter(Boolean);
    await fresh(phones[seat], tv);
    await mustAct(phones[seat], { type: 'chooseFaction', faction: pick(FACTIONS.filter(f => !taken.includes(f))) });
    return;
  }

  if (ph.stage === 'setup') {
    const c = phones[ph.activeSeat];
    await fresh(c, tv);
    const L = c.view.me.legal;
    if (ph.step === 'placeShack') await mustAct(c, { type: 'build', what: 'shack', at: pick(L.shack) });
    else await mustAct(c, { type: 'build', what: 'path', at: pick(L.path) });
    return;
  }

  if (ph.pendingBonus) {
    const c = phones[ph.pendingBonus.seat];
    const r = RES.find(x => pub.bank.resources[x] > 0);
    if (r) { await fresh(c, tv); await act(c, { type: 'claimBonus', resource: r }); }
  }
  if (ph.pendingSkim) {
    const c = phones[ph.pendingSkim.seat];
    const r = RES.find(x => ph.pendingSkim.pool[x] > 0 && pub.bank.resources[x] > 0);
    if (r) { await fresh(c, tv); await act(c, { type: 'skim', resource: r }); }
  }

  // Background trading from a random phone.
  if (rand() < 0.25) {
    const c = pick(phones);
    await fresh(c, tv);
    const me = c.view.me;
    const incoming = me.trades.filter(t => t.from !== me.seat);
    if (incoming.length && rand() < 0.6) {
      await act(c, { type: 'respondTrade', id: pick(incoming).id, accept: rand() < 0.5 });
    } else {
      const have = RES.filter(r => me.hand[r] > 0);
      if (have.length) {
        const give = pick(have);
        await act(c, { type: 'offerTrade', to: null, give: { [give]: 1 }, want: { [pick(RES.filter(r => r !== give))]: 1 } });
      }
    }
  }

  const seat = tv.view.phase.activeSeat;
  const c = phones[seat];
  await fresh(c, tv);
  const v = c.view;
  const me = v.me;
  const L = me.legal;

  switch (v.phase.step) {
    case 'roll':
      await mustAct(c, { type: 'roll' });
      return;
    case 'discard':
      for (const [k, owe] of Object.entries(v.phase.pendingDiscards)) {
        const p = phones[Number(k)];
        await fresh(p, tv);
        await mustAct(p, { type: 'discard', cards: cardsFrom(p.view.me.hand, owe) });
      }
      return;
    case 'moveMower':
      await mustAct(c, { type: 'moveMower', hex: pick(L.mower) });
      return;
    case 'steal': {
      const victim = pick(v.phase.pendingSteal.victims);
      let picks;
      if (me.stealPeek) {
        const hand = me.stealPeek[victim];
        const n = Math.min(2, RES.reduce((s, r) => s + hand[r], 0));
        const cc = cardsFrom(hand, n);
        picks = [];
        RES.forEach(r => { for (let i = 0; i < cc[r]; i++) picks.push(r); });
      }
      await mustAct(c, { type: 'steal', victim, picks });
      return;
    }
    case 'main': {
      if (me.odinChoice) return void await mustAct(c, { type: 'keepPerk', id: me.odinChoice[0].id });
      if (L.afford.manor && L.manor.length) return void await mustAct(c, { type: 'build', what: 'manor', at: pick(L.manor) });
      if (L.afford.shack && L.shack.length) return void await mustAct(c, { type: 'build', what: 'shack', at: pick(L.shack) });
      if (L.afford.path && L.path.length && rand() < 0.6) return void await mustAct(c, { type: 'build', what: 'path', at: pick(L.path) });
      if (L.afford.perk && rand() < 0.5) return void await mustAct(c, { type: 'buyPerk' });
      const perks = me.perks.held.filter(p => p.type === 'militia' || p.type === 'binDay');
      if (perks.length && rand() < 0.4) {
        const p = pick(perks);
        const r = await act(c, { type: 'playPerk', id: p.id, resource: pick(RES) });
        if (r.ok) return;
      }
      const tradable = RES.filter(r => me.hand[r] >= L.bankRatios[r]);
      if (tradable.length && rand() < 0.5) {
        const give = pick(tradable);
        const get = RES.find(r => r !== give && v.bank.resources[r] > 0);
        if (get) return void await mustAct(c, { type: 'bankTrade', give, get });
      }
      await mustAct(c, { type: 'endTurn' });
      return;
    }
    case 'specialBuild':
      for (const s of v.phase.specialBuildPending) {
        await fresh(phones[s], tv);
        await mustAct(phones[s], { type: 'doneSpecialBuild' });
      }
      return;
    default:
      await sleep(10);
  }
}

async function playUntil(tv, phones, stopWhen, maxSteps = 20000) {
  for (let i = 0; i < maxSteps; i++) {
    if (tv.view.phase.stage === 'gameOver' || stopWhen()) return;
    await step(tv, phones);
  }
  throw new Error('Game did not finish over the network');
}

async function joinPhones(url, code, n) {
  const phones = [];
  for (let i = 0; i < n; i++) {
    const c = client(url, `phone${i}`);
    await connected(c);
    const r = await call(c, 'player:join', { code, name: `Bot ${i}`, avatar: '🤖' });
    assert.ok(r.ok, r.error);
    Object.assign(c, { seat: r.seat, token: r.token, code });
    phones.push(c);
  }
  return phones;
}

function check(label) {
  console.log(`  ✔ ${label}`);
}

async function main() {
  const saveDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ragnagrok-'));
  let srv = await startServer({ port: 0, saveDir, quiet: true, tickMs: 200, rate: FAST });
  let url = `http://localhost:${srv.port}`;
  console.log('Server test');

  /* 1. Lobby */
  const tv = client(url, 'tv');
  await connected(tv);
  const made = await call(tv, 'tv:create', {});
  assert.ok(made.ok && /^[A-HJ-NP-Z]{4}$/.test(made.code), 'room code format');
  assert.ok(made.qr.startsWith('data:image/png;base64,'), 'QR code generated');
  const code = made.code;

  const bad = client(url, 'stranger');
  await connected(bad);
  assert.strictEqual((await call(bad, 'player:join', { code: 'ZZZZ', name: 'x' })).ok, false);
  assert.strictEqual((await call(bad, 'player:rejoin', { code, token: 'nope' })).ok, false);
  check('bad room codes and fake tokens are refused');

  const phones = await joinPhones(url, code, 5);
  await waitFor(() => tv.view && tv.view.players.length === 5, 'TV to list 5 players');
  assert.strictEqual((await call(phones[2], 'host:start', {})).ok, false, 'non-host start');
  const kicked = await call(phones[0], 'host:kick', { seat: 4 });
  assert.ok(kicked.ok, kicked.error);
  await waitFor(() => phones[4].kicked, 'kicked phone to be told');
  phones[4].s.close();
  phones.pop();
  await waitFor(() => tv.view.players.length === 4, 'TV to drop the kicked player');
  check('joining, host-only start and kicking work');

  /* 2 + 3. Start and play over the network */
  assert.ok((await call(phones[0], 'host:start', {})).ok);
  await waitFor(() => tv.view.phase.stage === 'factions', 'draft to start');
  await waitFor(() => tv.view.topology && phones.every(p => p.view.topology), 'board geometry to arrive');
  check('board geometry sent once to every screen');

  /* 4. A phone drops mid-game */
  await playUntil(tv, phones, () => tv.view.phase.stage === 'playing' && tv.view.phase.turn >= 12);
  const dropped = phones[2];
  dropped.s.close();
  await waitFor(() => tv.view.players[2].connected === false, 'TV to see the phone drop');
  const back = client(url, 'phone2');
  await connected(back);
  const rj = await call(back, 'player:rejoin', { code, token: dropped.token });
  assert.ok(rj.ok && rj.seat === 2, 'rejoin to the same seat');
  Object.assign(back, { seat: 2, token: dropped.token, code });
  phones[2] = back;
  await waitFor(() => tv.view.players[2].connected === true, 'TV to see the phone return');
  await waitFor(() => back.view && back.view.me && back.view.me.seat === 2 && back.view.topology, 'rejoined phone to get its hand and board');
  check('a phone can drop and rejoin its own seat mid-game');

  /* 5. Pause */
  await waitFor(() => tv.view.phase.stage === 'playing', 'still playing');
  const prePause = tv.view.phase.deadline;
  assert.ok((await call(tv, 'host:pause', {})).ok);
  await waitFor(() => tv.view.meta.paused, 'pause to show');
  const blocked = await call(phones[tv.view.phase.activeSeat], 'action', { type: 'endTurn' });
  assert.strictEqual(blocked.ok, false, 'actions blocked while paused');
  await sleep(300);
  assert.ok((await call(tv, 'host:resume', {})).ok);
  await waitFor(() => !tv.view.meta.paused, 'resume to show');
  assert.ok(tv.view.phase.deadline >= prePause, 'timer shifted by the pause');
  check('pause blocks play and resume restores the timer');

  /* 6. Server restart from disk */
  await playUntil(tv, phones, () => tv.view.phase.turn >= 30);
  const versionBefore = tv.view.stateVersion;
  [tv, ...phones].forEach(c => c.s.close());
  await srv.close();
  srv.server.close();

  srv = await startServer({ port: 0, saveDir, quiet: true, tickMs: 200, rate: FAST });
  url = `http://localhost:${srv.port}`;
  const tv2 = client(url, 'tv');
  await connected(tv2);
  const att = await call(tv2, 'tv:attach', { code, hostKey: made.hostKey });
  assert.ok(att.ok && att.isHost, 'TV re-attached as host after restart');
  await waitFor(() => tv2.view && tv2.view.meta.paused, 'restored game to wait paused');
  assert.ok(tv2.view.stateVersion >= versionBefore, 'restored the saved game');

  const phones2 = [];
  for (const old of phones) {
    const c = client(url, old.label);
    await connected(c);
    const r = await call(c, 'player:rejoin', { code, token: old.token });
    assert.ok(r.ok && r.seat === old.seat, 'phone rejoined after restart');
    Object.assign(c, { seat: r.seat, token: old.token, code });
    phones2.push(c);
  }
  await waitFor(() => !tv2.view.meta.paused, 'game to resume once every phone is back');
  check('server restart: game restored from disk and resumes when all phones return');

  await playUntil(tv2, phones2, () => false);
  assert.strictEqual(tv2.view.phase.stage, 'gameOver');
  const w = tv2.view.players[tv2.view.winner.seat];
  assert.ok(w.vp.total >= 10, 'winner total revealed at game over');
  check(`complete game played over the network (winner: ${w.name}, ${w.vp.total} VP, turn ${tv2.view.phase.turn})`);

  /* 7. Rematch */
  assert.ok((await call(tv2, 'host:rematch', {})).ok);
  await waitFor(() => tv2.view.phase.stage === 'lobby' && tv2.view.players.length === 4, 'rematch lobby');
  await waitFor(() => phones2.every(p => p.view.phase.stage === 'lobby' && p.view.me.seat === p.seat), 'phones kept their seats');
  check('rematch keeps every phone in its seat');

  /* An 8-player game, full speed, no restarts */
  const tv8 = client(url, 'tv');
  await connected(tv8);
  const r8 = await call(tv8, 'tv:create', {});
  const p8 = await joinPhones(url, r8.code, 8);
  await waitFor(() => tv8.view && tv8.view.players.length === 8, '8 players');
  assert.ok((await call(p8[0], 'host:start', {})).ok);
  await waitFor(() => tv8.view.phase.stage === 'factions', '8p draft');
  await playUntil(tv8, p8, () => false);
  assert.strictEqual(tv8.view.config.boardSize, 'expanded');
  check(`8-player game on the expanded board finished (turn ${tv8.view.phase.turn})`);

  [tv2, tv8, bad, ...phones2, ...p8].forEach(c => c.s.close());
  await srv.close();
  srv.server.close();
  fs.rmSync(saveDir, { recursive: true, force: true });
  console.log('✔ All server checks passed');
  process.exit(0);
}

main().catch(err => {
  console.error('✘ Server test failed:', err);
  process.exit(1);
});
