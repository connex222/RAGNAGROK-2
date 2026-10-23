'use strict';
/* A reproducible, strategy-controlled ROBOT audit, not a human-playtest gate.
 * Run: node test/phase11-balanced-audit.js 140
 * Four nonrandom strategies rotate through seven player counts; bootstrap
 * resamples GAMES rather than incorrectly treating seats as independent. */
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {playGame}=require('./sim2');
const E=require('../src/engine/garden');
const modes=['standard','long','epic'];
const profiles=['gardener','baron','chaser','menace'];
const gods=Object.keys(E.CONTENT.gods);
const n=Number(process.argv[2]||140);
assert.ok(Number.isInteger(n)&&n>=14&&n<=1500&&n%7===0,'Count must be multiple of seven, 14–1500');
function median(a) {
  const b=a.slice().sort((x,y)=>x-y),half=b.length>>1;
  return b.length%2?b[half]:(b[half-1]+b[half])/2;
}
const sum=(a,k)=>a.reduce((t,x)=>t+x[k],0);
const round=x=>x==null?null:Math.round(x*100)/100;
function stats(rows) {
  const kinds={};
  for(const row of rows)for(const [k,v] of Object.entries(row.kinds))
    kinds[k]=(kinds[k]||0)+v;
  const groups=key=>{
    const o=Object.fromEntries((key==='god'?gods:profiles).map(g=>[g,{played:0,wins:0,expected:0}]));
    for(const row of rows)for(const player of row.players) {
      const g=o[player[key]];g.played++;g.wins+=player.win;g.expected+=1/row.count;
    }
    return Object.fromEntries(Object.entries(o).map(([k,v])=>[k,{
      played:v.played,fairShareWinRatio:v.expected>0?v.wins/v.expected:null}]));
  };
  const score=sum(rows,'shows')+sum(rows,'features')+sum(rows,'goodwill');
  return {
    games:rows.length,
    medianWinningMarginPct:100*median(rows.map(r=>r.margin)),
    ruinedOwnedPlotsPct:100*sum(rows,'ruined')/sum(rows,'owned'),
    emergencySuccessPct:100*sum(rows,'emergencyWon')/sum(rows,'emergencyCount'),
    emergencyEvents:sum(rows,'emergencyCount'),
    goodwillOfTotalScorePct:100*sum(rows,'goodwill')/score,
    zeroPrestigePct:100*sum(rows,'zeroScores')/sum(rows,'count'),
    carBootPct:100*(kinds.carBoot||0)/sum(rows,'actions'),
    prayAndMeddlePct:100*((kinds.pray||0)+(kinds.meddle||0))/sum(rows,'actions'),
    fizzlePct:100*sum(rows,'fizzled')/sum(rows,'actions'),
    gods:groups('god'),strategies:groups('strategy')
  };
}
const metrics=['medianWinningMarginPct','ruinedOwnedPlotsPct','emergencySuccessPct',
  'goodwillOfTotalScorePct','zeroPrestigePct','carBootPct','prayAndMeddlePct','fizzlePct'];
