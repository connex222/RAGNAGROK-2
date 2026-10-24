'use strict';
/* Real TV Music/audio controller methods exercised without browser or npm dependencies. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '../public/v2/index.html'), 'utf8');
const sharedSfx = fs.readFileSync(path.join(__dirname, '../public/sfx.js'), 'utf8');
assert.match(sharedSfx, /window\.SFX = SFX/);
const browserAudio = { window: {}, localStorage: { getItem: () => null, setItem() {} }, document: {hidden: false}, navigator: {}, console };
vm.runInNewContext(sharedSfx, browserAudio, { filename: 'public/sfx.js' });
assert.equal(typeof browserAudio.window.SFX.play, 'function', 'browser sound API must exist on window');
assert.equal(typeof browserAudio.window.SFX.setMuted, 'function');
for (const [, inline] of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))
  new vm.Script(inline, { filename: 'v2/index.html' });
const slice = (first, end) => {
  const i = html.indexOf(first), j = html.indexOf(end, i + first.length);
  assert.ok(i >= 0 && j > i, 'Missing sound controller ' + first);
  return html.slice(i, j);
};
const buttons = Object.fromEntries(['#musicBtn', '#effectsBtn', '#soundGate'].map(sel =>
  [sel, { hidden: sel !== '#soundGate', textContent: '', attrs: {}, handlers: {},
    setAttribute(k,v) { this.attrs[k] = v; }, addEventListener(type,handler) { this.handlers[type] = handler; } }]));
const sounds = { muted: false, setMuted(v) { this.muted = v; }, isMuted() { return this.muted; }, unlock() {} };
let now = 0;
let scheduled = [];
const tracks = [];
class Audio {
  constructor(src) { this.src = src; this.volume = 0; this.playCalls = 0; this.pauseCalls = 0; this.paused = true; tracks.push(this); }
  play() { this.playCalls++; this.paused = false; return Promise.resolve(); }
  pause() { this.pauseCalls++; this.paused = true; }
}
const store = {get(){return false;},set() {}};
const vmCtx = {window:{SFX:sounds},store,MUSIC_KEY:'ragnagrok.tvMusicOff',view:{meta:{paused:false},phase:{stage:'lobby'}},Audio,
 $:sel => { assert.ok(buttons[sel]); return buttons[sel]; }, WeakMap, Object, console,
 performance:{now:()=>now}, requestAnimationFrame(fn){scheduled.push(fn);}};
vm.createContext(vmCtx);
vm.runInContext(slice('function updateEffectsButton()', "$('#soundGate').addEventListener('click', unlockSound);"), vmCtx);
vm.runInContext(slice('const Music = {', "$('#musicBtn').addEventListener('click'"), vmCtx);
vm.runInContext('this.music = Music; updateEffectsButton();',vmCtx);
const m = vmCtx.music;
assert.equal(buttons['#effectsBtn'].hidden, false);
assert.equal(buttons['#effectsBtn'].attrs['aria-pressed'], 'false');
vmCtx.toggleEffects();
assert.equal(sounds.muted, true);
assert.equal(buttons['#effectsBtn'].attrs['aria-pressed'], 'true');
assert.equal(buttons['#effectsBtn'].attrs['aria-label'], 'Enable sound effects');
vmCtx.toggleEffects();
assert.equal(sounds.muted, false);
assert.equal(buttons['#effectsBtn'].attrs['aria-pressed'], 'false');
function frames(amount = 2400) {
  for (let i=0; i < amount/100 && scheduled.length; i++) {
    now += 100;
    const q = scheduled; scheduled = [];
    q.forEach(fn => fn(now));
  }
}
m.load({'music-intro':'/audio/music-intro.mp3','music-ambience':'/audio/music-ambience.mp3'});
assert.equal(tracks.length,2);
m.unlock();
frames();
const intro = m.tracks.intro;
assert.equal(intro.playCalls,1,'initial unlock starts lobby track once');
assert.ok(intro.volume > 0.54);
m.unlock();m.unlock();m.unlock();
frames();
assert.equal(intro.playCalls,1,'subsequent gestures must not restart music');
m.toggle();
frames(200);
assert.equal(m.off,true);
m.toggle();
frames();
assert.equal(m.off,false);
assert.equal(intro.paused,false,'stale fade-out must not pause resumed track');
assert.ok(intro.volume > 0.54,'music should actually recover its intended volume');
vmCtx.view.phase.stage='playing';
m.update();frames();
assert.equal(intro.paused,true,'intro should stop after stage transition');
assert.equal(m.tracks.ambience.paused,false,'gameplay ambience must play');
assert.ok(m.tracks.ambience.volume > 0.27);
m.toggle();frames();
assert.equal(m.tracks.ambience.paused,true,'Music mute must stop active track');
m.toggle();frames();
assert.equal(m.tracks.ambience.paused,false,'Music unmute must resume track');
assert.match(html,/sfx\(left === 0 \? 'timeUp' : 'tap'\)/);
assert.doesNotMatch(html,/sfx\(left === 0 \? 'timeUp' : 'timerTick'\)/);
assert.match(html,/id="effectsBtn"[^>]*aria-label="Mute sound effects"/);
console.log('✔ TV effects mute / music idempotent unlock / overlapping fade cancellation / timer cue');
