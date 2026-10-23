'use strict';
/* Seeded diagnostics across all three game lengths. Run the same script on
   baseline and candidate checkout to compare *identical* match scenarios.
   No balance target is asserted from samples this small. */
const { playGame } = require('./sim2');
const E = require('../src/engine/garden');
const modes = ['standard','long','epic'];
const requested = Number(process.argv[2] || 60);
if (!Number.isInteger(requested) || requested < 7 || requested > 1000)
  throw Error('Pass between 7 and 1000 games per mode');
const median = a => {
  if (!a.length) return null;
  const v = a.slice().sort((x,y)=>x-y);
  return v.length%2 ? v[(v.length-1)/2] : (v[v.length/2-1]+v[v.length/2])/2;
};
function audit(mode, nGames) {
  const m = {mode,games:nGames,playerGames:0,zeroPrestige:0,ruined:0,owned:0,emSuccess:0,emTotal:0,actions:0,
    types:{},fail:0,score:{shows:0,features:0,goodwill:0}, margins:[], marginsWithoutRandom:[],
    styles:{},gods:{}};
  for (let k=0;k<nGames;k++) {
    const seatCount = 2+k%7;
    // No Date.now(); stable across both checkouts, even when process order differs.
    const {state:s,strats} = playGame(140000 + k*47,seatCount,mode);
    const winners=s.final.winners;
    const rows=s.final.scores.slice().sort((a,b)=>b.total-a.total);
    const gap=rows[0].total>0?(rows[0].total-rows[1].total)/rows[0].total:0;
    m.margins.push(gap);
    if(!strats.includes('random'))m.marginsWithoutRandom.push(gap);
    for(const p of s.players) {
      const sc=s.final.scores.find(r=>r.seat===p.seat);
      m.playerGames++;
      if(sc.total===0)m.zeroPrestige++;
      for(const part of Object.keys(m.score))m.score[part]+=sc[part];
      const fair=1/seatCount,won=winners.includes(p.seat)?1/winners.length:0;
      for(const [map,key] of [[m.styles,strats[p.seat]],[m.gods,p.god]]){
        map[key]??={picked:0,wins:0,expected:0};
        map[key].picked++;map[key].wins+=won;map[key].expected+=fair;
      }
    }
    for(const p of s.board.plots)if(p.owner!==null){m.owned++;if(p.health===0)m.ruined++;}
    m.emTotal+=s.stats.emergencies.length;
    m.emSuccess+=s.stats.emergencies.filter(r=>r==='success').length;
    m.actions+=s.stats.actions;m.fail+=s.stats.fizzled;
    for(const[k,v]of Object.entries(s.stats.byKind))m.types[k]=(m.types[k]||0)+v;
  }
  const ratioMap=map=>Object.fromEntries(Object.entries(map).map(([k,v])=>[k,+(v.wins/v.expected).toFixed(3)]));
  const scoreSum=Object.values(m.score).reduce((a,b)=>a+b,0);
  return {
    mode,games:m.games,playerGames:m.playerGames,
    medianMarginPct:+(median(m.margins)*100).toFixed(2),
    medianWithoutRandomPct:m.marginsWithoutRandom.length?+(median(m.marginsWithoutRandom)*100).toFixed(2):null,
    nonRandomGames:m.marginsWithoutRandom.length,
    ruinedPct:+(100*m.ruined/m.owned).toFixed(2),
    zeroPrestigePct:+(100*m.zeroPrestige/m.playerGames).toFixed(2),
    goodwillSharePct:+(100*m.score.goodwill/scoreSum).toFixed(2),
    emergencySuccessPct:+(100*m.emSuccess/m.emTotal).toFixed(2),
    fizzledPct:+(100*m.fail/m.actions).toFixed(2),
    carBootPct:+(100*(m.types.carBoot||0)/m.actions).toFixed(2),
    interactionPct:+(100*((m.types.pray||0)+(m.types.meddle||0))/m.actions).toFixed(2),
    styleRatios:ratioMap(m.styles),godRatios:ratioMap(m.gods)
  };
}
const result={build:require('../package.json').version,seedRule:'140000+k*47; playerCount=2+k%7', perMode:requested,
  scenarios:modes.map(mode=>audit(mode,requested))};
console.log(JSON.stringify(result,null,2));
