'use strict';
/* V2 phone UI test.
   Three copies of the V2 phone page in a headless browser play a complete game
   using only what a person could tap. Fails on any page error.
   Run: node test/ui2.test.js */

const assert = require('assert');
const { JSDOM, VirtualConsole } = require('jsdom');
const { startServer } = require('../server/index');
const { next } = require('../src/engine/rng');

const FAST_RATE = { capacity: 100000, refillPerSec: 100000 };
// Fixed V2 board/disaster seed so a failing browser scenario can be replayed.
const UI_GAME_SEED = 215063;
const FAST_GAME = { omensSec: 0.3, resolveMinSec: 0.3, resolvePerEventSec: 0.02, resolveMaxSec: 1, disastersSec: 0.3, harvestSec: 0.2, showSec: 0.4, draftSec: 20 };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rs = { s: 99 };
const rand = () => next(rs);
const pick = arr => arr[Math.floor(rand() * arr.length)];
const errors = [];
const seen = new Set();

async function waitFor(fn, what, ms = 8000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { if (fn()) return; } catch (e) { /* not ready */ }
    await sleep(10);
  }
  throw new Error('Timed out waiting for ' + what);
}

async function openPhone(url, label) {
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => errors.push(`${label}: ${e.message}`));
  vc.on('error', e => errors.push(`${label} console.error: ${e}`));
  const dom = await JSDOM.fromURL(url, { runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc });
  dom.window.addEventListener('error', e => errors.push(`${label}: ${e.message}`));
  const p = { dom, win: dom.window, doc: dom.window.document, label };
  await waitFor(() => (p.win.__rg || p.win.__rgtv) && p.win.io, `${label} page`);
  return p;
}

const q = (p, s) => p.doc.querySelector(s);
const qa = (p, s) => [...p.doc.querySelectorAll(s)];
const enabled = el => !!el && !el.disabled && !el.closest('[hidden]');
const view = p => p.win.__rg.view();
function tap(p, el) {
  if (!el) return false;
  el.dispatchEvent(new p.win.MouseEvent('click', { bubbles: true, cancelable: true }));
  return true;
}
const tapFirst = (p, sel) => { const el = qa(p, sel).find(enabled); return el ? tap(p, el) : false; };
const tapAny = (p, sel) => { const l = qa(p, sel).filter(enabled); return l.length ? tap(p, pick(l)) : false; };

/* One human-like tap, decided from what this phone shows. */
function botStep(p) {
  const v = view(p);
  if (!v || !v.me) return false;
  if (!q(p, '#sheetWrap').hidden) {
    const type = q(p, '#sheet').dataset.sheet;
    seen.add('sheet:' + type);
    if (type !== 'slot') return tapFirst(p, '[data-act="closeSheet"]');
    const s = p.win.__rg.ui.sheet;
    if (!s.kind) {
      // Prefer real actions; Car-Boot sometimes.
      const opts = qa(p, '[data-act="pickKind"]').filter(enabled).filter(b => !b.querySelector('.why'));
      const real = opts.filter(b => b.dataset.kind !== 'carBoot');
      // Prefer action types not tried yet, so every action gets exercised.
      const fresh = real.filter(b => !seen.has('kind:' + b.dataset.kind));
      const choice = fresh.length ? pick(fresh) : real.length && rand() < 0.75 ? pick(real) : opts.find(b => b.dataset.kind === 'carBoot');
      return tap(p, choice || q(p, '[data-act="pickKind"][data-kind="carBoot"]'));
    }
    seen.add('kind:' + s.kind);
    if (s.kind !== 'carBoot' && !s.targetDone) {
      if (!s.target) return tapAny(p, '#sheet [data-spot]');
      return tapFirst(p, '[data-act="targetOk"]');
    }
    if (s.kind === 'pray' && s.targetDone && !s.to) {
      const destination = qa(p, '#sheet [data-spot]').find(enabled);
      if (destination) return tap(p, destination);
      return tapFirst(p, '[data-act="closeSheet"]');
    }
    if (s.kind === 'meddle' && !s.mode) return tapAny(p, '[data-act="mode"]');
    if (s.kind === 'cultivate' && !s.feature) {
      const ok = qa(p, '[data-act="feature"]').filter(b => !b.querySelector('.why'));
      if (ok.length) return tap(p, pick(ok));
      tapFirst(p, '[data-act="slotBack"]');
      return tapFirst(p, '[data-act="closeSheet"]');
    }
    if (s.kind === 'carBoot' && (s.supplies || []).length < 2) return tapAny(p, '[data-act="cbPick"]');
    return tapFirst(p, '[data-act="saveSlot"]');
  }

  const stage = v.phase.stage;
  if (stage === 'draft') return tapAny(p, '[data-act="pickGod"]');
  if (v.phase.step === 'sympathy' && v.sympathy && v.sympathy.chooser === v.me.seat) {
    seen.add('sympathy');
    return tapFirst(p, '[data-act="sympathyPick"]');
  }
  if (stage !== 'playing' || v.phase.step !== 'plan') return false;
  if (v.players[v.me.seat].locked) return false;
  if (q(p, '[data-act="compostGo"]')) {
    seen.add('compost');
    if (tapFirst(p, '[data-act="compostGo"]')) return true;
    return tapAny(p, '[data-act="compostAdd"]');
  }
  if (q(p, '[data-act="pledgeStep"]') && !v.me.pledge && rand() < 0.7) {
    seen.add('pledge');
    if (tapAny(p, '[data-act="pledgeStep"][data-d="1"]')) return true;
  }
  const emptySlot = qa(p, '[data-act="editSlot"]').find(b => !b.classList.contains('filled'));
  if (emptySlot) return tap(p, emptySlot);
  if (tapFirst(p, '[data-act="lock"]')) { seen.add('lock'); return true; }
  // Lock is disabled and the phone says what's short: react like a person would.
  if (q(p, '#lockShort')) {
    seen.add('lockShort');
    if (tapFirst(p, '[data-act="pledgeStep"][data-d="-1"]')) return true;
    const bad = qa(p, '[data-act="editSlot"].bad').find(enabled);
    const clear = bad ? q(p, `[data-act="clearSlot"][data-i="${bad.dataset.i}"]`) : q(p, '[data-act="clearSlot"]');
    return tap(p, clear);
  }
  return false;
}

