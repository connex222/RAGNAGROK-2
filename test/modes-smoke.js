'use strict';
/* Reproducible cross-mode smoke simulation: three seeds for each player count 2–8.
   Not a statistically valid balance study; checks completion, invariants, scoring. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { playGame } = require('./sim2');
const modes = ['standard', 'long', 'epic'];
const rows = [];
for (let mi = 0; mi < modes.length; mi++) {
  const mode = modes[mi];
  let ruined = 0, owned = 0, marginSum = 0, failed = 0, actions = 0;
  let count = 0;
  for (let n = 2; n <= 8; n++) {
    for (let k = 0; k < 3; k++) {
      const seed = 50000 + mi * 1000 + n * 100 + k;
      const { state } = playGame(seed, n, mode);
      assert.equal(state.phase.stage, 'gameOver');
      assert.equal(state.players.length, n);
      assert.equal(state.final.scores.length, n);
      assert.ok(state.final.winners.length >= 1);
      assert.equal(state.final.scores.reduce((sum, sc) => sum + sc.total, 0),
        state.final.scores.reduce((sum, sc) => sum + sc.shows + sc.features + sc.goodwill, 0));
      const scores = state.final.scores.map(sc => sc.total).sort((a,b) => b-a);
      marginSum += scores[0] ? (scores[0]-scores[1])/scores[0] : 0;
      const occupied = state.board.plots.filter(p => p.owner !== null);
      owned += occupied.length;
      ruined += occupied.filter(p => p.health === 0).length;
      failed += state.stats.fizzled;
      actions += state.stats.actions;
      count++;
    }
  }
  const row = { mode, games: count, meanMargin: marginSum/count, ruined: ruined/owned, fizzled: failed/actions };
  rows.push(row);
  console.log(`  ✔ ${mode}: ${count} completed games, 2–8 players, 3 seeds each`);
}
const pct = x => (x*100).toFixed(1)+'%';
const version = require('../package.json').version;
const md = `# V2 game-mode smoke test — ${version}\n\n`+
  `Every match completed with valid scoring; all seven player counts (2–8) were covered with three deterministic seeds per mode.\n\n`+
  `These 21-game samples per mode are **not** a statistically sound god-balance or strategy-balance analysis. The winner margin here is a **mean**, not the historical reports' median.\n\n`+
  `| Mode | Games | Mean winner margin | Ruined owned plots | Failed actions |\n| --- | ---: | ---: | ---: | ---: |\n`+
  rows.map(r => `| ${r.mode} | ${r.games} | ${pct(r.meanMargin)} | ${pct(r.ruined)} | ${pct(r.fizzled)} |`).join('\n')+ '\n\n' +
  `Command: \`node test/modes-smoke.js\`. Fixed seeds: 50000 + modeIndex * 1000 + playerCount * 100 + seedIndex.\n`;
fs.mkdirSync(path.join(__dirname,'..','reports'),{recursive:true});
fs.writeFileSync(path.join(__dirname,'..','reports',`smoke-v2-${version.split('-').pop().replace('.', '')}.md`),md);
console.log('✔ All 63 V2 game-mode smoke games passed');
