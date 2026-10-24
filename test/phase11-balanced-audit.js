'use strict';
/* Phase 11: independent fixed-seed balanced-strategy ROBOT benchmark with
 * game-level bootstrap uncertainty intervals. Not an acceptance gate, and
 * not evidence of real players' enjoyment or fair human play. 
 * Run: node test/phase11-balanced-audit.js 140
 * Output: reports/phase11-balanced-audit.json and .md
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { playGame } = require('./sim2');
const E = require('../src/engine/garden');
const modes = ['standard','long','epic'];
const strategyCycle = ['gardener','baron','chaser','menace'];
const n = Number(process.argv[2] || 140);
assert.ok(Number.isInteger(n) && n >= 14 && n <= 1500 && n % 7 === 0,
  'Sample count must be a multiple of seven, 14–1500 for even player-count coverage');
const GODS = Object.keys(E.CONTENT.gods);
const median = xs => {
  if (!xs.length) return null;
  const s = xs.slice().sort((a,b) => a-b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m-1]+s[m])/2;
};
function calc(rows) {
  const sum = key => rows.reduce((a,r) => a+r[key],0);
  const points = sum('shows')+sum('features')+sum('goodwill');
  const kinds = new Map();
  for (const r of rows) for (const [k,v] of Object.entries(r.kinds))
    kinds.set(k, (kinds.get(k)||0)+v);
  const group = key => {
    const groups = Object.fromEntries((key === 'god' ? GODS : strategyCycle).map(k => [k,{played:0,wins:0,expected:0}]));
    for(const r of rows) for(const x of r.players) {
      const o=groups[x[key]];o.played++;o.wins+=x.win;o.expected+=1/r.count;
    }
    return Object.fromEntries(Object.entries(groups).map(([k,v]) => [k,{
      played:v.played, fairShareWinRatio:v.expected>0?v.wins/v.expected:null
    }]));
  };
  return {
    games:rows.length, medianWinningMarginPct:100*median(rows.map(r=>r.margin)),
    ruinedOwnedPlotsPct:100*sum('ruined')/sum('owned'),
    emergencySuccessPct:100*sum('emergencyWon')/sum('emergencyCount'),
    emergencyEvents:sum('emergencyCount'),
    goodwillOfTotalScorePct:100*sum('goodwill')/points,
    zeroPrestigePct:100*sum('zeroScores')/sum('count'),
    carBootPct:100*(kinds.get('carBoot')||0)/sum('actions'),
    prayAndMeddlePct:100*((kinds.get('pray')||0)+(kinds.get('meddle')||0))/sum('actions'),
    fizzlePct:100*sum('fizzled')/sum('actions'),
    gods:group('god'), strategies:group('strategy')
  };
}
// Bootstrap samples at the GAME level because several players/emergencies in
// a match are dependent observations, not independent Bernoulli trials.
function bootstrap(rows, seed) {
  const state = {v:seed>>>0};
  const rnd = () => {state.v=(Math.imul(state.v,1664525)+1013904223)>>>0;return state.v/4294967296;};
  const fields=['medianWinningMarginPct','ruinedOwnedPlotsPct','emergencySuccessPct','goodwillOfTotalScorePct',
    'zeroPrestigePct','carBootPct','prayAndMeddlePct','fizzlePct'];
  const values=Object.fromEntries(fields.map(k=>[k,[]]));
  const godRatios=Object.fromEntries(GODS.map(k=>[k,[]]));
  for(let rep=0;rep<800;rep++) {
    const sampled=Array.from({length:rows.length},()=>rows[Math.floor(rnd()*rows.length)]);
    const stats=calc(sampled);
    for(const k of fields) if(Number.isFinite(stats[k]))values[k].push(stats[k]);
    for(const g of GODS)if(Number.isFinite(stats.gods[g].fairShareWinRatio))godRatios[g].push(stats.gods[g].fairShareWinRatio);
  }
  const bounds = a => {
    const sorted=a.sort((x,y)=>x-y);
    return [sorted[Math.floor(sorted.length*.025)],sorted[Math.floor(sorted.length*.975)]];
  };
  return {metrics:Object.fromEntries(Object.entries(values).map(([k,v])=>[k,bounds(v)])),
    gods:Object.fromEntries(Object.entries(godRatios).map(([k,v])=>[k,bounds(v)]))};
}
function round(v) {return v == null ? null : Math.round(v*100)/100;}
const all=[];
for(const mode of modes) {
  const rows=[];
  for(let k=0;k<n;k++) {
    const count=2+(k%7);
    // Each style appears at every seat; random strategy deliberately excluded
    // because it is a diagnostic bot, not a plausible competent opponent.
    const strategies=Array.from({length:count},(_,seat) => strategyCycle[(k+seat)%strategyCycle.length]);
    const seed=240000+k*59;
    const {state, strats}=playGame(seed,count,mode,{strategies});
    const scores=state.final.scores.slice().sort((a,b)=>b.total-a.total);
    const winners=state.final.winners;
    rows.push({
      count, margin:scores[0].total>0?(scores[0].total-scores[1].total)/scores[0].total:0,
      ruined:state.board.plots.filter(p=>p.owner!==null&&p.health===0).length,
      owned:state.board.plots.filter(p=>p.owner!==null).length,
      emergencyCount:state.stats.emergencies.length,
      emergencyWon:state.stats.emergencies.filter(x=>x==='success').length,
      shows:state.final.scores.reduce((a,s)=>a+s.shows,0),
      features:state.final.scores.reduce((a,s)=>a+s.features,0),
      goodwill:state.final.scores.reduce((a,s)=>a+s.goodwill,0),
      zeroScores:state.final.scores.filter(s=>s.total===0).length,
      actions:state.stats.actions, fizzled:state.stats.fizzled,
      kinds:state.stats.byKind,
      players:state.players.map(p=>({god:p.god,strategy:strats[p.seat],
        win:winners.includes(p.seat)?1/winners.length:0}))
    });
  }
  const stats=calc(rows), ci=bootstrap(rows,5489+all.length*31);
  for (const key of ['medianWinningMarginPct','ruinedOwnedPlotsPct','emergencySuccessPct','goodwillOfTotalScorePct',
    'zeroPrestigePct','carBootPct','prayAndMeddlePct','fizzlePct']) {
    stats[key]=round(stats[key]);ci.metrics[key]=ci.metrics[key].map(round);
  }
  for(const g of GODS) {stats.gods[g].fairShareWinRatio=round(stats.gods[g].fairShareWinRatio);
    ci.gods[g]=ci.gods[g].map(round);}
  for(const v of Object.values(stats.strategies))v.fairShareWinRatio=round(v.fairShareWinRatio);
  all.push({mode,stats,ci});
  console.log(`${mode}: ${n} seeded matches; median margin ${stats.medianWinningMarginPct}% [${ci.metrics.medianWinningMarginPct}], ruined ${stats.ruinedOwnedPlotsPct}% [${ci.metrics.ruinedOwnedPlotsPct}], emergency ${stats.emergencySuccessPct}% [${ci.metrics.emergencySuccessPct}]`);
}
const output={version:require('../package.json').version, methodology:'Seed 240000+k*59, seat count 2+k%7, deterministic style rotation without random robot. 800 seeded game-level bootstrap resamples per mode; intervals approximate, not human data.', perMode:n, modes:all};
const root=path.join(__dirname,'..','reports');fs.mkdirSync(root,{recursive:true});
fs.writeFileSync(path.join(root,'phase11-balanced-audit.json'),JSON.stringify(output,null,2)+'\n');
const fmt=(obj,k)=>`${obj.stats[k]}% (95% bootstrap ${obj.ci.metrics[k][0]}–${obj.ci.metrics[k][1]}%)`;
let md=`# Phase 11 balanced strategy audit — ${output.version}\n\n${output.methodology}\n\n`;
md+='| Measure | Standard | Extended | Epic | Design target |\n| --- | --- | --- | --- | --- |\n';
for(const [k,title,target] of [
  ['medianWinningMarginPct','Median winning margin','<15%'],
  ['ruinedOwnedPlotsPct','Ruined owned plots','10–25%'],
  ['emergencySuccessPct','Emergency success','55–70%'],
  ['goodwillOfTotalScorePct','Goodwill share','10–20%'],
  ['zeroPrestigePct','Players with zero Prestige','<2%'],
  ['carBootPct','Car-Boot actions','≤20%'],
  ['prayAndMeddlePct','Pray + Meddle actions','≥18%']
])md+=`| ${title} | ${all.map(a=>fmt(a,k)).join(' | ')} | ${target} |\n`;
md+='\n## Gods — ratio to fair share (95% match-bootstrap intervals)\n\n| God | Standard | Extended | Epic |\n| --- | --- | --- | --- |\n';
for(const god of GODS)md+=`| ${E.CONTENT.gods[god].name} | ${all.map(a=>`${a.stats.gods[god].fairShareWinRatio} (${a.ci.gods[god].join('–')})`).join(' | ')} |\n`;
md+='\n**Interpretation:** Intervals account for match-level grouping but do not guarantee target precision, and gods are not assigned in a fully factorial counterfactual experiment. These numbers reflect programmed robot decisions, not real enjoyment, subjective fairness, mobile latency, or voluntary rematches. Make changes only with controlled paired evidence.\n';
fs.writeFileSync(path.join(root,'phase11-balanced-audit.md'),md);
console.log('✔ Wrote reproducible Phase 11 JSON and Markdown reports (no game-rule changes)');