async function main() {
  const srv = await startServer({ port: 0, quiet: true, tickMs: 50, rate: FAST_RATE, rules: 'v2', gameConfig: FAST_GAME, gameSeed: UI_GAME_SEED });
  const base = `http://localhost:${srv.port}`;
  console.log(`V2 phone UI test (game seed ${UI_GAME_SEED}, action seed 99)`);

  // The real V2 TV page in its own headless browser.
  const tvp = await openPhone(`${base}/`, 'tv');
  await waitFor(() => /^[A-Z]{4}$/.test(q(tvp, '#code').textContent.trim()), 'TV room code');
  assert.ok(q(tvp, '#qr').src.startsWith('data:image/png'), 'TV shows a QR code');
  const room = { code: q(tvp, '#code').textContent.trim() };
  let tvView = null;
  const tvPoll = setInterval(() => { tvView = tvp.win.__rgtv.view(); }, 20);
  const tvSaw = new Set();
  const tvWatch = setInterval(() => {
    const v = tvp.win.__rgtv.view();
    if (!v) return;
    tvSaw.add(v.phase.stage + ':' + (v.phase.step || ''));
    if (v.phase.step === 'resolve' && q(tvp, '#panel .ev')) tvSaw.add('theatre');
    if (v.phase.stage === 'playing' && qa(tvp, '#meter .seg').length) tvSaw.add('meter');
    if (v.phase.step === 'show' && q(tvp, '#panel').textContent.includes('Village Garden Show')) tvSaw.add('showPanel');
  }, 25);
  console.log(`  ✔ V2 TV opened room ${room.code} with a QR code`);

  const phones = [];
  for (let i = 0; i < 3; i++) {
    const p = await openPhone(`${base}/play?room=${room.code}`, `phone${i}`);
    await waitFor(() => !q(p, '#joinScreen').hidden, `${p.label} join screen`);
    q(p, '#joinName').value = `Gardener ${i}`;
    tap(p, q(p, '[data-act="join"]'));
    await waitFor(() => !q(p, '#app').hidden, `${p.label} to join`);
    await waitFor(() => q(p, '#sheet').dataset.sheet === 'rules' && !q(p, '#sheetWrap').hidden, `${p.label} How to Play`);
    tap(p, q(p, '[data-act="closeSheet"]'));
    phones.push(p);
  }
  console.log('  ✔ three phones joined and saw the V2 How to Play');

  const host = phones[0];
  await waitFor(() => qa(host, '[data-act="length"]').length === 3, 'game length options');
  assert.strictEqual(qa(phones[1], '[data-act="length"]').length, 0, 'only the host sees length options');
  assert.strictEqual(view(host).config.length, 'standard', 'Standard is the party-game default');
  tap(host, q(host, '[data-act="length"][data-len="long"]'));
  await waitFor(() => phones.every(p => view(p).config.length === 'long'), 'Extended chosen on every phone');
  tap(host, q(host, '[data-act="length"][data-len="standard"]'));
  await waitFor(() => phones.every(p => view(p).config.length === 'standard'), 'Standard chosen on every phone');
  console.log('  ✔ Standard is default; host can select Extended and switch back');

  tap(host, q(host, '[data-act="start"]'));
  await waitFor(() => phones.every(p => view(p).phase.stage === 'draft'), 'god draft');

  let lastVersion = -1;
  let lastProgress = Date.now();
  let taps = 0;
  while (!tvView || tvView.phase.stage !== 'gameOver') {
    for (const p of phones) { if (botStep(p)) { taps++; await sleep(3); } }
    if (errors.length) throw new Error('Page error:\n' + errors.join('\n'));
    if (tvView && tvView.stateVersion !== lastVersion) { lastVersion = tvView.stateVersion; lastProgress = Date.now(); }
    if (Date.now() - lastProgress > 10000) {
      const v = view(host);
      const diagnostics = phones.map(p => {
        const state = view(p);
        const sheet = p.win.__rg.ui.sheet;
        const summary = {
          phone: p.label, step: state?.phase.step,
          round: state?.round, locked: state?.players[state?.me?.seat]?.locked,
          slots: (state?.me?.plan || []).map(a => a ? a.kind : null),
          owed: state?.me?.compostOwed,
          pane: p.win.__rg.ui.tab,
          sheet: sheet && { kind: sheet.kind, target: sheet.target, targetDone: sheet.targetDone, to: sheet.to },
          available: qa(p, '[data-act]').filter(enabled).slice(0, 12).map(e => e.dataset.act),
          short: !!q(p, '#lockShort'), errors: errors.slice(-2)
        };
        return summary;
      });
      throw new Error(`No progress for 10 s at ${v.phase.stage}/${v.phase.step}, round ${v.round}: ${JSON.stringify(diagnostics)}`);
    }
    if (tvView && tvView.phase.step === 'plan') {
      const v = view(host);
      if (v.me && v.phase.step === 'plan') assert.strictEqual(qa(host, '.slots [data-act="editSlot"]').length, v.me.slots, 'one slot per action');
    }
    await sleep(4);
  }
  console.log(`  ✔ complete Standard game played by tapping (${taps} taps, ${tvView.round} rounds)`);
  console.log(`  ✔ used: ${[...seen].sort().join(', ')}`);
  ['kind:claim', 'kind:cultivate', 'kind:tend', 'lock', 'pledge'].forEach(k => assert.ok(seen.has(k), `never used ${k}`));

  await waitFor(() => phones.every(p => q(p, '#content').textContent.includes('Golden Flamingo')), 'game-over screen');
  assert.ok(q(host, '[data-act="rematch"]'), 'host can rematch');
  assert.ok(!q(phones[1], '[data-act="rematch"]'), 'only the host can rematch');
  console.log('  ✔ final scores and the Golden Flamingo on every phone');
  await waitFor(() => !q(tvp, '#over').hidden && q(tvp, '#over').textContent.includes('win'), 'TV finale');
  clearInterval(tvWatch); clearInterval(tvPoll);
  ['lobby:', 'draft:draft', 'playing:omens', 'playing:plan', 'playing:resolve', 'playing:disasters', 'playing:harvest', 'playing:show', 'theatre', 'meter', 'showPanel'].forEach(k => assert.ok(tvSaw.has(k), 'TV never showed ' + k));
  assert.strictEqual(qa(tvp, '#over tr').length, 1 + 3, 'TV final table has a row per player');
  console.log('  ✔ TV showed every phase: Meter, omens, planning, resolution theatre, disasters, harvest, shows, finale');

  if (errors.length) throw new Error('Page error:\n' + errors.join('\n'));
  tvp.win.close();
  phones.forEach(p => p.win.close());
  await srv.close();
  srv.server.close();
  console.log('✔ All V2 phone UI checks passed');
  process.exit(0);
}

main().catch(err => {
  console.error('✘ V2 phone UI test failed:', err.message);
  if (errors.length) console.error(errors.slice(0, 5).join('\n'));
  process.exit(1);
});
