'use strict';
/* Regression for a real first-time-player trap: Car-Boot income arrives after
 * every other action, so it must never enable unaffordable action picks. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '../public/v2/play.html'), 'utf8');
function section(start, end) {
  const a = html.indexOf(start), b = html.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `Cannot locate ${start}`);
  return html.slice(a, b);
}
const ctx = {
  SUP: ['turf', 'gnomeDust'], SUP_NAME: {turf: 'Turf', gnomeDust: 'Gnome Dust'},
  ORDER: ['meddle', 'cultivate', 'carBoot'],
  ACT: {
    meddle: {icon:'🥾', name:'Meddle', target:'rival plot', what:'Sabotage a neighbour'},
    cultivate: {icon:'🌹', name:'Cultivate', target:'owned plot', what:'Build garden features'},
    carBoot: {icon:'🛒', name:'Car-Boot Sale', target:'none', what:'Collect resources'},
  },
  C: {features: {roseArch: {cost: {gnomeDust:2}}}},
  hand: {turf: 0, gnomeDust: 0},
  slots: [{kind:'carBoot', supplies:['gnomeDust','gnomeDust']}, null],
  me: () => ({hand:ctx.hand}),
  empty: () => ({turf:0, gnomeDust:0}),
  hasAll: (hand,cost) => Object.keys(cost||{}).every(r => hand[r]>=cost[r]),
  costOf: slot => slot.kind==='meddle' ? {gnomeDust:1} : {},
  draftSlots: () => ctx.slots,
  legalTargets: kind => kind==='carBoot' ? [1]: ['rival-plot'],
  esc: s => String(s), chips: c => JSON.stringify(c),
  closeBtn:'<button>Close</button>',
};
// In the browser, functions/lexical bindings live in one global script scope.
vm.createContext(ctx);
vm.runInContext(section('function projection(', 'function legalTargets(')
  + section('function sheetSlot(', 'function sheetRules('), ctx);
const opts = () => ctx.sheetSlot({idx:1,kind:null});
const button = (source,kind) => source.match(new RegExp(`<button[^>]*data-kind="${kind}"[^>]*>`))?.[0];
const initial = opts();
assert.ok(button(initial,'meddle')?.includes('disabled'), 'unpaid Meddle must not be selectable');
assert.ok(button(initial,'cultivate')?.includes('disabled'), 'unpaid Cultivate must not be selectable');
assert.ok(!button(initial,'carBoot')?.includes('disabled'), 'free Car-Boot must remain available');
assert.match(initial,/Car-Boot supplies only arrive after every other action/);
assert.match(initial,/role="note">Need 1 more Gnome Dust/);
assert.ok(ctx.projection(ctx.slots).hand.gnomeDust === 2, 'post-resolution balance includes Car-Boot income');
assert.ok(ctx.projection(ctx.slots,undefined,{carBoot:false}).hand.gnomeDust === 0,
 'spendable pre-action balance excludes Car-Boot income');
ctx.hand.gnomeDust=1;
const affordable=opts();
assert.ok(!button(affordable,'meddle')?.includes('disabled'), 'affordable Meddle should be available');
assert.ok(button(affordable,'cultivate')?.includes('disabled'), 'feature costing two remains unaffordable');
ctx.hand.gnomeDust=2;
assert.ok(!button(opts(),'cultivate')?.includes('disabled'), 'funded Cultivate should be available');
for (const script of [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)])
  new vm.Script(script[1], {filename:'play.html'});
console.log('✔ Phase 10 action picker: never spend future Car-Boot receipts, explains costs and preserves affordable choices');
