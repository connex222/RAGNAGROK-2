'use strict';
/* Random board generation: terrain, number tokens and Garden Centres (ports). */

const { int, shuffle } = require('./rng');
const { getTopology } = require('./topology');

const RESOURCES = ['compost', 'fertilizer', 'sprinklers', 'turf', 'gnomeDust'];
const four = n => [n, n, n, n];

const LAYOUTS = {
  standard: {
    layoutId: 'std-19',
    bank: 19,
    terrain: { turf: 4, fertilizer: 4, gnomeDust: 4, sprinklers: 3, compost: 3, scorched: 1 },
    tokens: [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12],
    genericPorts: 4
  },
  expanded: {
    layoutId: 'exp-37',
    bank: 24,
    terrain: { turf: 8, fertilizer: 8, gnomeDust: 7, sprinklers: 6, compost: 6, scorched: 2 },
    tokens: [2, 2, ...four(3), ...four(4), ...four(5), ...four(6), ...four(8), ...four(9), ...four(10), ...four(11), 12],
    genericPorts: 6
  }
};

const isRed = t => t === 6 || t === 8;

function redNumbersApart(hexes, topo) {
  return hexes.every((h, i) => {
    if (!isRed(h.token)) return true;
    return topo.hexes[i].neighbors.every(nid => !isRed(hexes[topo.hexIndex[nid]].token));
  });
}

function generateBoard(rand, size) {
  const L = LAYOUTS[size];
  if (!L) throw new Error('Unknown board size: ' + size);
  const topo = getTopology(L.layoutId);

  const terrains = [];
  Object.entries(L.terrain).forEach(([t, c]) => { for (let i = 0; i < c; i++) terrains.push(t); });

  let hexes = null;
  for (let attempt = 0; attempt < 2000; attempt++) {
    shuffle(rand, terrains);
    const tokens = shuffle(rand, L.tokens.slice());
    let ti = 0;
    hexes = topo.hexes.map((h, i) => ({
      id: h.id, q: h.q, r: h.r,
      terrain: terrains[i],
      token: terrains[i] === 'scorched' ? null : tokens[ti++]
    }));
    if (redNumbersApart(hexes, topo)) break;
  }

  const coast = topo.coastEdges;
  const portCount = L.genericPorts + RESOURCES.length;
  const offset = int(rand, coast.length);
  const kinds = shuffle(rand, [...Array(L.genericPorts).fill(null), ...RESOURCES]);
  const ports = kinds.map((resource, i) => ({
    id: 'p' + i,
    edge: coast[(Math.floor((i * coast.length) / portCount) + offset) % coast.length],
    resource,
    ratio: resource ? 2 : 3
  }));

  return {
    layoutId: L.layoutId,
    hexes,
    mowerHex: hexes.find(h => h.terrain === 'scorched').id,
    ports
  };
}

module.exports = { LAYOUTS, generateBoard, RESOURCES };
