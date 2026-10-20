'use strict';
const { cases } = require('./engine-contracts');
for (const [name, run] of cases) { run(); console.log('  ✔ ' + name); }
console.log(`✔ ${cases.length} engine contract cases passed`);
