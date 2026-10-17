'use strict';
/* Phone UI test.
   Opens real copies of the phone page in a headless browser (jsdom), then
   plays a complete game ONLY by tapping what a person could tap: buttons,
   glowing board spots and card tiles. Fails on any page error.
   Run: npm run test:ui */

const assert = require('assert');
const { JSDOM, VirtualConsole } = require('jsdom');
const { startServer } = require('../server/index');
const { next } = require('../src/engine/rng');

const FAST = { capacity: 100000, refillPerSec: 100000 };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rs = { s: 777 };
const rand = () => next(rs);
const pick = arr => arr[Math.floor(rand() * arr.length)];
const errors = [];

async function openPhone(url, label) {
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => errors.push(`${label}: ${e.message}`));
  vc.on('error', e => errors.push(`${label} console.error: ${e}`));
  const dom = await JSDOM.fromURL(url, { runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc });
  const win = dom.window;
  win.addEventListener('error', e => errors.push(`${label}: ${e.message}`));
  await waitFor(() => (win.__rg || win.__rgtv) && win.io, `${label} page to load`, 10000);
  return { dom, win, label, doc: win.document };
}

async function waitFor(fn, what, ms = 6000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { if (fn()) return; } catch (e) { /* not ready */ }
    await sleep(10);
  }
  throw new Error('Timed out waiting for ' + what);
}

const q = (p, s) => p.doc.querySelector(s);
const qa = (p, s) => [...p.doc.querySelectorAll(s)];
const enabled = el => !!el && !el.disabled;
const visible = el => !!el && !el.closest('[hidden]');
const view = p => p.win.__rg.view();

function tap(p, el) {
  if (!el) return false;
  el.dispatchEvent(new p.win.MouseEvent('click', { bubbles: true, cancelable: true }));
  return true;
}

function tapFirst(p, selector) {
  const el = qa(p, selector).find(x => visible(x) && enabled(x));
  return el ? tap(p, el) : false;
}

/* One human-like decision, from what is on this phone's screen. */
function botStep(p) {
  const v = view(p);
  if (!v || !v.me) return false;

  if (!q(p, '#overlay').hidden) return false; // paused screen
  if (!q(p, '#sheetWrap').hidden) {
    const type = q(p, '#sheet').dataset.sheet;
    if (type === 'place' || type === 'mower') {
      if (tapFirst(p, '[data-act="confirmPlace"], [data-act="confirmMower"]')) return true;
      const spots = qa(p, '#sheet [data-spot]');
      return spots.length ? tap(p, pick(spots)) : false;
    }
    if (type === 'discard') {
      if (tapFirst(p, '[data-act="confirmDiscard"]')) return true;
      const adds = qa(p, '[data-act="discardAdd"]').filter(enabled);
      return adds.length ? tap(p, pick(adds)) : false;
    }
    if (type === 'steal') {
      if (tapFirst(p, '[data-act="confirmSteal"]')) return true;
      const picksLeft = qa(p, '[data-act="lokiPick"]').filter(enabled);
      if (picksLeft.length) return tap(p, pick(picksLeft));
      const victims = qa(p, '[data-act="stealFrom"]');
      return victims.length ? tap(p, pick(victims)) : false;
    }
    if (type === 'odin') return tapFirst(p, '[data-act="keepPerk"]');
    if (type === 'perk') {
      if (tapFirst(p, '[data-act="confirmPerk"]')) return true;
      const opts = qa(p, '#sheet [data-spot], [data-act="perkRes"], [data-act="perkOne"]').filter(enabled);
      if (opts.length) return tap(p, pick(opts));
      return tapFirst(p, '[data-act="closeSheet"]');
    }
    return tapFirst(p, '[data-act="closeSheet"]');
  }

  const ph = v.phase;
  if (ph.stage === 'factions') {
    const options = qa(p, '[data-act="pickFaction"]').filter(enabled);
    return options.length ? tap(p, pick(options)) : false;
  }
  if (ph.stage === 'gameOver' || ph.stage === 'lobby') return false;

  if (tapFirst(p, '[data-act="claimBonus"]') || tapFirst(p, '[data-act="skim"]')) return true;
  if (tapFirst(p, '[data-act="reopen"]')) return true;

  const mine = ph.activeSeat === v.me.seat;
  const tab = p.win.__rg.ui.tab;

  if (mine && ph.step === 'roll') {
    if (rand() < 0.15 && tab !== 'perks') return tapFirst(p, '[data-tab="perks"]');
    if (tab === 'perks' && rand() < 0.6 && tapFirst(p, '[data-act="playPerk"]')) return true;
    return tapFirst(p, '[data-act="roll"]');
  }

  if (mine && ph.step === 'main') {
    if (tab !== 'build' && rand() < 0.6) return tapFirst(p, '[data-tab="build"]');
    if (tab === 'build') {
      for (const what of ['manor', 'shack', 'path', 'perk']) {
        const b = q(p, `[data-act="build"][data-what="${what}"]`);
        if (enabled(b) && (what !== 'path' || rand() < 0.5) && (what !== 'perk' || rand() < 0.5)) return tap(p, b);
      }
    }
    if (tab === 'trade' && p.win.__rg.ui.tradeSeg === 'bank') {
      const give = qa(p, '[data-act="bankGive"]').filter(enabled);
      if (give.length && !p.win.__rg.ui.bank.give) return tap(p, pick(give));
      const get = qa(p, '[data-act="bankGet"]').filter(enabled);
      if (p.win.__rg.ui.bank.give && !p.win.__rg.ui.bank.get && get.length) return tap(p, pick(get));
      if (tapFirst(p, '[data-act="bankTrade"]')) return true;
    }
    if (rand() < 0.08) { tapFirst(p, '[data-tab="trade"]'); return tapFirst(p, '[data-seg="bank"]'); }
    return tapFirst(p, '[data-act="endTurn"]');
  }

  if (ph.step === 'specialBuild' && ph.specialBuildPending.includes(v.me.seat)) return tapFirst(p, '[data-act="doneSpecialBuild"]');

  // Not my turn: occasionally trade.
  if (ph.stage === 'playing' && rand() < 0.04) {
    if (tab !== 'trade') return tapFirst(p, '[data-tab="trade"]');
    const seg = p.win.__rg.ui.tradeSeg;
    if (seg === 'inbox') {
      if (tapFirst(p, '[data-act="acceptTrade"]') || tapFirst(p, '[data-act="declineTrade"]')) return true;
      return tapFirst(p, '[data-seg="new"]');
    }
    if (seg === 'new') {
      const t = p.win.__rg.ui.trade;
      const giveN = Object.values(t.give).reduce((a, b) => a + b, 0);
      const wantN = Object.values(t.want).reduce((a, b) => a + b, 0);
      if (!giveN) { const g = qa(p, '[data-act="step"][data-side="give"][data-d="1"]').filter(enabled); if (g.length) return tap(p, pick(g)); return tapFirst(p, '[data-seg="inbox"]'); }
      if (!wantN) { const w = qa(p, '[data-act="step"][data-side="want"][data-d="1"]').filter(enabled); if (w.length) return tap(p, pick(w)); }
      return tapFirst(p, '[data-act="sendOffer"]');
    }
    return tapFirst(p, '[data-seg="inbox"]');
  }
  if (tab !== 'play' && rand() < 0.1) return tapFirst(p, '[data-tab="play"]');
  return false;
}

