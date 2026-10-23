'use strict';
/* Counterfactual calibration diagnostic; NEVER changes production configuration.
   WARNING: Robot win/loss and garden damage, not real human enjoyment.
   Usage: node test/phase11-emergency-sensitivity.js 7
   N must be a multiple of 7 (each player count 2–8 is represented).
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const E=require('../src/engine/garden');
const {playGame}=require('./sim2');
const games=Number(process.argv[2]||7);
assert.ok(Number.isInteger(games)&&games>=7&&games<=140&&games%7===0,
  'Samples must be a multiple of 7, between 7 and 140');
const profiles=['gardener','baron','chaser','menace'];
const factors=[1,1.15,1.3];
const modes=['standard','long','epic'];
const baseline=Object.fromEntries(Object.entries(E.CONTENT.emergencies).map(([k,v])=>[k,v.perPlayer]));
const out=[];
try {
  for(const factor of factors) {
    // Test process only. Do not modify v2.json or game rules.
    for(const [k,v] of Object.entries(baseline)) E.CONTENT.emergencies[k].perPlayer=+(v*factor).toFixed(4);
    for(const mode of modes) {
      let win=0,events=0,ruined=0,owned=0,zero=0,players=0,actions=0,fizzled=0;
      let impacts=[],successByAct=Array.from({length:3},()=>({success:0,events:0}));
      for(let k=0;k<games;k++) {
        const seats=2+k%7;
        const strategies=Array.from({length:seats},(_,seat)=>profiles[(k+seat)%4]);
        const {state:s}=playGame(240000+k*59,seats,mode,{strategies});
        for(let i=0;i<s.stats.emergencies.length;i++) {
          const ok=s.stats.emergencies[i]==='success';win+=ok;events++;
          const perAct=successByAct[i%3];perAct.events++;perAct.success+=ok;
        }
        const plots=s.board.plots.filter(p=>p.owner!==null);
        ruined+=plots.filter(p=>p.health===0).length;owned+=plots.length;
        zero+=s.final.scores.filter(v=>v.total===0).length;players+=seats;
        const scores=s.final.scores.map(v=>v.total).sort((a,b)=>b-a);
        impacts.push(100*(scores[0]-scores[1])/Math.max(1,scores[0]));
        actions+=s.stats.actions;fizzled+=s.stats.fizzled;
      }
      impacts.sort((a,b)=>a-b);
      const pct=(a,b)=>b?+(100*a/b).toFixed(2):null;
      const row={factor,mode,games,emergencies:events,successPct:pct(win,events),
        ruinedPct:pct(ruined,owned),zeroPrestigePct:pct(zero,players),
        fizzledPct:pct(fizzled,actions),medianWinningMarginPct:+impacts[Math.floor(impacts.length/2)].toFixed(2),
        byAct:successByAct.map(v=>pct(v.success,v.events))};
      out.push(row);
      console.log(`×${factor} ${mode}: emergency success ${row.successPct}%, ruined plots ${row.ruinedPct}%, median margin ${row.medianWinningMarginPct}%`);
    }
  }
} finally {
  // Restore imported data even if a diagnostic throws.
  for(const [k,v] of Object.entries(baseline))E.CONTENT.emergencies[k].perPlayer=v;
}
const output={purpose:'Illustrative paired-seed robot sensitivity only: NO automatic gameplay tuning',
  baselinePerPlayer:baseline,method:'Same seeds, modes, seven seat counts and four rotated competent strategies; gameplay bots adapt to public thresholds. Small N: do not infer human fairness or safety.',rows:out};
const report=path.join(__dirname,'../reports/phase11-emergency-sensitivity.json');
fs.mkdirSync(path.dirname(report),{recursive:true});
fs.writeFileSync(report,JSON.stringify(output,null,2)+'\n');
assert.equal(JSON.stringify(Object.fromEntries(Object.entries(E.CONTENT.emergencies).map(([k,v])=>[k,v.perPlayer]))),JSON.stringify(baseline));
console.log('✔ Diagnostic report written. Production emergency thresholds remain unchanged.');
