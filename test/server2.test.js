'use strict';
/* V2 server test over real sockets.
   Checks the things that go wrong in real living rooms and on real hosting:
   privacy, bad or duplicate messages, room-code guessing, phones dropping out,
   pausing, a server restart mid-game, old save files, and rematches.
   Run: node test/server2.test.js */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { io: connect } = require('socket.io-client');
const { startServer } = require('../server/index');
const { lanAddresses } = require('../server/network');

const FAST_RATE = { capacity: 100000, refillPerSec: 100000 };
const FAST_GAME = { omensSec: 0.2, resolveMinSec: 0.2, resolvePerEventSec: 0.01, resolveMaxSec: 0.5, disastersSec: 0.2, harvestSec: 0.2, showSec: 0.3, draftSec: 20, planSec: 60 };
const SUP = ['turf', 'fertiliser', 'sprinklers', 'compost', 'gnomeDust'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const check = label => console.log('  ✔ ' + label);

async function waitFor(fn, what, ms = 8000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { try { if (fn()) return; } catch (e) { /* not yet */ } await sleep(10); }
  throw new Error('Timed out waiting for ' + what);
}

function client(url, label, headers) {
  const s = connect(url, { transports: ['websocket'], forceNew: true, reconnection: false, extraHeaders: headers });
  const c = { s, label, view: null };
  s.on('state', v => {
    if (!c.view || v.stateVersion >= c.view.stateVersion) c.view = v;
    // Privacy, checked on every single message.
    assert.ok(!('secrets' in v), `${label} received secrets`);
    v.players.forEach(p => assert.ok(!('hand' in p), `${label} received someone's hand`));
    if (v.phase && v.phase.step === 'plan') assert.strictEqual(v.resolution, null, `${label} saw plans before the reveal`);
    if (v.me && v.phase.step === 'plan') assert.ok(!JSON.stringify(v).includes('"plans"'), `${label} received other players' plans before the reveal`);
  });
  return c;
}
const call = (c, ev, data = {}) => c.s.timeout(4000).emitWithAck(ev, data);

/* A phone that plans something sensible and locks in whenever planning is open. */
function autoPlay(c) {
  c.auto = true;
  c.s.on('state', async v => {
    if (!c.auto || !v.me || v.phase.step !== 'plan' || v.players[v.me.seat].locked || c.busy) return;
    c.busy = true;
    const L = v.me.legal;
    // At most one Claim, and only when it is affordable alongside any pledge:
    // the server refuses to lock a plan the player cannot pay for.
    const free = r => v.me.hand[r] - ((v.me.pledge || {})[r] || 0);
    const canClaim = L.claim[0] && free('turf') > 0 && free('fertiliser') > 0;
    const slots = [...Array(v.me.slots)].map((x, i) => (i === 0 && canClaim
      ? { kind: 'claim', target: L.claim[0] } : { kind: 'carBoot', supplies: [SUP[i % 5], SUP[(i + 1) % 5]] }));
    try {
      let r = await call(c, 'action', { type: 'plan', slots });
      r = await call(c, 'action', { type: 'lock' });
      if (!r.ok) { // Fall back to a plan that is always affordable.
        await call(c, 'action', { type: 'plan', slots: slots.map((x, i) => ({ kind: 'carBoot', supplies: [SUP[i % 5], SUP[(i + 1) % 5]] })) });
        await call(c, 'action', { type: 'lock' });
      }
    } catch (e) { /* disconnected mid-way */ }
    c.busy = false;
  });
}

async function main() {
  // Simulate a trusted reverse proxy (as on Render) so the guesser below has its own address.
  process.env.TRUST_PROXY = '1';
  const saveDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ragnagrok2-'));
  let srv = await startServer({ port: 0, saveDir, quiet: true, tickMs: 40, rate: FAST_RATE, rules: 'v2', gameConfig: FAST_GAME });
  let url = `http://localhost:${srv.port}`;
  console.log('V2 server test');

  /* Room and join link */
  const tv = client(url, 'tv');
  await waitFor(() => tv.s.connected, 'TV');
  const made = await call(tv, 'tv:create');
  assert.ok(made.ok && /^[A-HJ-NP-Z]{4}$/.test(made.code));
  if (lanAddresses().length) assert.ok(!made.joinUrl.includes('localhost'), 'phones get a reachable address, not localhost');
  assert.ok(made.joinUrl.endsWith('/play?room=' + made.code));
  check(`room ${made.code} created; join link ${made.joinUrl.replace(/\/play.*/, '')} is reachable from phones`);

  /* Code guessing, from another address */
  const guesser = client(url, 'guesser', { 'x-forwarded-for': '10.9.9.9' });
  await waitFor(() => guesser.s.connected, 'guesser');
  for (let i = 0; i < 20; i++) await call(guesser, 'player:join', { code: 'ZZZZ', name: 'x' });
  const blocked = await call(guesser, 'player:join', { code: made.code, name: 'x' });
  assert.strictEqual(blocked.ok, false); assert.match(blocked.error, /Too many wrong codes/);
  check('20 wrong room codes from one address pauses that address, even for a correct code');

  /* Lobby */
  const phones = [];
  for (let i = 0; i < 5; i++) {
    const c = client(url, 'phone' + i);
    await waitFor(() => c.s.connected, c.label);
    const r = await call(c, 'player:join', { code: made.code, name: i === 0 ? '<b>Host</b>' : 'P' + i, avatar: '🌱' });
    assert.ok(r.ok, r.error);
    Object.assign(c, { token: r.token, seat: r.seat });
    phones.push(c);
  }
  await waitFor(() => tv.view && tv.view.players.length === 5, '5 players');
  assert.ok(!tv.view.players[0].name.includes('<'), 'names are cleaned of HTML');
  assert.ok((await call(phones[0], 'host:kick', { seat: 4 })).ok);
  phones.pop().s.close();
  await waitFor(() => tv.view.players.length === 4, 'kick');
  assert.strictEqual((await call(phones[1], 'action', { type: 'setOption', length: 'epic' })).ok, false, 'only the host changes options');
  assert.ok((await call(phones[0], 'action', { type: 'setOption', length: 'standard' })).ok);
  check('joining, name cleaning, kicking, host-only options');

  /* Bad and duplicate messages */
  const junk = [null, 'string', 42, { type: 'nope' }, { type: 'plan', slots: 'x' }, { type: 'plan', slots: [{ kind: 'claim', target: 'x'.repeat(5000) }, null] },
    { type: 'chooseGod', god: '__proto__' }, { type: 'pledge', supplies: { gold: 9 } }, { type: 'setOption', planSec: 99999 }];
  for (const j of junk) {
    const r = await call(phones[1], 'action', j);
    assert.strictEqual(r.ok, false, 'junk accepted: ' + JSON.stringify(j).slice(0, 60));
  }
  check('9 kinds of malformed message refused, server still running');

  assert.ok((await call(phones[0], 'host:start')).ok);
  await waitFor(() => tv.view.phase.stage === 'draft', 'draft');
  const gods = ['thor', 'freya', 'hel', 'odin'];
  while (tv.view.phase.stage === 'draft') {
    const seat = tv.view.phase.draftQueue[0];
    await call(phones[seat], 'action', { type: 'chooseGod', god: gods[seat] });
    await sleep(20);
  }
  await waitFor(() => tv.view.phase.step === 'plan', 'first Plan phase');
  const plan = [{ kind: 'carBoot', supplies: ['turf', 'turf'] }, { kind: 'carBoot', supplies: ['compost', 'compost'] }];
  assert.ok((await call(phones[0], 'action', { type: 'plan', slots: plan })).ok);
  assert.ok((await call(phones[0], 'action', { type: 'lock' })).ok);
  assert.strictEqual((await call(phones[0], 'action', { type: 'plan', slots: plan })).ok, false, 'no changes once locked');
  const again = await call(phones[0], 'action', { type: 'lock' });
  assert.ok(again.ok || again.error, 'a duplicate lock is harmless');
  check('locking in; a second lock and post-lock changes are harmless');

  /* Drop and rejoin mid-plan: the plan survives */
  assert.ok((await call(phones[1], 'action', { type: 'plan', slots: plan })).ok);
  phones[1].s.close();
  await waitFor(() => tv.view.players[1].connected === false, 'drop seen');
  const back = client(url, 'phone1b');
  await waitFor(() => back.s.connected, 'reconnect');
  const rj = await call(back, 'player:rejoin', { code: made.code, token: phones[1].token });
  assert.ok(rj.ok && rj.seat === 1);
  await waitFor(() => back.view && back.view.me && back.view.me.plan, 'plan restored');
  assert.deepStrictEqual(back.view.me.plan.map(x => x.kind), ['carBoot', 'carBoot']);
  Object.assign(back, { token: phones[1].token, seat: 1 });
  phones[1] = back;
  check('a phone that drops mid-plan rejoins its seat with its plan intact');

  /* Pause */
  const before = tv.view.phase.deadline;
  assert.ok((await call(tv, 'host:pause')).ok);
  await waitFor(() => tv.view.meta.paused, 'paused');
  assert.strictEqual((await call(phones[2], 'action', { type: 'lock' })).ok, false, 'no actions while paused');
  await sleep(400);
  assert.ok((await call(tv, 'host:resume')).ok);
  await waitFor(() => !tv.view.meta.paused && tv.view.phase.deadline > before, 'timer shifted');
  check('pause blocks actions; resume moves the timer on by the paused time');

  /* Play on, then restart the server mid-game */
  phones.forEach(autoPlay);
  await waitFor(() => tv.view.round >= 3, 'round 3', 20000);
  // An old v0.5.1 save in the same folder must be refused, not loaded.
  fs.writeFileSync(path.join(saveDir, 'OLDV.json'), JSON.stringify({ format: 'ragnagrok.room', code: 'OLDV', hostKey: 'x', state: { schemaVersion: 1, players: [], phase: { stage: 'playing' } } }));
  const round = tv.view.round;
  [tv, ...phones].forEach(c => { c.auto = false; c.s.close(); });
  await srv.close(); srv.server.close();

  srv = await startServer({ port: 0, saveDir, quiet: true, tickMs: 40, rate: FAST_RATE, rules: 'v2', gameConfig: FAST_GAME });
  url = `http://localhost:${srv.port}`;
  assert.ok(fs.existsSync(path.join(saveDir, 'incompatible', 'OLDV.json')), 'old save moved aside');
  assert.ok(!srv.rooms.get('OLDV'), 'old save not loaded');
  const tv2 = client(url, 'tv');
  await waitFor(() => tv2.s.connected, 'TV after restart');
  assert.ok((await call(tv2, 'tv:attach', { code: made.code, hostKey: made.hostKey })).ok);
  await waitFor(() => tv2.view && tv2.view.meta.paused, 'restored game waits paused');
  assert.ok(tv2.view.round >= round, 'restored the saved round');
  const phones2 = [];
  for (const old of phones) {
    const c = client(url, old.label + '-r');
    await waitFor(() => c.s.connected, 'phone after restart');
    const r = await call(c, 'player:rejoin', { code: made.code, token: old.token });
    assert.ok(r.ok && r.seat === old.seat);
    phones2.push(c);
  }
  await waitFor(() => !tv2.view.meta.paused, 'resumes when every phone is back');
  check('server restart: game restored from disk, waits, resumes when all 4 phones return; old v0.5.1 save refused');

  phones2.forEach(autoPlay);
  await waitFor(() => tv2.view.phase.stage === 'gameOver', 'game over', 60000);
  assert.ok(tv2.view.final && tv2.view.final.winners.length >= 1);
  check(`finished the game after the restart (${tv2.view.round} rounds)`);

  phones2.forEach(c => { c.auto = false; });
  assert.ok((await call(phones2[0], 'host:rematch')).ok);
  await waitFor(() => tv2.view.phase.stage === 'lobby' && tv2.view.config.length === 'standard', 'rematch');
  await waitFor(() => phones2.every((c, i) => c.view && c.view.me && c.view.me.seat === i), 'seats kept');
  check('rematch keeps every seat and the chosen game length');

  [tv2, guesser, ...phones2].forEach(c => c.s.close());
  await srv.close(); srv.server.close();
  fs.rmSync(saveDir, { recursive: true, force: true });
  console.log('✔ All V2 server checks passed');
  process.exit(0);
}

main().catch(err => { console.error('✘ V2 server test failed:', err.message); process.exit(1); });
