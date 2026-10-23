'use strict';
/* Regression: private pledge values MUST stay sealed before settlement.
 * An aggregate is not private in a two-player game (total - your amount).
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const E = require('../src/engine/garden');
const GODS = Object.keys(E.CONTENT.gods);
function makeGame(n) {
  const state = E.createGame({seed: 120 + n, now: 1_700_000_000_000});
  for(let seat=0; seat<n;seat++) E.addPlayer(state,{name:`Gardener ${seat}`},state.updatedAt);
  assert.equal(E.apply(state,0,{type:'start'},state.updatedAt).ok,true);
  while(state.phase.stage==='draft') {
    const seat=state.phase.draftQueue[0];
    assert.equal(E.apply(state,seat,{type:'chooseGod',god:GODS[seat]},state.updatedAt).ok,true);
  }
  E.advance(state);
  assert.equal(state.phase.step,'plan');
  state.emergency={key:'hosepipeBan',name:'The Great Hosepipe Ban',act:1,target:n*2,
    fail:{kind:'loseSupplies',count:2},result:null,total:null,paid:null};
  state.secrets.pledges={};
  return state;
}
for (let n=2;n<=8;n++) {
  const s=makeGame(n);
  const expectedPublic=JSON.stringify(E.publicView(s));
  const otherView=JSON.stringify(E.privateView(s,0));
  assert.equal(E.publicView(s).emergency.target,n*2,'public target remains visible');
  for(const [seat,supplies] of [[1,{turf:1}],[1,{turf:3}],[n-1,{compost:2}]]) {
    s.secrets.pledges[seat]=supplies;
    const pub=E.publicView(s),mine=E.privateView(s,0);
    assert.equal(JSON.stringify(pub),expectedPublic,`public state leaks pledge in ${n}-player room`);
    assert.equal(JSON.stringify(mine),otherView,`opponent pledge leaked to player 0 in ${n}-player room`);
    assert.equal(Object.hasOwn(pub.emergency,'pledged'),false);
    assert.equal(pub.emergency.paid,null,'paid only available after resolution');
  }
  s.secrets.pledges[0]={gnomeDust:1};
  assert.deepEqual(E.privateView(s,0).me.pledge,{gnomeDust:1},'player retains access to own pledge');
  assert.equal(E.publicView(s).emergency.pledged,undefined);
  s.emergency.result='success';s.emergency.total=9;s.emergency.paid={0:1,1:2};
  assert.equal(E.publicView(s).emergency.total,9,'resolved total is public');
  assert.deepEqual(E.publicView(s).emergency.paid,{0:1,1:2},'resolved contributions are public');
  console.log(`  ✔ ${n} players: no pre-resolution total, own pledge private, post-resolution reveal`);
}
const tv=fs.readFileSync(path.join(__dirname,'../public/v2/index.html'),'utf8');
assert.doesNotMatch(tv,/emergency\.pledged/,'TV must not reference private group totals');
assert.match(tv,/Pledges stay secret until the reveal/);
console.log('✔ All emergency privacy and TV copy checks passed');
