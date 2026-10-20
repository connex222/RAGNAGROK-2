/* Vitest is an optional developer install (npm install -D vitest).
   Reuses the identical contracts run by dependency-free npm test:offline. */
import { createRequire } from 'node:module';
import { describe, it } from 'vitest';
const require = createRequire(import.meta.url);
const { cases } = require('../engine-contracts.js');

describe('RAGNAGROK core engine contracts', () => {
  for (const [name, check] of cases) it(name, check);
});
