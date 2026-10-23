'use strict';
/* First-session guidance and accessibility contracts: no new dependencies. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const phone = fs.readFileSync(path.join(root, 'public/v2/play.html'), 'utf8');
const uiTest = fs.readFileSync(path.join(root, 'test/ui2.test.js'), 'utf8');
const config = require('../src/data/v2.json');
let passed = 0;
const check = (title, fn) => { fn(); passed++; console.log('  ✔ ' + title); };
const start = phone.indexOf('function firstMoveCoach(slots) {');
const end = phone.indexOf('/* Current Show race', start);
assert.ok(start > 0 && end > start, 'first-move guide functions exist');
function fixture({ feature = true, claim = true, tend = false, supplies = config.startingSupplies, round = 1, filled = false, tips = true } = {}) {
  const c = {
    view: { round }, prefs: { tips }, C: config,
    ACT: { claim: { name: 'Claim' }, cultivate: { name: 'Cultivate' }, tend: { name: 'Tend' }, carBoot: { name: 'Car-Boot Sale' } },
    me: () => ({ legal: {} }),
    projection: () => ({ hand: supplies }),
    legalTargets: k => k === 'cultivate' && feature || k === 'claim' && claim || k === 'tend' && tend ? ['plot'] : [],
    hasAll: (hand, cost) => Object.entries(cost || {}).every(([res, qty]) => (hand[res] || 0) >= qty),
    costOf: () => ({ turf: 1 }),
    planning: () => true, locked: () => false,
    myPlots: () => [], threatsNow: () => new Set(), sup: () => '🌿',
    esc: value => String(value).replace(/[&<>"']/g, s => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[s]))
  };
  vm.createContext(c);
  vm.runInContext(phone.slice(start, end) + ';this.coach=firstMoveCoach;this.tips=renderTips', c);
  return { ...c, result: c.coach(filled ? [{ kind: 'claim' }] : [null]), markup: c.tips(filled ? [{ kind: 'claim' }] : [null]) };
}
console.log('Phase 5 first-session and accessible planning contracts');
check('First-round coach suggests an affordable Cultivate with legal targets', () => {
  const f = fixture();
  assert.equal(f.result.kind, 'cultivate');
  assert.match(f.markup, /data-act="coachPlan" data-kind="cultivate"/);
  assert.match(f.markup, /You can always choose a different action/);
});
check('When building is blocked, only the legal affordable Claim is recommended', () => {
  assert.equal(fixture({ feature: false }).result.kind, 'claim');
  assert.equal(fixture({ supplies: {}, feature: true, claim: true }).result.kind, 'carBoot');
});
check('The coach cannot advertise blocked or missing targets', () => {
  assert.equal(fixture({ feature: false, claim: false, tend: true }).result.kind, 'tend');
  assert.equal(fixture({ feature: false, claim: false, tend: false }).result.kind, 'carBoot');
});
check('First-round shortcut disappears once a player has planned or chosen hide tips', () => {
  assert.equal(fixture({ filled: true }).result, null);
  assert.doesNotMatch(fixture({ filled: true }).markup, /data-act="coachPlan"/);
  assert.equal(fixture({ round: 2 }).result, null);
  assert.equal(fixture({ tips: false }).markup, '');
});
check('Guide opens a real action picker without making a server command automatically', () => {
  assert.match(phone, /case 'coachPlan':[\s\S]*?ui\.sheet = \{ type: 'slot', idx, kind: d\.kind/);
  assert.match(phone, /case 'coachPlan':[\s\S]*?if \(idx < 0 \|\| !planning\(\) \|\| locked\(\)/);
  assert.match(phone, /aria-label="How to play"/);
});
check('Dialog keyboard trap and live announcements are installed', () => {
  assert.match(phone, /id="phaseAnnouncement"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(phone, /function announcePhase\(v\)/);
  assert.match(phone, /if \(before !== now\) \{ onStepChange\(\); announcePhase\(v\); \}/);
  assert.match(phone, /if \(e\.key !== 'Tab'\) return/);
  assert.match(phone, /e\.shiftKey[\s\S]*last\.focus\(\)/);
  assert.match(phone, /prefers-reduced-motion: reduce/);
});
check('Actual Socket.io UI test tracks the new default and handles sympathy and Pray', () => {
  assert.match(uiTest, /Standard is the party-game default/);
  assert.match(uiTest, /stage === 'draft'/);
  assert.match(uiTest, /v\.phase\.step === 'sympathy'/);
  assert.match(uiTest, /s\.kind === 'pray' && s\.targetDone && !s\.to/);
  assert.doesNotMatch(uiTest, /'Long is the default'/);
});
check('TV and phone scripts parse after the Phase 5 UI changes', () => {
  for (const file of ['index.html', 'play.html']) {
    const html = fs.readFileSync(path.join(root, 'public/v2', file), 'utf8');
    const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m => m[1]);
    assert.ok(scripts.length);
    scripts.forEach(s => new vm.Script(s, { filename: file }));
  }
});
console.log(`✔ All ${passed} Phase 5 contracts passed`);