function checkScreen(p) {
  const v = view(p);
  if (!v || !v.me || !['setup', 'playing'].includes(v.phase.stage)) return;
  const shown = qa(p, '#hand .res .n').map(n => Number(n.textContent));
  const real = ['compost', 'fertilizer', 'sprinklers', 'turf', 'gnomeDust'].map(r => v.me.hand[r]);
  assert.deepStrictEqual(shown, real, `${p.label} hand strip does not match its cards`);
}

async function main() {
  const srv = await startServer({ port: 0, quiet: true, tickMs: 250, rate: FAST, rules: 'v1' });
  const base = `http://localhost:${srv.port}`;
  console.log('Phone UI test');

  // The real TV page, in its own headless browser.
  const tvp = await openPhone(`${base}/`, 'tv');
  await waitFor(() => /^[A-Z]{4}$/.test(q(tvp, '#code').textContent.trim()), 'TV to show a room code');
  assert.ok(q(tvp, '#qr').src.startsWith('data:image/png'), 'TV shows a QR code');
  const room = { code: q(tvp, '#code').textContent.trim() };
  const tvView = () => tvp.win.__rgtv.view();
  console.log(`  ✔ TV page opened room ${room.code} with a QR code`);

  const phones = [];
  for (let i = 0; i < 3; i++) {
    const p = await openPhone(`${base}/play?room=${room.code}`, `phone${i}`);
    await waitFor(() => !q(p, '#joinScreen').hidden, `${p.label} join screen`);
    assert.strictEqual(q(p, '#joinCode').value, room.code, 'room code pre-filled from the QR link');
    q(p, '#joinName').value = `Tapper ${i}`;
    tap(p, qa(p, '[data-act="avatar"]')[i + 1]);
    tap(p, q(p, '[data-act="join"]'));
    await waitFor(() => view(p) && view(p).me && !q(p, '#app').hidden, `${p.label} to join`);
    await waitFor(() => !q(p, '#sheetWrap').hidden && q(p, '#sheet').dataset.sheet === 'rules', `${p.label} How to Play on joining`);
    if (i === 1) tap(p, q(p, '[data-act="rulesHide"]')); // this player ticks "Don't show this again"
    tap(p, q(p, '[data-act="closeSheet"]'));
    phones.push(p);
  }
  console.log('  ✔ three phones joined through the join screen, each shown How to Play');
  await waitFor(() => qa(tvp, '#lobbyPlayers .pchip:not(.empty)').length === 3, 'TV lobby to list 3 players');
  console.log('  ✔ TV lobby shows every player as they join');

  const host = phones[0];
  await waitFor(() => view(host).players.length === 3 && enabled(q(host, '[data-act="start"]')), 'host Start button');
  assert.ok(!q(phones[1], '[data-act="start"]'), 'non-host has no Start button');
  tap(host, q(host, '[data-act="start"]'));
  await waitFor(() => phones.every(p => view(p).phase.stage === 'factions'), 'deity draft on every phone');
  console.log('  ✔ host started the game; only the host saw Start');

  let lastProgress = Date.now();
  let lastVersion = tvView().stateVersion;
  let tvChecked = false;
  let taps = 0;
  const seenSheets = new Set();
  const seenSteps = new Set();

  while (view(host).phase.stage !== 'gameOver') {
    for (const p of phones) {
      if (!q(p, '#sheetWrap').hidden) seenSheets.add(q(p, '#sheet').dataset.sheet);
      seenSteps.add(view(p).phase.step);
      if (botStep(p)) { taps++; await sleep(4); }
    }
    phones.forEach(checkScreen);
    if (errors.length) throw new Error('Page error:\n' + errors.join('\n'));
    const tvVersion = tvView().stateVersion;
    if (tvVersion !== lastVersion) { lastVersion = tvVersion; lastProgress = Date.now(); }
    if (!tvChecked && tvView().phase.stage === 'playing') {
      assert.ok(!q(tvp, '#game').hidden, 'TV shows the game screen');
      assert.strictEqual(qa(tvp, '#rows .prow').length, 3, 'TV scoreboard has a row per player');
      assert.ok(q(tvp, '#boardWrap svg') && qa(tvp, '#boardWrap [data-hex]').length === 19, 'TV draws all 19 hexes');
      tvChecked = true;
    }
    if (Date.now() - lastProgress > 8000) {
      const v = view(host);
      throw new Error(`No progress for 8s at ${v.phase.stage}/${v.phase.step}, active seat ${v.phase.activeSeat}`);
    }
    await sleep(3);
  }

  const v = view(host);
  console.log(`  ✔ complete game played by tapping (${taps} taps, ${v.phase.turn} turns)`);
  console.log(`  ✔ screens exercised: ${[...seenSheets].sort().join(', ')}`);
  ['place', 'discard', 'mower'].forEach(sh => assert.ok(seenSheets.has(sh), `the ${sh} sheet was never used`));

  await waitFor(() => phones.every(p => q(p, '#content').textContent.includes('Golden Flamingo')), 'game-over screen');
  assert.ok(q(host, '[data-act="rematch"]'), 'host sees Rematch');
  assert.ok(!q(phones[1], '[data-act="rematch"]'), 'non-host has no Rematch');
  console.log('  ✔ game-over screen on every phone, Rematch for the host only');
  await waitFor(() => !q(tvp, '#over').hidden && q(tvp, '#over').textContent.includes('wins'), 'TV winner screen');
  console.log('  ✔ TV showed the board and scoreboard all game, then the winner screen');

  tap(host, q(host, '[data-act="rematch"]'));
  await waitFor(() => phones.every(p => view(p).phase.stage === 'lobby'), 'rematch lobby');
  console.log('  ✔ rematch returned every phone to the lobby');

  // Reload a phone: it must rejoin by itself from its saved token.
  const store = phones[1].win.localStorage.getItem('ragnagrok.player');
  phones[1].win.close();
  const reopened = await openPhoneWithStorage(base, room.code, store);
  await waitFor(() => view(reopened) && view(reopened).me && view(reopened).me.seat === 1, 'reloaded phone to rejoin seat 2');
  await sleep(300);
  assert.ok(q(reopened, '#sheetWrap').hidden, '"Don\'t show this again" was ignored after a reload');
  console.log('  ✔ "Don\'t show this again" is remembered after a reload');
  console.log('  ✔ a reloaded phone rejoins its own seat with no typing');

  if (errors.length) throw new Error('Page error:\n' + errors.join('\n'));
  tvp.win.close();
  phones.forEach(p => p.win.close());
  reopened.win.close();
  await srv.close();
  srv.server.close();
  console.log('✔ All phone UI checks passed');
  process.exit(0);
}

/* Opens the page with localStorage pre-seeded before any script runs. */
async function openPhoneWithStorage(base, code, stored) {
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => errors.push(`reloaded: ${e.message}`));
  const dom = await JSDOM.fromURL(`${base}/play?room=${code}`, {
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(win) { win.localStorage.setItem('ragnagrok.player', stored); win.localStorage.setItem('ragnagrok.rulesHidden', 'true'); }
  });
  const p = { dom, win: dom.window, doc: dom.window.document, label: 'reloaded' };
  await waitFor(() => p.win.__rg, 'reloaded page');
  return p;
}

main().catch(err => {
  console.error('✘ Phone UI test failed:', err.message);
  if (errors.length) console.error(errors.join('\n'));
  process.exit(1);
});
