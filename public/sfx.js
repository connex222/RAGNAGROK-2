/* Ragnagrok SFX — every sound is synthesised in code with the Web Audio API.
   No audio files, no downloads, no licences.

   Usage:
     SFX.unlock();                 // call once inside a tap/click handler (browsers require this)
     SFX.play('dice');
     SFX.play('production', { resources: ['turf', 'compost'] });
     SFX.setVolume(0.6);           // 0..1, saved to localStorage
     SFX.setMuted(true);           // saved to localStorage
     SFX.vibrate([60, 40, 60]);    // Android only; silently ignored elsewhere

   Recorded files (optional, add any time):
     SFX.loadFiles({
       dice:  '/sfx/dice.mp3',
       mower: { url: '/sfx/mower.mp3', gain: 0.8 }   // gain evens out loud files
     });
   A loaded file replaces the synth sound of the same name.
   Missing or broken files fall back to the synth automatically.
*/
const SFX = (() => {
  const STORE_KEY = 'ragnagrok.sfx';
  let ctx = null;
  let master = null;
  let noiseBuf = null;

  let settings = { volume: 0.7, muted: false, vibration: true };
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (saved && typeof saved.volume === 'number') settings = { ...settings, ...saved };
  } catch (e) { /* storage unavailable: keep defaults */ }

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(settings)); } catch (e) { /* ignore */ }
  }

  function init() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = settings.muted ? 0 : settings.volume;
    master.connect(ctx.destination);

    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return ctx;
  }

  function unlock() {
    if (!init()) return;
    if (ctx.state === 'suspended') ctx.resume();
  }

  // Attack/decay envelope. Exponential ramps cannot reach 0, so 0.0001 stands in for silence.
  function env(gainNode, start, attack, decay, peak) {
    gainNode.gain.setValueAtTime(0.0001, start);
    gainNode.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), start + attack);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, start + attack + decay);
  }

  function tone({
    f = 440, type = 'sine', t = 0, a = 0.005, d = 0.2, peak = 0.3,
    slideTo = null, detune = 0, filter = null, vib = null, trem = null
  } = {}) {
    const start = ctx.currentTime + t;
    const end = start + a + d + 0.05;

    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f, start);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + a + d);
    osc.detune.value = detune;

    let node = osc;
    if (filter) {
      const fl = ctx.createBiquadFilter();
      fl.type = filter.type || 'lowpass';
      fl.frequency.value = filter.f || 1000;
      fl.Q.value = filter.q || 0.7;
      node.connect(fl);
      node = fl;
    }

    if (trem) {
      const tg = ctx.createGain();
      tg.gain.value = 1 - trem.depth;
      const lfo = ctx.createOscillator();
      lfo.type = 'square';
      lfo.frequency.value = trem.rate;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = trem.depth;
      lfo.connect(lfoGain).connect(tg.gain);
      lfo.start(start);
      lfo.stop(end);
      node.connect(tg);
      node = tg;
    }

    if (vib) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = vib.rate;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = vib.depth;
      lfo.connect(lfoGain).connect(osc.frequency);
      lfo.start(start);
      lfo.stop(end);
    }

    const g = ctx.createGain();
    env(g, start, a, d, peak);
    node.connect(g).connect(master);
    osc.start(start);
    osc.stop(end);
  }

  function noise({
    t = 0, a = 0.002, d = 0.1, peak = 0.3, type = 'bandpass', f = 1000, q = 1, fTo = null
  } = {}) {
    const start = ctx.currentTime + t;
    const dur = a + d + 0.05;

    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;

    const fl = ctx.createBiquadFilter();
    fl.type = type;
    fl.frequency.setValueAtTime(f, start);
    if (fTo) fl.frequency.exponentialRampToValueAtTime(fTo, start + a + d);
    fl.Q.value = q;

    const g = ctx.createGain();
    env(g, start, a, d, peak);
    src.connect(fl).connect(g).connect(master);

    const maxOffset = Math.max(0, noiseBuf.duration - dur);
    src.start(start, Math.random() * maxOffset);
    src.stop(start + dur);
  }

  // One note per resource so players learn what they got by ear.
  const RESOURCE_NOTE = {
    compost:    { f: 196, type: 'triangle' }, // low and murky
    turf:       { f: 392, type: 'triangle' },
    sprinklers: { f: 440, type: 'sawtooth', filter: { type: 'lowpass', f: 1400 } },
    fertilizer: { f: 523, type: 'sine' },
    gnomeDust:  { f: 784, type: 'sine' }      // high sparkle
  };

  const SOUNDS = {
    /* ---------- TV (public) ---------- */

    dice() {
      for (let i = 0; i < 8; i++) {
        noise({ t: i * 0.06 + Math.random() * 0.02, d: 0.04, peak: 0.25, f: 2000 + Math.random() * 2000, q: 2 });
      }
      tone({ f: 120, slideTo: 60, t: 0.55, d: 0.15, peak: 0.5 });
      tone({ f: 110, slideTo: 55, t: 0.63, d: 0.15, peak: 0.45 });
    },

    production({ resources = [] } = {}) {
      const unique = [...new Set(resources)].slice(0, 5);
      unique.forEach((r, i) => {
        const n = RESOURCE_NOTE[r];
        if (!n) return;
        tone({ ...n, t: i * 0.09, a: 0.004, d: 0.35, peak: 0.18 });
        tone({ f: n.f * 2, type: 'sine', t: i * 0.09, d: 0.25, peak: 0.06 });
      });
    },

    mower() {
      tone({
        f: 55, slideTo: 150, type: 'sawtooth', a: 0.15, d: 1.3, peak: 0.28,
        filter: { type: 'lowpass', f: 700, q: 3 }, trem: { rate: 28, depth: 0.4 }
      });
      noise({ a: 0.2, d: 1.2, peak: 0.25, type: 'lowpass', f: 300, fTo: 900 });
    },

    steal() {
      noise({ d: 0.25, peak: 0.3, f: 600, fTo: 4500, q: 4 });
      tone({ f: 900, slideTo: 300, t: 0.18, d: 0.12, peak: 0.08 });
    },

    buildPath() {
      noise({ d: 0.12, peak: 0.4, type: 'lowpass', f: 500 });
      tone({ f: 90, slideTo: 50, d: 0.1, peak: 0.35 });
    },

    buildShack() {
      [0, 0.12].forEach(t => {
        tone({ f: 320, slideTo: 200, type: 'triangle', t, d: 0.06, peak: 0.35 });
        noise({ t, d: 0.03, peak: 0.2, f: 1200, q: 3 });
      });
    },

    buildManor() {
      tone({ f: 80, slideTo: 40, d: 0.3, peak: 0.6 });
      noise({ d: 0.2, peak: 0.3, type: 'lowpass', f: 400 });
      [262, 330, 392].forEach(f => tone({ f, t: 0.1, a: 0.02, d: 0.7, peak: 0.1 }));
    },

    sinkhole() {
      noise({ a: 0.3, d: 1.1, peak: 0.5, type: 'lowpass', f: 180 });
      tone({ f: 70, slideTo: 28, a: 0.2, d: 1.1, peak: 0.4 });
      tone({ f: 100, slideTo: 40, t: 1.15, d: 0.25, peak: 0.6 });
      noise({ t: 1.15, d: 0.2, peak: 0.4, type: 'lowpass', f: 600 });
    },

    award() {
      [523, 659, 784, 1047].forEach((f, i) => {
        tone({ f, type: 'square', t: i * 0.1, d: i === 3 ? 0.6 : 0.2, peak: 0.08, filter: { f: 2500 } });
      });
    },

    tradeOffer() {
      tone({ f: 880, d: 0.5, peak: 0.2 });
      tone({ f: 698, t: 0.35, d: 0.7, peak: 0.2 });
    },

    tradeAccepted() {
      noise({ d: 0.02, peak: 0.2, type: 'highpass', f: 3000 });
      tone({ f: 1319, t: 0.03, d: 0.15, peak: 0.15 });
      tone({ f: 1760, t: 0.12, d: 0.4, peak: 0.15 });
    },

    turnStart() {
      // Gong: inharmonic partials with long, staggered decays.
      [[110, 0.3, 2.2], [262, 0.12, 1.6], [370, 0.08, 1.2], [523, 0.04, 0.8]].forEach(([f, peak, d]) => {
        tone({ f, a: 0.01, d, peak });
      });
    },

    win() {
      // Kazoo fanfare for the Golden Flamingo.
      const melody = [[392, 0.18], [523, 0.18], [659, 0.18], [784, 0.5], [659, 0.15], [784, 0.9]];
      let t = 0;
      melody.forEach(([f, d]) => {
        tone({
          f, type: 'sawtooth', t, a: 0.02, d, peak: 0.14,
          filter: { type: 'bandpass', f: 1200, q: 2 }, vib: { rate: 6, depth: 8 }
        });
        t += d * 0.9;
      });
      [392, 494, 587].forEach(f => tone({ f, t, a: 0.05, d: 1.2, peak: 0.07 }));
    },

    /* ---------- Phone (private) ---------- */

    yourTurn() {
      tone({ f: 660, type: 'triangle', d: 0.15, peak: 0.3 });
      tone({ f: 990, type: 'triangle', t: 0.13, d: 0.35, peak: 0.3 });
    },

    offerIn() {
      tone({ f: 400, slideTo: 900, d: 0.06, peak: 0.25 });
    },

    denied() {
      tone({ f: 140, type: 'square', d: 0.15, peak: 0.12, filter: { f: 900 } });
      tone({ f: 130, type: 'square', d: 0.15, peak: 0.12, filter: { f: 900 } });
    },

    tap() {
      noise({ d: 0.015, peak: 0.15, type: 'highpass', f: 3000 });
    },

    discardAlarm() {
      [880, 660, 880, 660].forEach((f, i) => {
        tone({ f, type: 'square', t: i * 0.16, d: 0.12, peak: 0.1, filter: { f: 2000 } });
      });
    }
  };

  /* ---------- Recorded files (optional) ----------
     Any sound loaded here replaces the synth version of the same name.
     Anything not loaded, or that fails to load, keeps using the synth. */
  const buffers = {};
  const fileGain = {};

  async function loadFiles(map) {
    if (!init()) return {};
    const report = {};
    await Promise.all(Object.entries(map).map(async ([name, entry]) => {
      const url = typeof entry === 'string' ? entry : entry.url;
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.arrayBuffer();
        buffers[name] = await ctx.decodeAudioData(data);
        fileGain[name] = typeof entry === 'object' && typeof entry.gain === 'number' ? entry.gain : 1;
        report[name] = 'file';
      } catch (e) {
        console.warn('SFX: could not load', name, url, e.message);
        report[name] = 'synth';
      }
    }));
    return report;
  }

  function playBuffer(name) {
    const src = ctx.createBufferSource();
    src.buffer = buffers[name];
    const g = ctx.createGain();
    g.gain.value = fileGain[name];
    src.connect(g).connect(master);
    src.start();
  }

  /* Fallback chain for every sound name the game uses:
       1. a recorded file with that exact name (public/audio/sfx-<name>.mp3)
       2. the substitute listed here (its file if present, otherwise its code-made sound)
       3. the code-made sound of the same name
     So V2 moments can borrow files made for v0.5.1, and a missing file is never silent. */
  const ALIASES = {
    tend: 'buildPath', claim: 'buildShack', cultivate: 'buildManor', meddle: 'steal',
    carBoot: 'bankTrade', bankTrade: 'tradeAccepted', shelter: 'buildPath',
    lockIn: 'perkBought', perkBought: 'tap', compost: 'discard', discard: 'tap',
    resolveStart: 'dice', disasters: 'mower', harvest: 'production', showJudged: 'award', showFanfare: 'award',
    emergency: 'discardAlarm', emergencyWon: 'award', emergencyLost: 'denied',
    actChange: 'turnStart', omens: 'turnStart', planStart: 'yourTurn', featureLost: 'sinkhole', finalReveal: 'vpReveal',
    'disaster-frost': 'disasters', 'disaster-fire': 'disasters', 'disaster-flood': 'disasters', 'disaster-gnomes': 'disasters',
    timerTick: 'tap', timeUp: 'denied', gameStart: 'turnStart', playerJoined: 'tap', factionChosen: 'buildShack',
    pause: 'denied', resume: 'turnStart', reconnect: 'offerIn', vpReveal: 'award', tradeDeclined: 'denied',
    mowerParked: 'tap', militia: 'steal', binDay: 'tradeAccepted', bumperCrop: 'production', mulchSpreader: 'buildPath',
    'power-thor': 'award', 'power-loki': 'steal', 'power-freya': 'production', 'power-hel': 'denied',
    'power-odin': 'sinkhole', 'power-heimdall': 'turnStart', 'power-frigg': 'tradeAccepted', 'power-njord': 'production'
  };

  /* Which source would play for a name: 'file:x', 'synth:x' or null. */
  function resolve(name, depth = 0) {
    if (buffers[name]) return 'file:' + name;
    if (depth < 4 && ALIASES[name]) {
      const via = resolve(ALIASES[name], depth + 1);
      if (via) return via;
    }
    if (SOUNDS[name]) return 'synth:' + name;
    return null;
  }

  /* Loads every sfx-*.mp3 the server lists (from /art.json) under its name. */
  /* Filenames are forgiving: 'sfx-offerin.mp3' or 'sfx-actChange .mp3' still
     load as offerIn / actChange, so a typo in a filename never silences a sound. */
  function canonicalName(raw) {
    const name = String(raw).trim();
    const lower = name.toLowerCase();
    const known = [...Object.keys(SOUNDS), ...Object.keys(ALIASES), ...Object.values(ALIASES)];
    return known.find(k => k.toLowerCase() === lower) || name;
  }
  function loadFromList(audioList) {
    const map = {};
    (audioList || []).forEach(f => {
      const m = /^sfx-(.+?)\s*\.(mp3|m4a|ogg|wav)$/i.exec(f);
      if (m) map[canonicalName(m[1])] = '/audio/' + encodeURIComponent(f);
    });
    return Object.keys(map).length ? loadFiles(map) : Promise.resolve({});
  }

  // Vibration lives here so it still fires when a recorded file replaces the synth.
  const VIBE = {
    yourTurn: [80, 60, 120],
    discardAlarm: [200, 100, 200]
  };

  function play(name, opts = {}) {
    // Vibration has its own setting, so it still works with the sound muted.
    if (VIBE[name] && !(document.hidden && opts.playWhenHidden !== true)) vibrate(VIBE[name]);
    if (settings.muted) return;
    if (!init()) return;
    if (document.hidden && opts.playWhenHidden !== true) return;
    if (ctx.state === 'suspended') ctx.resume();
    const src = resolve(name);
    if (!src) return;
    const [kind, key] = src.split(':');
    if (kind === 'file') { playBuffer(key); return; }
    try { SOUNDS[key](opts); } catch (e) { console.warn('SFX error', name, e); }
  }

  function setVolume(v) {
    settings.volume = Math.min(1, Math.max(0, Number(v) || 0));
    save();
    if (master && !settings.muted) master.gain.setTargetAtTime(settings.volume, ctx.currentTime, 0.02);
  }

  function setMuted(m) {
    settings.muted = !!m;
    save();
    if (master) master.gain.setTargetAtTime(settings.muted ? 0 : settings.volume, ctx.currentTime, 0.02);
  }

  function setVibration(on) {
    settings.vibration = !!on;
    save();
  }

  function vibrate(pattern) {
    if (!settings.vibration) return;
    if (navigator.vibrate) { try { navigator.vibrate(pattern); } catch (e) { /* ignore */ } }
  }

  return {
    unlock,
    play,
    loadFiles,
    setVolume,
    setMuted,
    vibrate,
    setVibration,
    isVibration: () => settings.vibration !== false,
    getVolume: () => settings.volume,
    isMuted: () => settings.muted,
    list: Object.keys(SOUNDS),
    aliases: ALIASES,
    resolve,
    loadFromList,
    canonicalName,
    _setBuffer: (name, buf) => { buffers[name] = buf; }
  };
})();

if (typeof module !== 'undefined') module.exports = SFX;
