# RAGNAGROK Phase 6 — Multiplayer and device acceptance

**Build:** 1.2.0-dev.6 · **Status:** local offline and simulated-browser checks only; human and real-device acceptance pending.

## Results confirmed in the development environment

| Gate | Evidence | Status |
| --- | --- | --- |
| Deterministic engine, room handlers, privacy, UX | `npm run test:offline` | Passed; includes four new Phase 6 checks |
| 2–8-player Standard/Extended/Epic full simulations | `npm run test:modes` | 63 matches completed |
| End-to-end server-handler games using simulated sockets | `npm run test:protocol-acceptance` | 2, 4, 6, 8 players completed nine rounds and rematched |
| Archived original game | `node test/sim.js 24` | Passed, 24 games |
| First-round phone coach and keyboard control | `python test/phase5-browser.py` | 320, 375 and 430 pixels passed using mock sockets |
| TV visual phases and Sympathy Vote privacy | `python test/phase6-browser.py` | Seven phases at 1280×720, synthetic public snapshots |
| Real Express/Socket.io and headless-JSDOM end-to-end acceptance for this exact build | `npm test` | **Not executed locally**; missing packages cannot be installed in the current network-isolated environment |
| Physical TV plus phones, changing networks, sound output | In-person checklist below | **Not undertaken** |
| Measured player enjoyment and voluntary rematches | Session surveys and observations | **Not undertaken** |

The previously checked GitHub Actions run on the older, uncorrected branch failed at the TV Sympathy Vote page. It **does not** validate the last local hotfix or this build. Use the new exact commit's GitHub run as the acceptance authority once published.

## Practical 45-minute test-night plan

Use a 40-inch or larger TV at normal sitting distance; two phones initially, then four if possible. Keep Chrome/Firefox developer consoles available on the hosting computer. Record the build, operating system, browser, viewport and connection type without collecting personal identifiers.

1. Start the V2 server; confirm the TV shows the **RAGNAGROK** logo, room code and QR. Join with two phones; each phone has a distinct avatar and one authenticated seat. Confirm the How to Play screen is easy to find.
2. Start **Standard**. Confirm both players understand the first-round recommendation, can ignore it and make their own actions. Check resource labels and that a 320px-wide phone has no horizontal scrolling.
3. Use **Pray** on a forecast disaster. Verify the selection is legal, only one Gnome Dust is charged when due, the TV shows the target moving on the correct plot, and the victim is named in the reveal. Enable reduced motion on one device and ensure the animation can be disabled without losing information.
4. During planning, close one phone tab and reopen it; the player must recover their original seat and saved plan. Also test Wi-Fi to cellular and back if the server is publicly reachable. Any failure must show a recoverable, clear error rather than silently losing state.
5. At the first Sympathy Vote, confirm only the chooser sees the **three private categories**. TV and rivals should see only that a vote is happening. After the choice, the public category can be announced.
6. Complete the nine Standard rounds, play an emergency, check that Goodwill is properly awarded, read the final ranking and honours, and begin one **Rematch** without changing seats.
7. Check that enabling sound does not obscure TV text and that voice/UI feedback remains legible at 2–3 metres. Repeat with 4, 6 and 8 players before declaring support for the full player range.

## Record actual findings

Use `docs/PLAYTEST-SESSIONS.csv` and `docs/PLAYTEST-PLAYER-FEEDBACK.csv`. Additionally record whether the connection recovered, whether actions duplicated, any browser errors, timeout handling, TV readability and whether players **voluntarily** started another match. Do not infer enjoyment from robot simulations.

**Release rule:** No public-ready claim until all required live tests pass and human sessions show the mechanics are understood and people genuinely want a rematch. Fix any critical issue and rerun tests on that exact version; don't reuse results from an earlier build.
