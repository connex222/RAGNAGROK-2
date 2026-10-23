# Phase 5 — First-time enjoyment and actual multiplayer CI

**Build:** 1.2.0-dev.5 · 23 October 2026  
**Status:** Code validated offline and with headless Chromium; actual CI and physical multiplayer must be separately confirmed.

## Why this phase

The previous commit `962a76ec7aa36467dbdaadd5b200f62e56397f47` exposed a genuine test-suite failure in GitHub Actions. All V2 engine, room and **real Socket.io server** checks passed, including the restart/rejoin/full nine-round test. The following JSDOM phone acceptance test then failed because it still asserted that Long was the default. The game itself had correctly switched to Standard in v1.2.0-dev.1. This test needed updating to match the authoritative rules before CI could validate the remainder of the phone UI.

## Implemented

1. **CI acceptance test repairs:** `test/ui2.test.js` now asserts that Standard is the default. It also explicitly changes to Extended, verifies state on all three phones and switches back to Standard. Its tap-based robot understands the **Pray destination picker** and **Sympathy Vote** so that the new mechanics do not appear to be a permanent UI stall.
2. **First-round guide:** An optional first-turn card recommends Cultivate, Claim, Tend or Car-Boot according to the current player's available legal targets and affordable supplies. The button opens the actual action picker; **it never commits, spends resources, or chooses automatically**. This is a first-round shortcut only, and it respects Hide Tips.
3. **Accessible status and keyboard operation:** Phone phase changes are announced in an offscreen `aria-live="polite"` element; countdown seconds are not re-announced. `Tab` and `Shift+Tab` cycle within an open sheet/dialog, and `Escape` closes it. Reduced-motion settings suppress incidental animations and transitions.
4. **Browser evidence:** Added `test/phase5-browser.py`, which uses Chromium to test the coach, real keyboard focus, no automatic action submission and no horizontal overflow at 320px, 375px and 430px. Its snapshots and fake socket are generated from the actual V2 engine, but **it is not a real network test**.
5. **Regression suite:** Added `test/phase5-first-run.test.js` with eight dependency-free checks. Adjusted the existing UX test to assert Escape functionality rather than a brittle exact old conditional shape.

No gameplay probabilities, scores, RNG, action costs, content, server protocol, persisted room format or npm dependencies have changed.

## Verification matrix

| Gate | Method | Status |
| --- | --- | --- |
| V2 engine/unit, protocol, security, assets and interface contracts | `npm run test:offline` | Passed |
| First-session and accessibility contracts | `npm run test:phase5` | Passed (8 cases) |
| V2 match progression, three modes, 2–8 players | `npm run test:modes` | Passed (63 matches) |
| Handler + engine full matches | `npm run test:protocol-acceptance` | Passed (2/4/6/8 seats) |
| V1 archive simulations | `node test/sim.js 24` | Passed (24 matches) |
| Phone first-move guide and modal in Chromium | `python test/phase5-browser.py` | Passed (3 widths, stub socket) |
| Live Socket.io + browser test runner | GitHub Actions `npm ci && npm test` | **Pending new CI run** |
| Physical TV + phones and real home Wi-Fi/WAN | Independent manual test | **Not performed** |
| Human fun, clarity, and actual voluntary rematches | Independent observed sessions | **Not measured** |

### Proposed *physical* acceptance checklist

Use two first-time players and an independent observer before testing larger groups. Record the actual build and results in the existing anonymous playtest CSVs.

1. On the TV, create a room, enable sound, check that Rules and the QR code are clearly visible from three metres. Join with two phones, including a narrow-screen phone.
2. Without coaching, ask each person to explain what an action slot does, what a forecast means, how to see Show categories and how to lock. Time the attempt, not the explanation.
3. Check that the optional first-round guide is helpful but does not make a choice for the player. Test the rules dialog with a keyboard or switch control, daylight/dusk, text zoom and reduced-motion settings.
4. Have one phone sleep, disconnect, and rejoin while a plan is entered, then after lock. Confirm the plan is preserved and the reconnecting player sees only their private state. Repeat over WAN or a mobile connection.
5. Complete all nine Standard rounds with Pray, Meddle, a Sympathy Vote, an emergency, one Garden Show and the final trophy. Test TV host pause/resume and optional Skip. Check that sounds actually play on the connected speakers.
6. Rematch immediately using the existing host control. Record whether players choose to stay (observed), not only whether they say they would.
7. Repeat with 4, 6 and 8 **physical** controllers after the two-player experience is stable, including a real process restart with durable `SAVE_DIR`.

### No-go conditions

Any unauthorised private data visible on other phones/TV; unacknowledged plan loss; inability to recover a dropped controller; a round advancing while every player is disconnected; a keyboard user trapped outside or behind a modal; unexplainable scoring discrepancies; a reproducible live networking failure. A passing scripted browser test does not waive these checks.

**Gameplay balance:** unchanged in Phase 5. The v1.2.0-dev.2 benchmark remains the current balance evidence. Do not claim measured higher enjoyment until physical playtests have taken place.
