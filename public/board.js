/* Ragnagrok board renderer, shared by the TV and the phones.

   RagnaBoard.svg(options) returns an <svg> string.
     board, topo, players   from the server state
     mode                   'view' | 'vertex' | 'ring' | 'edge' | 'hex'  (what can be tapped)
     legal                  ids that can be tapped in this mode
     sel, sel2              selected ids
     ghost                  { what, at, colour }  semi-transparent preview piece
     art                    { 'hex-turf': '/img/hex-turf.png', ... }  optional artwork

   Artwork slots used here (any missing slot falls back to drawn shapes):
     hex-turf, hex-fertilizer, hex-sprinklers, hex-compost, hex-gnomeDust, hex-scorched
     piece-shack, piece-manor, mower */
(function (global) {
  'use strict';

  const TERRAIN_COLOUR = {
    compost: '#7e5db5', fertilizer: '#e1b12c', sprinklers: '#d9533d',
    turf: '#4a9a42', gnomeDust: '#8fd0e8', scorched: '#5a4632'
  };
  const RES_ICON = { compost: '🍄', fertilizer: '🌾', sprinklers: '🔥', turf: '🌳', gnomeDust: '✨', scorched: '🥀' };
  const PAD = 1.15;

  /* One icon system for every screen: the artwork if it exists, otherwise an emoji.
     Slot names match the files in public/img (without the extension). */
  const FALLBACK = {
    'res-compost': '🍄', 'res-fertilizer': '🌾', 'res-sprinklers': '🔥', 'res-turf': '🌳', 'res-gnomeDust': '✨',
    'deity-thor': '⚡', 'deity-loki': '🎭', 'deity-freya': '🌸', 'deity-hel': '☠️',
    'deity-odin': '👁️', 'deity-heimdall': '🔭', 'deity-frigg': '📋', 'deity-njord': '⛲',
    mower: '🚜', 'piece-shack': '🛖', 'piece-manor': '🏰', trophy: '🦩',
    'icon-path': '🛤️', 'icon-perk': '📜', 'icon-cards': '🃏', 'icon-militia': '🪖',
    'icon-longestPath': '🛤️', 'icon-bank': '🏦', 'icon-dice': '🎲'
  };

  function icon(art, key, cls) {
    // Small god badges use the face-only crop: full portraits are unreadable at icon size.
    const url = art && ((key.indexOf('deity-') === 0 && art[key + '-face']) || art[key]);
    if (url) {
      const round = key.indexOf('deity-') === 0 ? ' gi-round' : '';
      return `<img class="gi${round}${cls ? ' ' + cls : ''}" src="${url}" alt="" aria-hidden="true">`;
    }
    return FALLBACK[key] || '';
  }

  const f3 = n => n.toFixed(3);

  function corners(h, k) {
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 180) * (60 * i - 30);
      pts.push(f3(h.x + Math.cos(a) * k) + ',' + f3(h.y + Math.sin(a) * k));
    }
    return pts.join(' ');
  }

  function bounds(topo) {
    const xs = topo.vertices.map(v => v.x);
    const ys = topo.vertices.map(v => v.y);
    const minX = Math.min(...xs) - PAD;
    const minY = Math.min(...ys) - PAD;
    return { minX, minY, w: Math.max(...xs) - Math.min(...xs) + PAD * 2, h: Math.max(...ys) - Math.min(...ys) + PAD * 2 };
  }

  function housePoly(x, y, s, manor) {
    const pts = manor
      ? [[-s, s], [-s, -s * 0.2], [-s * 0.45, -s * 0.2], [-s * 0.45, -s * 0.75], [0, -s * 1.15], [s * 0.45, -s * 0.75], [s * 0.45, -s * 0.2], [s, -s * 0.2], [s, s]]
      : [[-s, s], [-s, -s * 0.25], [0, -s], [s, -s * 0.25], [s, s]];
    return pts.map(([a, b]) => f3(x + a) + ',' + f3(y + b)).join(' ');
  }

  function piece(x, y, type, colour, art, extra) {
    const manor = type === 'manor';
    const slot = art[manor ? 'piece-manor' : 'piece-shack'];
    if (slot) {
      const r = manor ? 0.36 : 0.3;
      const s = manor ? 0.62 : 0.5;
      return `<g${extra || ''}><circle cx="${f3(x)}" cy="${f3(y)}" r="${r}" fill="${colour}" stroke="#1a1226" stroke-width=".05"/>` +
        `<image href="${slot}" x="${f3(x - s / 2)}" y="${f3(y - s / 2)}" width="${s}" height="${s}"/></g>`;
    }
    return `<polygon${extra || ''} points="${housePoly(x, y, manor ? 0.31 : 0.24, manor)}" fill="${colour}" stroke="#1a1226" stroke-width=".05"/>`;
  }

  function svg(o) {
    const board = o.board;
    const topo = o.topo;
    const players = o.players || [];
    const mode = o.mode || 'view';
    const legal = o.legal || [];
    const art = o.art || {};
    const legalSet = new Set(legal);
    const colour = seat => (players[seat] && players[seat].colour) || '#999';
    const prefix = o.idPrefix || 'rb';
    const B = bounds(topo);

    const vById = {};
    topo.vertices.forEach(v => { vById[v.id] = v; });
    const eById = {};
    topo.edges.forEach(e => { eById[e.id] = e; });

    let defs = '';
    let tiles = '';
    let marks = '';

    topo.hexes.forEach((hx, i) => {
      const st = board.hexes[i];
      const slot = art['hex-' + st.terrain];
      let cls = 'hex';
      let data = ` data-hex="${hx.id}"`;
      if (mode === 'hex') {
        if (legalSet.has(hx.id)) { cls += ' can'; data += ` data-spot="${hx.id}"`; } else cls += ' dim';
      }
      if (hx.id === o.sel || hx.id === o.sel2) cls += ' sel';

      if (slot) {
        defs += `<clipPath id="${prefix}c${i}"><polygon points="${corners(hx, 0.97)}"/></clipPath>`;
        tiles += `<image href="${slot}" x="${f3(hx.x - 0.87)}" y="${f3(hx.y - 1)}" width="1.74" height="2" preserveAspectRatio="xMidYMid slice" clip-path="url(#${prefix}c${i})"/>`;
        tiles += `<polygon class="${cls}"${data} points="${corners(hx, 0.97)}" fill="transparent"/>`;
      } else {
        tiles += `<polygon class="${cls}"${data} points="${corners(hx, 0.97)}" fill="${TERRAIN_COLOUR[st.terrain]}"/>`;
        tiles += `<text class="emo" x="${hx.x}" y="${f3(hx.y - 0.5)}" pointer-events="none">${RES_ICON[st.terrain]}</text>`;
      }
      if (st.token) {
        const red = st.token === 6 || st.token === 8;
        tiles += `<g class="tok${red ? ' red' : ''}" pointer-events="none"><circle cx="${hx.x}" cy="${f3(hx.y + 0.12)}" r=".34"/><text x="${hx.x}" y="${f3(hx.y + 0.12)}">${st.token}</text></g>`;
      }
    });

    (board.ports || []).forEach(p => {
      const e = eById[p.edge];
      const len = Math.hypot(e.x, e.y) || 1;
      const x = e.x + (e.x / len) * 0.42;
      const y = e.y + (e.y / len) * 0.42;
      const resArt = p.resource && art['res-' + p.resource];
      if (resArt) {
        marks += `<image href="${resArt}" x="${f3(x - 0.36)}" y="${f3(y - 0.15)}" width=".3" height=".3" pointer-events="none"/>`;
        marks += `<text class="port" x="${f3(x + 0.13)}" y="${f3(y)}" pointer-events="none">2:1</text>`;
      } else {
        marks += `<text class="port" x="${f3(x)}" y="${f3(y)}" pointer-events="none">${p.resource ? RES_ICON[p.resource] + '2:1' : '3:1'}</text>`;
      }
    });

    Object.keys(board.paths).forEach(eid => {
      const e = eById[eid];
      const a = vById[e.v[0]];
      const c = vById[e.v[1]];
      marks += `<line x1="${a.x}" y1="${a.y}" x2="${c.x}" y2="${c.y}" stroke="#1a1226" stroke-width=".26" stroke-linecap="round"/>`;
      marks += `<line data-edge="${eid}" x1="${a.x}" y1="${a.y}" x2="${c.x}" y2="${c.y}" stroke="${colour(board.paths[eid])}" stroke-width=".17" stroke-linecap="round"/>`;
    });

    Object.keys(board.buildings).forEach(vid => {
      const v = vById[vid];
      const b = board.buildings[vid];
      marks += piece(v.x, v.y, b.type, colour(b.owner), art, ` data-vertex="${vid}"`);
    });

    const mh = topo.hexes.find(hx => hx.id === board.mowerHex);
    if (mh) {
      marks += art.mower
        ? `<image class="mower" href="${art.mower}" x="${f3(mh.x - 0.05)}" y="${f3(mh.y + 0.02)}" width=".8" height=".8" pointer-events="none"/>`
        : `<text class="emo mower" x="${f3(mh.x + 0.45)}" y="${f3(mh.y + 0.42)}" style="font-size:.42px" pointer-events="none">🚜</text>`;
    }

    const g = o.ghost;
    if (g && g.at) {
      if ((g.what === 'shack' || g.what === 'manor') && vById[g.at]) {
        const v = vById[g.at];
        marks += `<g class="ghost">${piece(v.x, v.y, g.what, g.colour, art)}</g>`;
      } else if (g.what === 'path' && eById[g.at]) {
        const e = eById[g.at];
        const a = vById[e.v[0]];
        const c = vById[e.v[1]];
        marks += `<line class="ghost" x1="${a.x}" y1="${a.y}" x2="${c.x}" y2="${c.y}" stroke="${g.colour}" stroke-width=".2" stroke-linecap="round"/>`;
      } else if ((g.what === 'mower' || g.what === 'sinkhole') && topo.hexes.some(h => h.id === g.at)) {
        const h = topo.hexes.find(x => x.id === g.at);
        marks += `<polygon class="ghost ghost-hex" points="${corners(h, 0.97)}" fill="none" stroke="${g.colour}" stroke-width=".14"/>`;
      }
    }

    if (mode === 'vertex' || mode === 'ring') {
      legal.forEach(id => {
        const v = vById[id];
        if (!v) return;
        const s = id === o.sel ? ' sel' : '';
        marks += mode === 'ring'
          ? `<circle class="spot ring${s}" data-spot="${id}" cx="${v.x}" cy="${v.y}" r=".38"/>`
          : `<circle class="spot${s}" data-spot="${id}" cx="${v.x}" cy="${v.y}" r=".24"/>`;
      });
    }
    if (mode === 'edge') {
      legal.forEach(id => {
        const e = eById[id];
        if (!e) return;
        const a = vById[e.v[0]];
        const c = vById[e.v[1]];
        const s = id === o.sel ? ' sel' : '';
        marks += `<line class="edge${s}" x1="${a.x}" y1="${a.y}" x2="${c.x}" y2="${c.y}"/>`;
        marks += `<line class="hit" data-spot="${id}" x1="${a.x}" y1="${a.y}" x2="${c.x}" y2="${c.y}"/>`;
      });
    }

    return `<svg viewBox="${f3(B.minX)} ${f3(B.minY)} ${f3(B.w)} ${f3(B.h)}" role="img" aria-label="Game board">` +
      (defs ? `<defs>${defs}</defs>` : '') + tiles + marks + '</svg>';
  }

  /* ---------- V2: gardens ---------- */
  const FEATURE_ICON = {
    goldenGazebo: '🏛️', prizeMarrow: '🥒', roseArch: '🌹', waterFeature: '⛲', birdBath: '🐦',
    gnomeBattalion: '🧙'
  };
  const CONDITION_ICON = { blighted: '❄️', ash: '🌋', blessed: '🌟' };
  const HEALTH_SHADE = [0.62, 0.38, 0.12, 0];

  function glyph(art, slot, emoji, x, y, size) {
    if (art && art[slot]) return `<image href="${art[slot]}" x="${f3(x - size / 2)}" y="${f3(y - size / 2)}" width="${size}" height="${size}" pointer-events="none"/>`;
    return `<text class="emo" x="${f3(x)}" y="${f3(y)}" style="font-size:${f3(size * 0.8)}px" pointer-events="none">${emoji}</text>`;
  }

  /* V2 board: plots with health, owner, condition and feature.
     Options as svg(), plus: plots (state.board.plots), threats (plot ids hit this round), mine (seat to emphasise). */
  function gardenSvg(o) {
    const topo = o.topo;
    const plots = o.plots;
    const players = o.players || [];
    const art = o.art || {};
    const mode = o.mode || 'view';
    const legalSet = new Set(o.legal || []);
    const threats = new Set(o.threats || []);
    const prefix = o.idPrefix || 'gb';
    const B = bounds(topo);
    const byId = {};
    plots.forEach(p => { byId[p.id] = p; });
    let defs = '';
    let tiles = '';
    let marks = '';

    topo.hexes.forEach((hx, i) => {
      const p = byId[hx.id];
      if (!p) return;
      const slot = art['hex-' + p.terrain];
      let cls = 'hex';
      let data = ` data-hex="${hx.id}"`;
      if (mode === 'hex') {
        if (legalSet.has(hx.id)) { cls += ' can'; data += ` data-spot="${hx.id}"`; } else cls += ' dim';
      }
      if (hx.id === o.sel || hx.id === o.sel2) cls += ' sel';
      if (slot) {
        defs += `<clipPath id="${prefix}c${i}"><polygon points="${corners(hx, 0.97)}"/></clipPath>`;
        tiles += `<image href="${slot}" x="${f3(hx.x - 0.87)}" y="${f3(hx.y - 1)}" width="1.74" height="2" preserveAspectRatio="xMidYMid slice" clip-path="url(#${prefix}c${i})"/>`;
      } else {
        tiles += `<polygon points="${corners(hx, 0.97)}" fill="${TERRAIN_COLOUR[p.terrain]}"/>`;
        tiles += `<text class="emo" x="${hx.x}" y="${f3(hx.y - 0.55)}" pointer-events="none" style="font-size:.28px">${RES_ICON[p.terrain]}</text>`;
      }
      // Health: the less healthy, the darker the plot.
      const shade = HEALTH_SHADE[p.health];
      if (shade) tiles += `<polygon points="${corners(hx, 0.97)}" fill="#120a1c" fill-opacity="${shade}" pointer-events="none"/>`;
      if (p.health === 0) tiles += `<text class="emo" x="${hx.x}" y="${f3(hx.y + 0.05)}" style="font-size:.5px;opacity:.8" pointer-events="none">💀</text>`;
      // Owner: a thick ring in the owner's colour.
      if (p.owner !== null && p.owner !== undefined) {
        const colour = (players[p.owner] && players[p.owner].colour) || '#fff';
        tiles += `<polygon points="${corners(hx, 0.97)}" fill="${colour}" fill-opacity=".30" pointer-events="none"/>`;
        tiles += `<polygon points="${corners(hx, 0.86)}" fill="none" stroke="${colour}" stroke-width="${o.mine === p.owner ? '.15' : '.11'}" pointer-events="none"/>`;
        // Seat numbers distinguish ownership without reliance on colour alone.
        // Keep the marker in a fixed position independent of feature/condition icons.
        tiles += `<circle cx="${f3(hx.x - 0.46)}" cy="${f3(hx.y - 0.48)}" r=".19" fill="#160e23" stroke="#f7f0e3" stroke-width=".025" pointer-events="none"/>`;
        tiles += `<text class="owner-seat" x="${f3(hx.x - 0.46)}" y="${f3(hx.y - 0.41)}" font-size=".23" font-weight="900" text-anchor="middle" fill="#fff" pointer-events="none">${p.owner + 1}</text>`;
      }
      if (threats.has(hx.id)) tiles += `<polygon class="threat" points="${corners(hx, 0.92)}" fill="none" pointer-events="none"/>`;
      tiles += `<polygon class="${cls}"${data} points="${corners(hx, 0.97)}" fill="transparent"/>`;
      // Feature in the middle, condition top-right, health pips along the bottom.
      if (p.feature) {
        tiles += `<circle cx="${hx.x}" cy="${f3(hx.y - 0.05)}" r=".34" fill="#f7f0e3" fill-opacity=".92" stroke="#2a1d3b" stroke-width=".03" pointer-events="none"/>`;
        tiles += glyph(art, 'feature-' + p.feature, FEATURE_ICON[p.feature] || '❓', hx.x, hx.y - 0.05, 0.5);
      }
      if (p.condition) {
        tiles += `<circle cx="${f3(hx.x + 0.44)}" cy="${f3(hx.y - 0.5)}" r=".2" fill="#150e20" fill-opacity=".85" pointer-events="none"/>`;
        tiles += glyph(art, 'cond-' + (p.condition), CONDITION_ICON[p.condition] || '', hx.x + 0.44, hx.y - 0.5, 0.3);
      }
      for (let k = 0; k < 3; k++) {
        const filled = k < p.health;
        tiles += `<circle cx="${f3(hx.x - 0.2 + k * 0.2)}" cy="${f3(hx.y + 0.55)}" r=".075" fill="${filled ? '#f5c451' : '#150e20'}" stroke="#150e20" stroke-width=".025" pointer-events="none"/>`;
      }
    });

    // The TV replays one Pray at a time: display a moving, high-contrast
    // marker along its public source-to-destination path.
    if (o.prayEffect && o.prayEffect.from && o.prayEffect.to && byId[o.prayEffect.from] && byId[o.prayEffect.to]) {
      // Client topologies deliberately contain only serialisable arrays, not
      // the engine's private hexById index. Resolve positions from those arrays.
      const a = topo.hexes.find(h => h.id === o.prayEffect.from);
      const b = topo.hexes.find(h => h.id === o.prayEffect.to);
      if (a && b) {
        const path = `M ${f3(a.x)} ${f3(a.y)} L ${f3(b.x)} ${f3(b.y)}`;
        marks += `<path d="${path}" fill="none" stroke="#fff3a5" stroke-width=".11" stroke-dasharray=".15 .09" pointer-events="none"/>`;
        // SVG animateMotion is not governed by ordinary CSS transition rules.
        // Respect the operating system's reduced-motion setting directly.
        marks += o.reducedMotion
          ? `<circle cx="${f3(b.x)}" cy="${f3(b.y)}" r=".27" fill="#ffcf44" stroke="#20132b" stroke-width=".07" pointer-events="none"/>`
          : `<circle r=".27" fill="#ffcf44" stroke="#20132b" stroke-width=".07" pointer-events="none"><animateMotion path="${path}" dur="1s" fill="freeze"/></circle>`;
      }
    }

    if (o.ghost && o.ghost.at && byId[o.ghost.at]) {
      const h = topo.hexes.find(x => x.id === o.ghost.at);
      marks += `<polygon class="ghost ghost-hex" points="${corners(h, 0.97)}" fill="none" stroke="${o.ghost.colour}" stroke-width=".14"/>`;
    }

    return `<svg viewBox="${f3(B.minX)} ${f3(B.minY)} ${f3(B.w)} ${f3(B.h)}" role="img" aria-label="The neighbourhood">` +
      (defs ? `<defs>${defs}</defs>` : '') + tiles + marks + '</svg>';
  }

  /* Where a hex or corner sits inside the drawn board, as fractions (0..1) of its width and height. */
  function position(topo, id) {
    const B = bounds(topo);
    const h = topo.hexes.find(x => x.id === id) || topo.vertices.find(x => x.id === id) || topo.edges.find(x => x.id === id);
    if (!h) return null;
    return { fx: (h.x - B.minX) / B.w, fy: (h.y - B.minY) / B.h };
  }

  /* Turns /art.json into { slotName: url }. 'hex-turf.png' → art['hex-turf'] */
  /* If two files share a name (hex-turf.png and hex-turf.webp), the smaller,
     sharper format wins in a fixed order, never whichever the disk lists last. */
  const ART_PREFERENCE = ['webp', 'svg', 'png', 'jpg', 'jpeg'];
  function artMap(list) {
    const out = {};
    const rank = {};
    ((list && list.files) || []).forEach(f => {
      const m = /^(.+)\.([a-z0-9]+)$/i.exec(f);
      if (!m) return;
      const r = ART_PREFERENCE.indexOf(m[2].toLowerCase());
      const score = r < 0 ? ART_PREFERENCE.length : r;
      if (m[1] in rank && rank[m[1]] <= score) return;
      rank[m[1]] = score;
      out[m[1]] = '/img/' + encodeURIComponent(f);
    });
    return out;
  }

  /* 'music-intro.mp3' → { 'music-intro': '/audio/music-intro.mp3' } */
  function audioMap(list) {
    const out = {};
    ((list && list.audio) || []).forEach(f => { out[f.replace(/\.[a-z0-9]+$/i, '')] = '/audio/' + f; });
    return out;
  }

  global.RagnaBoard = { svg, gardenSvg, position, bounds, corners, artMap, audioMap, icon, FALLBACK, FEATURE_ICON, CONDITION_ICON, TERRAIN_COLOUR, RES_ICON };
})(typeof window !== 'undefined' ? window : globalThis);
