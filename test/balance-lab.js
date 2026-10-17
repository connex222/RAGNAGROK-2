'use strict';
/* Paired-seed exploratory balance comparison. No disk output, no rule changes.
   Run: node test/balance-lab.js baseline 40
        node test/balance-lab.js candidate 40 */
const { playGame } = require('./sim2');
const C = require('../src/engine/garden').CONTENT;
const variant = process.argv[2] || 'baseline';
const samples = Number(process.argv[3] || 40);
if(!['baseline','candidate'].includes(variant)) throw Error('Unknown variant');
// Explicitly select each scenario so results remain reproducible after the
// candidate becomes the production config; the baseline is dev.2 intensity.
C.disasters[3].find(d=>d.key==='mower').health=variant==='baseline' ? -2 : -1;
C.disastersPerRound.small[3]=variant==='baseline' ? 2 : 1;
C.disastersPerRound.large[3]=variant==='baseline' ? 3 : 2;
for(const mode of (process.argv[4] ? [process.argv[4]] : ['standard','long','epic'])) {
  if (!['standard','long','epic'].includes(mode)) throw Error('Unknown game length');
  let ruined=0, owned=0, margins=[], points={shows:0,features:0,goodwill:0}, actions=0, fizzle=0;
  for(let k=0;k<samples;k++) {
    const n=2+(k%7);
    const {state:s}=playGame(90000+k*31,n,mode);
    const scores=s.final.scores.map(x=>x.total).sort((a,b)=>b-a);
    margins.push((scores[0]-scores[1])/Math.max(scores[0],1));
    for(const p of s.board.plots) if(p.owner!==null){owned++; if(p.health===0)ruined++;}
    for(const sc of s.final.scores)for(const key of Object.keys(points)) points[key]+=sc[key];
    actions+=s.stats.actions; fizzle+=s.stats.fizzled;
  }
  margins.sort((a,b)=>a-b);
  console.log(JSON.stringify({variant,mode,games:samples,ruinPct:100*ruined/owned,
    medianMarginPct:100*margins[Math.floor(samples/2)],showSharePct:100*points.shows/Object.values(points).reduce((a,b)=>a+b,0),fizzlePct:100*fizzle/actions}));
}
