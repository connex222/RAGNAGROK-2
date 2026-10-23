# RAGNAGROK — Phase 4 Development and QA Report

**Build:** 1.2.0-dev.4  
**Date:** 23 October 2026  
**Input:** v1.2.0-dev.3 release ZIP  
**Release status:** Internal playtest development build — **not** live-multiplayer certified.

## Changes actually implemented

| Area | Before | After | Files |
|---|---|---|---|
| Sympathy Vote privacy | All players and the TV received the three random choices in their raw public state, although the UI displayed them only to the chooser | Public state excludes the options; they appear only in the authorised chooser's private state | `src/engine/garden.js` |
| Full-match protocol QA | Unit tests and protocol regressions did not drive a complete four-to-eight-player match through the real handler layer | Dependency-free full nine-round Standard matches run with 2, 4, 6 and 8 simulated controllers through the actual engine/room/handler code, including reconnect, Pray, Sympathy Vote, scoring and rematch | `test/phase4-protocol.test.js`, `package.json` |
| Game interaction browser QA | Chromium scripts inspected layouts and one action button with mocked state | A second Chromium suite uses engine-generated state to click through Pray targeting, Sympathy Vote choices in both themes and final rematch, verifying emitted commands and lack of overflow | `test/phase4-browser.py`, `reports/phase4/` |
| Show race border | Phone CSS used `--gold` without defining it | Defined a visible accent colour in both dusk and daylight themes | `public/v2/play.html` |
| Narrow-phone resource labels | Minimum type size 9px | Increased to 10px with full text retained at tested viewports | `public/v2/play.html` |
| Versioning/documentation | dev.3 | dev.4; README, changelog, package lock and client compatibility guards updated, with explicit test limitations | `package.json`, `package-lock.json`, `README.md`, `CHANGELOG.md`, both V2 screens, `docs/PHASE4-VALIDATION.md` |

There are **no new npm dependencies**, no changes to player costs or god powers, no changes to scoring or RNG, and no saved-game schema change.

## Verification performed

| Check | Result | Important limitation |
|---|---|---|
| `npm run test:offline` | Passed | Includes all V2 offline suites and 4-player protocol full match |
| `npm run test:protocol-acceptance` | Passed: 2/4/6/8 players | Simulated Socket.io objects, not real network packets |
| `npm run test:modes` | Passed: 63 games | Robot smoke tests, not balance certification |
| `node test/sim.js 24` | Passed: 24 archived V1 games | Simulation, not live V1 browser session |
| `python test/phase3-visual.py` | Passed: six Chromium layouts | Uses fake authorised state and sockets |
| `python test/phase4-browser.py` | Passed: six Chromium interactions | Uses real phone UI scripts but fake network |
| `node test/server2.test.js` | Could not execute | `socket.io-client` unavailable; `npm ci` could not complete |
| Real phones, TV, WAN, mobile handoff and audio | Not attempted | Requires physical test environment |
| Observed repeat play / enjoyment | Not measured | Requires actual people and playtest sessions |

## Full-match protocol detail

Each run uses the real `server/rooms.js` and `server/handlers.js` plus the actual authoritative V2 engine. The test creates a TV host and multiple phone connections; selects gods; submits and locks actions; disconnects a player in the planning phase; rejoins on a different simulated socket; verifies the planned actions survive; resends a previously acknowledged command and checks state has not mutated; resolves forecasts, actions and Garden Shows via timer advancement; handles the Sympathy Vote and verifies its options are private; reaches final scoring; starts a rematch and verifies seats and replay cache. Tests were executed for 2, 4, 6 and 8 seats, with 17, 35, 53 and 71 submitted plans respectively.

**The test does not exercise the Engine.IO handshake, web transport, actual dropped packets, QR scanning, network rejoin under physical phone sleep, reverse-proxy behaviour, or real persistent-storage restarts.** Those remain acceptance gates.

## Quality gates and next phase

1. On a machine with npm registry access, run `npm ci && npm test` and fix any *actual* Socket.io/browser test failures. CI can serve as an additional independent environment.
2. Conduct one entire game at 2, 4, 6 and 8 physical controllers, using a TV in another browser/device. Test disconnection at start of plan, after submitting a plan and after lock, phone sleep, Wi-Fi-to-cellular handoff, host pause/resume, and server restart with a durable `SAVE_DIR`.
3. Run independent first-time player playtests with documented enjoyment ratings, planning times, comprehension and voluntary rematches. Only afterwards adjust difficulty, god balance and action costs.
4. Perform real accessibility testing including enlarged fonts, screen-reader navigation, contrast and viewing distance.

**Decision:** dev.4 can proceed to controlled device testing. Production launch is blocked until live Socket.io and real player tests pass.
