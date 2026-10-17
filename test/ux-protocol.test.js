'use strict';
/* No npm dependencies: board ownership glyphs, phone planning control structure
   and transient session recovery state machine. Not a substitute for browser tests. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const E = require('../src/engine/garden');
const root = path.join(__dirname,'..');
const page = fs.readFileSync(path.join(root,'public/v2/play.html'), 'utf8');
const boardCode = fs.readFileSync(path.join(root,'public/board.js'), 'utf8');
const w = {};
vm.runInNewContext(boardCode, { window:w });
const now = Date.now();
const s = E.createGame({ roomCode:'ABCD', now, seed:177 });
assert.ok(E.addPlayer(s,{ name:'First' },now).ok);
assert.ok(E.addPlayer(s,{ name:'Second' },now).ok);
assert.ok(E.apply(s,0,{type:'start'},now).ok);
while (s.phase.stage === 'draft') {
  const seat = s.phase.draftQueue[0];
  assert.ok(E.apply(s,seat,{type:'chooseGod',god:seat===0?'thor':'freya'},now).ok);
}
const topology = E.clientTopology(s.board.layoutId);
const markup = w.RagnaBoard.gardenSvg({topo:topology,plots:s.board.plots,players:s.players,art:{}});
const owned = s.board.plots.filter(p => p.owner !== null).length;
assert.ok(owned > 0);
assert.equal((markup.match(/class="owner-seat"/g)||[]).length, owned,
  'every owned plot must show a non-colour player seat number');
for (const seat of [...new Set(s.board.plots.filter(p=>p.owner!==null).map(p=>p.owner))])
  assert.match(markup, new RegExp(`class="owner-seat"[^>]*>${seat+1}<\\/text>`));
console.log('  ✔ owned garden hexes show numbered ownership markers');

assert.match(page, /class="slot-row"/);
assert.match(page, /<button class="slot-clear" data-act="clearSlot"/);
assert.doesNotMatch(page, /role="button" data-act="clearSlot"/, 'clear controls must be true buttons, not nested roles');
assert.match(page, /class="plan-brief"/);
assert.match(page, /sheet\.scrollTop = scroll/);
assert.match(page, /e\.key === 'Escape' && ui\.sheet/);
console.log('  ✔ planning controls are independent and sheets keep scroll/focus support');

const start = page.indexOf('let rejoinPending = false;');
const end = page.indexOf("socket.on('connect'", start);
assert.ok(start !== -1 && end > start, 'rejoin implementation present');
const banner = { hidden:true, textContent:'' };
const callbacks = [];
const session = { code:'ABCD', token:'keep-on-timeout' };
let status = { ok:false, transient:true, error:'No reply from the server' };
let deleted = 0;
const env = {
  KEY:'ragnagrok.player', saved:session, view:{}, topo:{}, ui:{sheet:null}, params:{get:()=>null}, socket:{connected:true},
  store:{del:()=>deleted++}, clearTimeout:()=>{}, setTimeout:fn=>{callbacks.push(fn);return callbacks.length},
  $:()=>banner, emit:async()=>status, render:()=>{}, maybeShowRules:()=>{}
};
vm.createContext(env);
vm.runInContext(page.slice(start,end) + '; globalThis.check = {rejoin, savedSession:()=>saved};',env);
(async () => {
  await env.check.rejoin();
  assert.equal(env.check.savedSession().token,session.token,'transient failures must not erase seat token');
  assert.equal(deleted,0,'local session must survive temporary network failure');
  assert.equal(banner.hidden,false);
  assert.equal(callbacks.length,1,'temporary timeout must schedule a retry');
  status={ok:true};
  callbacks.shift()();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(banner.hidden,true,'successful retry clears reconnect banner');
  assert.equal(deleted,0);
  status={ok:false,error:'This phone is not in that game'};
  await env.check.rejoin();
  assert.equal(deleted,1,'definitively revoked seat must be cleared');
  console.log('  ✔ transient rejoin timeouts retain tokens and retry; invalid tokens are cleared');
  console.log('✔ All dependency-free UX and reconnect checks passed');
})().catch(err => { console.error(err); process.exitCode=1; });
