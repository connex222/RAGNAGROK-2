'use strict';
const assert = require('node:assert/strict');
const E = require('../src/engine/garden');
const { getTopology } = require('../src/engine/topology');
const C = E.CONTENT;
let passed = 0;
function test(name, fn) { fn(); console.log('  ✔ ' + name); passed++; }
function ok(reply) { assert.equal(reply.ok, true, reply.error); }
function game(gods=['thor','freya']) {
 const s=E.createGame({ seed:790123, now:1000 });
 gods.forEach((g,i)=> E.addPlayer(s,{name:'Gardener '+i},1000));
 ok(E.apply(s,0,{type:'start'},1000));
 while(s.phase.stage==='draft') {
  const seat=s.phase.draftQueue[0];ok(E.apply(s,seat,{type:'chooseGod',god:gods[seat]},1000));
 }
 E.advance(s);
 s.players.forEach(p=>p.hand={turf:8,fertiliser:8,sprinklers:8,compost:8,gnomeDust:8});
 return s;
}
const boot={kind:'carBoot',supplies:['turf','compost']};
function plan(s,seat,slot) {ok(E.apply(s,seat,{type:'plan',slots:[slot,boot]},s.updatedAt));}
function finishPlans(s) {for(const p of s.players)if(s.phase.step==='plan'&&!p.locked)ok(E.apply(s,p.seat,{type:'lock'},s.updatedAt));}
function forecast(s, source, good=false) { s.forecast.now=[{key:good?'yggdrasil':'hail',name:good?'Yggdrasil Stirs':'Hail of Frost Giants',good,health:good?1:-1,condition:good?'blessed':null,target:{kind:'random'},plots:[source]}]; }
function centre(s){return getTopology(s.board.layoutId).hexes.find(h=>h.q===0&&h.r===0).id;}
const plot=(s,id)=>s.board.plots[s.board.index[id]];
console.log('RAGNAGROK 1.2 party rules regression tests');
test('Three conditions, six features, no invisible bonuses, standard opening supplies',()=>{
 assert.deepEqual(Object.keys(C.conditions),['blighted','ash','blessed']);
 assert.equal(Object.keys(C.features).length,6);
 assert.equal(C.defaultLength,'standard');
 assert.equal(C.lengths.long.name,'Extended');
 const s=game(); assert.deepEqual(s.players[0].hand,{turf:8,fertiliser:8,sprinklers:8,compost:8,gnomeDust:8});
 assert.deepEqual(C.startingSupplies,{turf:2,fertiliser:2,sprinklers:1,compost:2,gnomeDust:2});
 assert.ok(Object.values(C.features).some(f=>Object.keys(f.cost).every(r=>C.startingSupplies[r]>=f.cost[r])));
 assert.equal(E.gardenDesignBonus(s,0),0);
 assert.equal(s.trades,undefined);
});
test('Pray moves a forecast hit, costs Dust, and Shelter protects the destination',()=>{
 const s=game(); const c=centre(s),n=getTopology(s.board.layoutId).hexById[c].neighbors[0];
 plot(s,n).owner=1;
 forecast(s,c);
 plan(s,0,{kind:'pray',index:0,target:c,to:n});
 plan(s,1,{kind:'shelter',target:n});
 finishPlans(s);
 const e=s.resolution.events.find(e=>e.kind==='pray');
 assert.equal(e.ok,true);
 assert.equal(e.from,c);assert.equal(e.to,n);
 assert.deepEqual(s.forecast.now[0].plots,[n]);
 assert.equal(s.players[0].hand.gnomeDust,7);
 E.advance(s);assert.equal(plot(s,n).health,2);assert.equal(plot(s,c).health,2);
});
test('Two ordinary Prays targeting one forecast hit both fail and both pay',()=>{
 const s=game();const c=centre(s),[a,b]=getTopology(s.board.layoutId).hexById[c].neighbors;
 forecast(s,c);
 plan(s,0,{kind:'pray',index:0,target:c,to:a});plan(s,1,{kind:'pray',index:0,target:c,to:b});finishPlans(s);
 const es=s.resolution.events.filter(e=>e.kind==='pray');
 assert.equal(es.length,2);assert.ok(es.every(e=>!e.ok&&/conflict/.test(e.reason)));
 assert.equal(s.players[0].hand.gnomeDust,7);assert.equal(s.players[1].hand.gnomeDust,7);
 assert.deepEqual(s.forecast.now[0].plots,[c]);
});
test('Loki can redirect two plots, ordinary gods cannot',()=>{
 const s=game(['thor','loki']);const topo=getTopology(s.board.layoutId);const c=centre(s);
 const neighbour=topo.hexById[c].neighbors[0];
 const far=topo.hexById[neighbour].neighbors.find(id=>!topo.hexById[c].neighbors.includes(id)&&id!==c);
 forecast(s,c);
 const slot={kind:'pray',index:0,target:c,to:far};
 assert.equal(E.apply(s,0,{type:'plan',slots:[slot,boot]},s.updatedAt).ok,false);
 plan(s,0,boot);plan(s,1,slot);finishPlans(s);
 assert.equal(s.resolution.events.find(e=>e.kind==='pray').ok,true);
 assert.deepEqual(s.forecast.now[0].plots,[far]);
});
test('Heimdall cannot receive a redirected hit',()=>{
 const s=game(['heimdall','loki']);const c=centre(s),n=getTopology(s.board.layoutId).hexById[c].neighbors[0];
 plot(s,n).owner=0;forecast(s,c);
 assert.equal(E.apply(s,1,{type:'plan',slots:[{kind:'pray',index:0,target:c,to:n},boot]},s.updatedAt).ok,false);
});
test('Pray can redirect a blessing too',()=>{
 const s=game();const c=centre(s),n=getTopology(s.board.layoutId).hexById[c].neighbors[0];
 forecast(s,c,true);plan(s,0,{kind:'pray',index:0,target:c,to:n});plan(s,1,boot);finishPlans(s);E.advance(s);
 assert.equal(plot(s,n).health,3);assert.equal(plot(s,n).condition,'blessed');
 assert.equal(plot(s,c).health,2);
});
test('Invalid destination and duplicate category do not mutate game state',()=>{
 const s=game();const c=centre(s);forecast(s,c);
 const before=JSON.stringify(s);
 assert.equal(E.apply(s,0,{type:'plan',slots:[{kind:'pray',index:0,target:c,to:'not-a-plot'},boot]},s.updatedAt).ok,false);
 assert.equal(JSON.stringify(s),before);
});
test('Sympathy Vote is a timed, seeded, last-place-only category choice',()=>{
 const s=game();let n=0;
 while(s.phase.step!=='show'&&n++<70)E.advance(s);
 assert.equal(s.phase.step,'show');
 E.advance(s);
 assert.equal(s.phase.step,'sympathy');assert.equal(s.sympathy.options.length,3);
 const seat=s.sympathy.chooser;
 assert.equal(E.apply(s,1-seat,{type:'sympathyPick',category:s.sympathy.options[0]},s.updatedAt).ok,false);
 const key=s.sympathy.options[1];
 ok(E.apply(s,seat,{type:'sympathyPick',category:key},s.updatedAt));
 assert.equal(s.phase.step,'omens');assert.ok(s.shows[1].categories.includes(key));
 assert.equal(new Set(s.shows[1].categories).size,s.shows[1].categories.length);
});
test('Sympathy timeout picks first seeded option and awards no bonus score',()=>{
 const s=game();let n=0;while(s.phase.step!=='show'&&n++<75) E.advance(s);
 E.advance(s);const first=s.sympathy.options[0],before=s.players.map(p=>p.showPoints);
 E.advance(s);assert.ok(s.shows[1].categories.includes(first));
 assert.deepEqual(s.players.map(p=>p.showPoints),before);
});
test('Pilfer uses the target terrain first and otherwise their most plentiful supply',()=>{
 const s=game(['thor','freya']);const c=centre(s),n=getTopology(s.board.layoutId).hexById[c].neighbors[0];
 plot(s,c).owner=1;plot(s,c).terrain='turf';plot(s,n).owner=0;
 s.players[1].hand={turf:0,fertiliser:3,sprinklers:1,compost:1,gnomeDust:0};
 plan(s,0,{kind:'meddle',target:c,mode:'pilfer'});plan(s,1,boot);finishPlans(s);
 const ev=s.resolution.events.find(e=>e.kind==='meddle');
 assert.equal(ev.ok,true);assert.equal(ev.took,'fertiliser');
 assert.equal(s.players[0].hand.fertiliser,9);
 assert.equal(s.players[1].hand.fertiliser,2);
 assert.equal(s.players[1].hand.turf,2,'only a later Car-Boot Sale added turf');
});
test('Pilfer prioritises terrain supply over a larger alternate holding',()=>{
 const s=game(['thor','freya']);const c=centre(s),n=getTopology(s.board.layoutId).hexById[c].neighbors[0];
 plot(s,c).owner=1;plot(s,c).terrain='sprinklers';plot(s,n).owner=0;
 s.players[1].hand={turf:6,fertiliser:0,sprinklers:1,compost:0,gnomeDust:0};
 plan(s,0,{kind:'meddle',target:c,mode:'pilfer'});plan(s,1,boot);finishPlans(s);
 assert.equal(s.resolution.events.find(e=>e.kind==='meddle').took,'sprinklers');
 assert.equal(s.players[0].hand.sprinklers,9);
 assert.equal(s.players[1].hand.sprinklers,0);
});
test('No zero-Goodwill honorary winner',()=>{
 const s=game();const scores=s.players.map(p=>E.scoreOf(s,p.seat));
 assert.ok(!E.gardenHonours(s,scores).some(h=>h.key==='neighbour'));
});
console.log('✔ '+passed+' RAGNAGROK party rules passed');
