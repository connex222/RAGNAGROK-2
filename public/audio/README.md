# Sound and music slots

Drop files here with these exact names. Anything missing falls back automatically, so
the game is never silent: a dedicated file → its substitute's file → a code-made sound.

## Music (TV only)
| File | Plays |
|---|---|
| `music-intro.mp3` | Lobby, god draft, winner screen |
| `music-ambience.mp3` | During play |

## Sound effects
Name every file `sfx-<name>.mp3`. The full list, what each plays for in V2, and
what it borrows when missing is in the V2 Art & Audio pack PDF.

Rules: MP3, mono, under about 100 KB, silence trimmed from the start, similar loudness.

Check your names with `npm run test:audio`: it fails if a file has a space in its
name, or loads under a name nothing in the game asks for (usually a spelling slip).
The loader itself also ignores capital letters and stray spaces, as a safety net.

## V2 sound-control verification (dev.15)

The TV provides separate **Music** and **FX** toggles after the initial user gesture.
Both sound settings are stored in the browser. The phone provides a sound switch in Menu.
Audio may remain disabled until the user taps/clicks because browsers restrict autoplay.

A technical audit found `sfx-timerTick.mp3` lasts 10.11 seconds. The TV had
played it once every second in the last 10 seconds of planning, which stacked
multiple 10-second sounds. V2 now uses the short recorded `sfx-tap.mp3` for
intermediate ticks and retains the distinct `sfx-timeUp.mp3` for the final one.
The original 10-second file is retained for compatibility but is no longer
used in that repeated cue.

Use `node test/phase15-tv-audio.test.js` and, with local Playwright/Chromium,
`python test/phase15-audio-browser.py` to verify mute state, resumed fades and
phone/TV controls. Hardware loudness and music quality still require real
TV speakers and phone testing; the automated checks cannot judge them.
