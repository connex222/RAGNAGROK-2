# RAGNAGROK — Audio reliability audit (dev.15)

**24 October 2026 · Internal playtest build; not a release certificate.**

## Confirmed browser defects repaired

1. `public/sfx.js` used a top-level `const SFX`, not `window.SFX`; both phone and TV gate all sound calls on `window.SFX`. This could make every recorded or synthesised effect silent despite correct assets. Explicit browser export added and exercised in real Chromium.
2. TV `Music.unlock()` ran on every pointerdown/keydown, resetting the current track and starting redundant fades. It now returns after first unlock.
3. Volume fades overlapped when Music was toggled rapidly, and an old fade-out could pause the newly resumed track. Each fade now invalidates older scheduled frames for that track.
4. TV had a music toggle but no persistent switch to mute sound effects. The TV now offers an independently accessible FX button. Phone Menu continues to offer a separate phone mute.
5. The recorded timerTick effect lasts 10.11 seconds but was triggered every second over the final ten seconds of planning. The TV now uses an existing 0.24-second recorded tap for each warning, and plays the distinct timeUp cue at zero. The 10.11-second recording remains in assets but is not requested by the countdown.

## Asset measurements (technical, not aesthetic quality scores)

- 53 `sfx-*.mp3` recordings, 2 looping `music-*.mp3` tracks; every referenced sound has a mapped file or synth fallback. Both music files decode in ffprobe.
- `music-intro.mp3`: 182.62 seconds; first 12-second sample mean −22.3 dBFS, peak −0.4 dBFS.
- `music-ambience.mp3`: 189.84 seconds; first 12-second sample mean −19.0 dBFS, peak −0.8 dBFS.
- `sfx-win.mp3`: 4.27 seconds; mean −16.5 dBFS, peak 0.0 dBFS.
- `sfx-emergency.mp3`: mean −19.5 dBFS, peak −9.6 dBFS.
- `sfx-tap.mp3`: 0.24 seconds; mean −32.5 dBFS, peak −6.9 dBFS.
- `sfx-timerTick.mp3`: 10.11 seconds; first 12-second sample mean −13.5 dBFS, peak 0.0 dBFS; not suitable for playback ten times in ten seconds.

Measurements were made with `ffprobe` for durations and `ffmpeg volumedetect` for levels. These are simple peak/RMS indicators, **not** EBU R128 integrated loudness or human listening tests. A 0 dBFS peak does not itself prove audible clipping.

## Reproducible verification

- `npm run test:offline` — passed, including actual Music controller and window export contract.
- `node test/modes-smoke.js` — 63 games completed.
- `python test/phase3-visual.py` — six Chromium layout checks passed.
- `python test/phase15-audio-browser.py` — six Chromium sound-control checks passed with synthetic game views.

**Still open:** hardware volume and loudness matching, user perception of cue quality, browser-specific autoplay on real iPhone/Android/TV, music crossover on actual speakers, and Render deployment. No new music or audio recordings were generated.
