'use strict';
/* Board geometry: hexes, corners (vertices) and edges.
   Hexes use axial coordinates (q, r) with pointy tops.
   Geometry never changes during a game, so it is built once per layout,
   cached, and kept OUT of the saved game state. */

const SQRT3 = Math.sqrt(3);
const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
const LAYOUT_RADIUS = { 'std-19': 2, 'exp-37': 3 };
const cache = {};

const round3 = n => Math.round(n * 1000) / 1000;

function build(radius, layoutId) {
  const hexes = [];
  for (let q = -radius; q <= radius; q++) {
    const rMin = Math.max(-radius, -q - radius);
    const rMax = Math.min(radius, -q + radius);
    for (let r = rMin; r <= rMax; r++) {
      hexes.push({
        id: 'h' + hexes.length, q, r,
        x: round3(SQRT3 * (q + r / 2)), y: round3(1.5 * r),
        vertices: [], edges: [], neighbors: []
      });
    }
  }

  const hexByQR = {};
  hexes.forEach(h => { hexByQR[h.q + ',' + h.r] = h; });
  hexes.forEach(h => {
    h.neighbors = DIRS
      .map(([dq, dr]) => hexByQR[(h.q + dq) + ',' + (h.r + dr)])
      .filter(Boolean)
      .map(n => n.id);
  });

  const vertices = [];
  const vByKey = {};
  hexes.forEach(h => {
    for (let i = 0; i < 6; i++) {
      const ang = (Math.PI / 180) * (60 * i - 30);
      const x = h.x + Math.cos(ang);
      const y = h.y + Math.sin(ang);
      const key = Math.round(x * 1000) + ',' + Math.round(y * 1000);
      let v = vByKey[key];
      if (!v) {
        v = { id: 'v' + vertices.length, x: round3(x), y: round3(y), hexes: [], edges: [], neighbors: [] };
        vertices.push(v);
        vByKey[key] = v;
      }
      v.hexes.push(h.id);
      h.vertices.push(v.id);
    }
  });

  const vertexById = {};
  vertices.forEach(v => { vertexById[v.id] = v; });

  const edges = [];
  const eByKey = {};
  hexes.forEach(h => {
    for (let i = 0; i < 6; i++) {
      const a = h.vertices[i];
      const b = h.vertices[(i + 1) % 6];
      const key = [a, b].sort().join('|');
      let e = eByKey[key];
      if (!e) {
        const va = vertexById[a];
        const vb = vertexById[b];
        e = {
          id: 'e' + edges.length, v: [a, b], hexes: [],
          x: round3((va.x + vb.x) / 2), y: round3((va.y + vb.y) / 2)
        };
        edges.push(e);
        eByKey[key] = e;
        va.edges.push(e.id);
        vb.edges.push(e.id);
        va.neighbors.push(b);
        vb.neighbors.push(a);
      }
      e.hexes.push(h.id);
      h.edges.push(e.id);
    }
  });

  const hexById = {};
  const hexIndex = {};
  hexes.forEach((h, i) => { hexById[h.id] = h; hexIndex[h.id] = i; });
  const edgeById = {};
  edges.forEach(e => { edgeById[e.id] = e; });

  // Coastline edges belong to only one hex. Sorted by angle so ports spread evenly round the board.
  const coastEdges = edges
    .filter(e => e.hexes.length === 1)
    .sort((a, b) => Math.atan2(a.y, a.x) - Math.atan2(b.y, b.x))
    .map(e => e.id);

  return { layoutId, radius, hexes, vertices, edges, hexById, hexIndex, vertexById, edgeById, coastEdges };
}

function getTopology(layoutId) {
  if (cache[layoutId]) return cache[layoutId];
  const radius = LAYOUT_RADIUS[layoutId];
  if (radius === undefined) throw new Error('Unknown layout: ' + layoutId);
  cache[layoutId] = build(radius, layoutId);
  return cache[layoutId];
}

/* A plain-JSON copy for the TV and phones to draw the board.
   Units: hex "size" = 1 (centre to corner). Multiply by your pixel size. */
function clientTopology(layoutId) {
  const t = getTopology(layoutId);
  return {
    layoutId: t.layoutId,
    radius: t.radius,
    hexes: t.hexes.map(h => ({ id: h.id, q: h.q, r: h.r, x: h.x, y: h.y, vertices: h.vertices, neighbors: h.neighbors })),
    vertices: t.vertices.map(v => ({ id: v.id, x: v.x, y: v.y })),
    edges: t.edges.map(e => ({ id: e.id, v: e.v, x: e.x, y: e.y })),
    coastEdges: t.coastEdges
  };
}

module.exports = { getTopology, clientTopology, LAYOUT_RADIUS };
