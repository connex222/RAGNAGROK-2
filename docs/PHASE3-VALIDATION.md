# Phase 3 — Multiplayer and playability validation

**Build:** 1.2.0-dev.3 · **23 October 2026**

## Verified changes

The offline suite, seeded mode simulations and real-Chromium *layout-only* tests are executable locally. The browser harness constructs an authoritative snapshot using `src/engine/garden.js`, injects a fake Socket.io client and renders the actual television and phone HTML/CSS/JavaScript. It does **not** send any real socket packets or reproduce mobile network failures.

| Screen | Viewport | Headless Chromium result |
|---|---|---|
| First-time phone join | 320 × 690 | All 12 avatars displayed, no horizontal overflow |
| Player planning | 320 × 690 | Layout fits; action CTA opens and closes the planning picker |
| Player planning | 375 × 690 | Layout fits; action CTA works |
| Player planning | 430 × 690 | Layout fits; action CTA works |
| Shared TV | 1280 × 720 | Layout fits; controls separated from timeline and timer |
| Shared TV | 1920 × 1080 | Layout fits; controls separated from timeline and timer |

No uncaught browser script errors occurred during these scripted views. Screenshots are in `reports/phase3/`.

## Reproduce

```bash
npm run test:offline
npm run test:modes
node test/sim.js 24
```

Optional Chromium layout verification requires a local Python installation with `playwright`, plus a Chromium/Google Chrome binary (or Playwright's downloaded Chromium). There are no new npm packages:

```bash
python -m pip install playwright
python -m playwright install chromium  # only if Chromium is not already installed
python test/phase3-visual.py
```

Actual socket/browser suite remains:

```bash
npm ci
npm test
```

**Known blocker:** the npm registry DNS lookup returned `EAI_AGAIN` in the current environment; package installation was incomplete. `npm test` therefore could not run. Never count the fake-socket Chromium render as a live Socket.io pass.

## Live multiplayer acceptance checklist — still to perform

Use a TV and 2, then 4, 6 and 8 separate phones across at least two households/networks. This is not an optional substitute for human testing.

- Create room, join all seats, choose gods, play a Standard game to final scoring and rematch.
- At planning start, disconnect the host phone, reconnect and verify its existing plan survives; test reconnect immediately after lock as well.
- Disconnect all phones while planning: the game must pause. Reconnect all: the timer should continue with its intended remaining time.
- Manually pause and then disconnect all phones, leaving the TV running: verify the match is not immediately removed; verify normal idle cleanup after configured `IDLE_MINUTES`.
- Sleep a phone, switch Wi-Fi to mobile data, reopen browser tab and verify the seat token is not lost on a temporary timeout.
- During a lost acknowledgement, retry the identical `requestId`: the action must not execute twice.
- Test host pause, resume, skip, final awards, rematch and actual audio playback.
- At 320px phone width, verify that labels, action picker, forecast and Save/Back buttons are reachable without horizontal scrolling.
- From 2–3m away on a 40-inch TV, have a new player read the current round, the affected garden plots and the announced Show category without help.
- With `SAVE_DIR` on durable storage, restart the server mid-match, reconnect the TV and players, and finish the restored game.
- Play a complete match with a visually impaired or colour-blind participant if possible; note contrast, seat number legibility and reliance on colour.

## Human enjoyment / replayability testing — still to perform

The team must not infer enjoyment from a clean simulation. Record at least two four-player sessions and two eight-player sessions. Collect anonymous 1–5 ratings for decision clarity, disaster fairness, agency, enjoyment while losing and endgame satisfaction. Observe genuine voluntary rematches separately from survey intentions. Capture timing, abandonment and failures. Use `docs/PLAYTEST.md` and its CSV templates.

**Go/no-go:** do not ship publicly while real multiplayer acceptance or human playtesting remains unverified. Do not claim improved balance; this build deliberately leaves the dev.2 gameplay values untouched.
