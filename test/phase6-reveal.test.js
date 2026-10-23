'use strict';
/* Dependency-free regression for public-TV phase transitions and animations.
   The previous bug was not in engine rules: the TV renderer memoised a board
   across theatre-frame changes and could silently skip a new Pray marker. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'public/v2/index.html'), 'utf8');
const board = fs.readFileSync(path.join(root, 'public/board.js'), 'utf8');
function check(name, run) { run(); console.log('  ✔ ' + name); }
console.log('Phase 6 public-TV reveal and reduced-motion checks');

check('Board redraws at each distinct revealed action even with unchanged stateVersion', () => {
  const begin = page.indexOf('function renderBoard() {');
  const end = page.indexOf('function evLine(e, fresh)', begin);
  assert.ok(begin > 0 && end > begin);
  const panel = { innerHTML: '' };
  const received = [];
  const v = { stateVersion: 40, phase: { step: 'resolve' }, board: { plots: [] },
    forecast: { now: [] }, players: [], resolution: { events: [
      { kind: 'claim', ok: true },
      { kind: 'pray', ok: true, from: 'h1', to: 'h2' },
      { kind: 'pray', ok: true, from: 'h3', to: 'h4' }
    ] } };
  const context = {
    view: v, topo: { hexes: [] }, theatre: { shown: 1 }, ART: {}, lastBoardKey: '',
    focusPlot: () => '', $: () => panel,
    window: { matchMedia: () => ({ matches: true }) },
    RagnaBoard: { gardenSvg: opts => { received.push(opts); return `<div>${opts.prayEffect?.to || 'none'}</div>`; } }
  };
  vm.createContext(context);
  vm.runInContext(page.slice(begin, end) + ';this.redraw=renderBoard;', context);
  context.redraw();
  context.redraw();
  assert.equal(received.length, 1, 'same frame uses cache');
  context.theatre.shown = 2;
  context.redraw();
  assert.equal(received.length, 2, 'next revealed action triggers redraw');
  assert.equal(received.at(-1).prayEffect.to, 'h2');
  assert.equal(received.at(-1).reducedMotion, true);
  context.theatre.shown = 3;
  context.redraw();
  assert.equal(received.at(-1).prayEffect.to, 'h4');
  context.view.phase.step = 'disasters';
  context.redraw();
  assert.equal(received.at(-1).prayEffect, null, 'redirection marker disappears after resolution');
});

check('Pray marker settles at the destination when reduced motion is requested', () => {
  const context = {};
  vm.runInNewContext(board, context);
  const topo = { hexes: [{ id: 'h1', x: 0, y: 0 }, { id: 'h2', x: 1, y: 0 }], vertices: [] };
  const plots = ['h1', 'h2'].map(id => ({ id, owner: null, health: 3, terrain: 'turf' }));
  const args = { topo, plots, prayEffect: { from: 'h1', to: 'h2' }, art: {} };
  const animated = context.RagnaBoard.gardenSvg(args);
  assert.match(animated, /<animateMotion/);
  const still = context.RagnaBoard.gardenSvg({ ...args, reducedMotion: true });
  assert.doesNotMatch(still, /<animateMotion/);
  assert.match(still, /cx="1\.000" cy="0\.000" r="\.27"/);
});

check('TV public Sympathy presentation does not require private category options', () => {
  const begin = page.indexOf('function renderPanel() {');
  const end = page.indexOf('/* How many of this round', begin);
  assert.ok(begin > 0 && end > begin);
  const panel = { innerHTML: '' };
  const context = { view: { phase: { step: 'sympathy' }, sympathy: { chooser: 1 }, players: [{ name: 'Alex' }, { name: 'Bea' }] },
    $: () => panel, nm: seat => ['Alex', 'Bea'][seat] };
  vm.createContext(context);
  vm.runInContext(page.slice(begin, end) + ';this.draw=renderPanel;', context);
  context.draw();
  assert.match(panel.innerHTML, /Bea/);
  assert.match(panel.innerHTML, /Awaiting the judges/);
  assert.doesNotMatch(panel.innerHTML, /undefined|Golden Gazebo|<button/);
});

check('Both TV and phone inline scripts retain valid syntax after optimisations', () => {
  for (const file of ['index.html', 'play.html']) {
    const html = fs.readFileSync(path.join(root, 'public/v2', file), 'utf8');
    const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
    assert.ok(scripts.length);
    for (const m of scripts) new vm.Script(m[1], { filename: file });
  }
});
console.log('✔ Phase 6 tests passed');
