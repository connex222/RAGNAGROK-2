'use strict';
/* Regression: Car-Boot resources settle after all other actions, not before. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../public/v2/play.html'),'utf8');
function section(start,end) {
  const a=html.indexOf(start),b=html.indexOf(end,a+start.length);
  assert.ok(a>=0&&b>a,'Missing phone script section: '+start);
  return html.slice(a,b);
}
const ctx={
  SUP:['turf','gnomeDust'],SUP_NAME:{turf:'Turf',gnomeDust:'Gnome Dust'},
  ORDER:['meddle','cultivate','carBoot'],
  ACT:{
    meddle:{icon:'🥾',name:'Meddle',target:'rival plot',what:'Sabotage a neighbour'},
    cultivate:{icon:'🌹',name:'Cultivate',target:'owned plot',what:'Build features'},
    carBoot:{icon:'🛒',name:'Car-Boot Sale',target:'none',what:'Collect supplies'}
  },
  C:{features:{roseArch:{cost:{gnomeDust:2}}}},
  hand:{turf:0,gnomeDust:0},
  slots:[{kind:'carBoot',supplies:['gnomeDust','gnomeDust']},null],
  empty:()=>({turf:0,gnomeDust:0}),
  hasAll:(hand,cost)=>Object.keys(cost||{}).every(r=>hand[r]>=cost[r]),
  costOf:slot=>slot.kind==='meddle'?{gnomeDust:1}:{},
  legalTargets:()=>['plot-1'],
  esc:String,chips:JSON.stringify,
  closeBtn:'<button>Close</button>'
};
ctx.me=()=>({hand:ctx.hand});
ctx.draftSlots=()=>ctx.slots;
vm.createContext(ctx);
vm.runInContext(section('function projection(','function legalTargets(')+
  section('function sheetSlot(','function sheetRules('),ctx);
const options=()=>ctx.sheetSlot({idx:1,kind:null});
const button=(markup,kind)=>markup.match(new RegExp('<button[^>]*data-kind="'+kind+'"[^>]*>'))?.[0];
const initial=options();
assert.ok(button(initial,'meddle')?.includes('disabled'),'Meddle cannot spend future Car-Boot income');
assert.ok(button(initial,'cultivate')?.includes('disabled'),'Cultivate cannot spend future Car-Boot income');
assert.ok(!button(initial,'carBoot')?.includes('disabled'),'Free Car-Boot remains selectable');
assert.match(initial,/Car-Boot supplies only arrive after every other action/);
assert.match(initial,/role="note">Need 1 more Gnome Dust/);
assert.equal(ctx.projection(ctx.slots).hand.gnomeDust,2,'end-of-round total includes receipts');
assert.equal(ctx.projection(ctx.slots,undefined,{carBoot:false}).hand.gnomeDust,0,'pre-action total excludes receipts');
ctx.hand.gnomeDust=1;
assert.ok(!button(options(),'meddle')?.includes('disabled'),'Funded Meddle remains available');
assert.ok(button(options(),'cultivate')?.includes('disabled'),'Expensive feature remains unaffordable');
ctx.hand.gnomeDust=2;
assert.ok(!button(options(),'cultivate')?.includes('disabled'),'Funded Cultivate remains available');
for(const script of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi))
  new vm.Script(script[1],{filename:'play.html'});
console.log('✔ Phase 10 live picker affordability, Car-Boot sequencing, explanations and alternatives');