function uncertainty(rows,seed) {
  let v=seed>>>0;
  const rnd=()=>{v=(Math.imul(v,1664525)+1013904223)>>>0;return v/4294967296;};
  const values=Object.fromEntries(metrics.map(k=>[k,[]]));
  const godRatios=Object.fromEntries(gods.map(k=>[k,[]]));
  for(let rep=0;rep<800;rep++) {
    const sampled=Array.from({length:rows.length},()=>rows[Math.floor(rnd()*rows.length)]);
    const s=stats(sampled);
    for(const k of metrics)if(Number.isFinite(s[k]))values[k].push(s[k]);
    for(const g of gods)if(Number.isFinite(s.gods[g].fairShareWinRatio))
      godRatios[g].push(s.gods[g].fairShareWinRatio);
  }
  const interval=a=>{
    a.sort((x,y)=>x-y);
    return [round(a[Math.floor(a.length*.025)]),round(a[Math.floor(a.length*.975)])];
  };
  return {
    metrics:Object.fromEntries(Object.entries(values).map(([k,v])=>[k,interval(v)])),
    gods:Object.fromEntries(Object.entries(godRatios).map(([k,v])=>[k,interval(v)]))
  };
}
const all=[];
for(const mode of modes) {
  const rows=[];
  for(let k=0;k<n;k++){
    const count=2+k%7;
    const strategies=Array.from({length:count},(_,seat)=>profiles[(k+seat)%4]);
    const {state:s,strats}=playGame(240000+k*59,count,mode,{strategies});
    const scores=s.final.scores.slice().sort((a,b)=>b.total-a.total);
    const winners=s.final.winners;
    const owned=s.board.plots.filter(p=>p.owner!==null);
    rows.push({
      count,margin:scores[0].total>0?(scores[0].total-scores[1].total)/scores[0].total:0,
      ruined:owned.filter(p=>p.health===0).length,owned:owned.length,
      emergencyCount:s.stats.emergencies.length,
      emergencyWon:s.stats.emergencies.filter(r=>r==='success').length,
      shows:s.final.scores.reduce((a,r)=>a+r.shows,0),
      features:s.final.scores.reduce((a,r)=>a+r.features,0),
      goodwill:s.final.scores.reduce((a,r)=>a+r.goodwill,0),
      zeroScores:s.final.scores.filter(r=>r.total===0).length,
      actions:s.stats.actions,fizzled:s.stats.fizzled,kinds:s.stats.byKind,
      players:s.players.map(p=>({
        god:p.god,strategy:strats[p.seat],
        win:winners.includes(p.seat)?1/winners.length:0
      }))
    });
  }
  const s=stats(rows),ci=uncertainty(rows,5489+all.length*31);
  for(const k of metrics)s[k]=round(s[k]);
  for(const g of gods)s.gods[g].fairShareWinRatio=round(s.gods[g].fairShareWinRatio);
  for(const x of Object.values(s.strategies))x.fairShareWinRatio=round(x.fairShareWinRatio);
  all.push({mode,stats:s,ci});
  console.log(mode+': '+n+' games; median margin '+s.medianWinningMarginPct+
    '%, ruined '+s.ruinedOwnedPlotsPct+'%, emergencies '+s.emergencySuccessPct+'%');
}
const output={
  version:require('../package.json').version,
  methodology:'Seed 240000+k*59, seat count 2+k%7, deterministic style rotation without random robot. 800 seeded game-level bootstrap resamples per mode; intervals approximate, not human data.',
  perMode:n,modes:all
};
const root=path.join(__dirname,'..','reports');
fs.mkdirSync(root,{recursive:true});
fs.writeFileSync(path.join(root,'phase11-balanced-audit.json'),JSON.stringify(output,null,2)+'\n');
const fmt=(r,k)=>r.stats[k]+'% (95% bootstrap '+r.ci.metrics[k][0]+'–'+r.ci.metrics[k][1]+'%)';
let md='# Phase 11 balanced strategy audit — '+output.version+'\n\n'+output.methodology+'\n\n';
md+='| Measure | Standard | Extended | Epic | Design target |\n| --- | --- | --- | --- | --- |\n';
for(const [k,label,target] of [
 ['medianWinningMarginPct','Median winning margin','<15%'],
 ['ruinedOwnedPlotsPct','Ruined owned plots','10–25%'],
 ['emergencySuccessPct','Emergency success','55–70%'],
 ['goodwillOfTotalScorePct','Goodwill share','10–20%'],
 ['zeroPrestigePct','Players with zero Prestige','<2%'],
 ['carBootPct','Car-Boot actions','≤20%'],
 ['prayAndMeddlePct','Pray + Meddle actions','≥18%']
])md+='| '+label+' | '+all.map(r=>fmt(r,k)).join(' | ')+' | '+target+' |\n';
md+='\n## Gods — fair-share win ratio (95% game-level bootstrap)\n\n| God | Standard | Extended | Epic |\n| --- | --- | --- | --- |\n';
for(const god of gods)md+='| '+E.CONTENT.gods[god].name+' | '+
  all.map(r=>r.stats.gods[god].fairShareWinRatio+' ('+r.ci.gods[god].join('–')+')').join(' | ')+' |\n';
md+='\n**Limitations:** God assignment is not fully factorial. Intervals are estimates, not proofs of fairness. Robots do not model social deals, realistic mistakes, phone latency or genuine desire for a rematch. No gameplay numbers are changed by this audit.\n';
fs.writeFileSync(path.join(root,'phase11-balanced-audit.md'),md);
console.log('✔ Reproducible Phase 11 JSON and Markdown reports written');
