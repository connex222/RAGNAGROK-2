# Phase 4 — Protocol and interaction acceptance

**Build:** 1.2.0-dev.4 · 23 October 2026 · **Internal testing edition**

## Scope and changes

The focus of this phase is **integrated gameplay through the existing application interfaces**, not new game rules or economic rebalancing. Two missing verification layers are added:

1. **Full protocol + real rules, without external packages:** `test/phase4-protocol.test.js` attaches the *real* `server/handlers.js` to the *real* `server/rooms.js`, with simulated Socket.io controllers. For 2, 4, 6 and 8 seats it creates a room, joins players, chooses gods, submits plans, tests a plan that survives a mid-planning disconnect/reconnect, verifies repeated request IDs cannot reapply actions, advances the authoritative timer, selects Sympathy Vote categories, processes disasters and Garden Shows, and reaches game over and a rematch. This validates the protocol and engine, but **does not** run Socket.io itself or a network transport.
2. **True browser interaction, but mocked server transport:** `test/phase4-browser.py` executes the production V2 phone HTML/CSS/JavaScript in Chromium with real engine-generated private snapshots. It selects a Pray source on the map and a valid destination, asserts the resulting action payload, verifies the 3-choice Sympathy Vote in dusk and daylight themes, and exercises the final Rematch button. It checks for narrow-screen overflow and console exceptions, saving screenshots under `reports/phase4/`.

During testing, the public view was found to transmit **all three Sympathy Vote options to the TV and other phones**, although the UI only showed them to the chooser. This is now corrected in `src/engine/garden.js`: public views omit these options, and only the chosen player's private view receives them. Regression coverage tests both allowed and forbidden recipients. No score or gameplay probabilities change.

The phone also used an undefined colour token for its Show-race border; `--gold` is now defined for both themes. Narrow-screen resource labels have a 10px rather than 9px minimum, but they must still be assessed on physical phones under accessibility text scaling.

## Reproduce

```sh
npm run test:offline                # includes 4-player protocol full match
npm run test:protocol-acceptance   # 2 / 4 / 6 / 8 players, full Standard matches
npm run test:modes                # 63 seeded game-mode simulations
node test/sim.js 24               # archived V1 simulations
python test/phase3-visual.py       # optional real Chromium layout-only checks
python test/phase4-browser.py      # optional real Chromium UI interactions
```

The Python scripts require installed `playwright` and Chromium but add **no npm dependencies**. On a computer with npm registry access, run `npm ci && npm test` to exercise **genuine Socket.io transport and browser integration**. When the live integration passes, conduct a **physical TV-and-phones** test, including Wi-Fi sleep, mobile data handover, host disconnect, mid-round reconnection and resuming a saved match after an actual process restart.

## What is verified versus unverified

| Check | Status |
|---|---|
| Offline V2 rules, protocol, assets, branding, core engine and replayability tests | Passed |
| 2, 4, 6 and 8 fake-controller full Standard matches through actual handlers/engine | Passed |
| Sympathy Vote public/private option confidentiality | Passed |
| Chromium Pray picker, Sympathy Vote and Rematch actions | Passed (mock sockets) |
| Chromium 320–430px phone and 720p/1080p TV layouts | Passed (mock sockets) |
| Standard, Extended and Epic seeded smoke games | Passed |
| Real Socket.io server integration (`npm test`) | **Not run**: npm registry access unavailable |
| Physical TV and phones, remote WAN, disconnects, sound hardware | **Not run** |
| First-time human enjoyment, accessibility and replayability | **Not measured** |

## Remaining quality gates

- Run and troubleshoot the live Socket.io/Express + browser integration suite on an internet-connected machine or GitHub Actions.
- Test complete real matches on 2, 4, 6 and 8 *physical devices*, including genuine packet loss and server restarts.
- Observe new players on phone/TV to decide whether the added choices, rule simplification and Pray interaction deliver actual enjoyment. Record voluntary rematches, not merely survey intentions.
- Run larger seeded balance samples before revisiting Standard/Extended victory margins. The number of simulations completed in this phase does not prove god or strategy balance.

**Go/no-go:** v1.2.0-dev.4 is appropriate for controlled playtesting, not public commercial release. Do not call the simulated protocol tests live multiplayer validation.
