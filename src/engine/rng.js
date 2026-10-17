'use strict';
/* Seeded random numbers (mulberry32).
   The seed lives inside the game state, so a saved game resumes with the
   exact same dice sequence, and any bug can be replayed from its seed. */

function next(st) {
  st.s = (st.s + 0x6D2B79F5) >>> 0;
  let t = st.s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function int(rand, n) {
  return Math.floor(rand() * n);
}

function shuffle(rand, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = int(rand, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

module.exports = { next, int, shuffle };
