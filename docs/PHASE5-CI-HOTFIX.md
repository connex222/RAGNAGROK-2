# RAGNAGROK — Phase 5: first-time experience and CI-driven multiplayer fixes

**Build:** v1.2.0-dev.5 (Phase 5 with local CI hotfixes)  
**Date:** 23 October 2026  
**Status:** Offline and simulated browser/protocol checks pass. The latest GitHub Actions live-browser acceptance run is **not yet green**, because two subsequent fixes are present in this ZIP but have **not** been successfully published to GitHub.

## User-facing additions

1. **First-round coach.** A small optional recommendation identifies an affordable, legal action from the current hand and targets. The player may ignore it. Using the coach opens the normal action picker; it never spends supplies, commits a plan or submits an action automatically.
2. **Accessible dialogs.** Tab and Shift+Tab remain inside an open dialog; Escape closes it. A polite phase-announcement region informs screen-reader users when a phase changes without reading the countdown every second.
3. **Reduced motion.** Incidental transitions and animations respect the operating system's reduced-motion preference.
4. **Screen-size checks.** The coach and interaction sheet were exercised through headless Chromium at 320, 375 and 430 pixels. No horizontal overflow occurred in the tested states.

## Real multiplayer / CI discoveries

GitHub Actions downloaded dependencies and ran the **real Socket.io server integration suite** successfully. It covered a room with four phones, wrong-code rate limiting, malformed payloads, action retries, disconnect/rejoin while planning, pause/resume, a persisted server restart, a complete nine-round game and a rematch.

The subsequent real JSDOM phone/TV test exposed the following problems in sequence:

| Issue | Cause | Fix in this ZIP |
| --- | --- | --- |
| Wrong default mode test | Legacy test asserted Long even though Standard became default in Phase 1. | Acceptance test now checks Standard, Extended and switching back. |
| Slot count test failed | Quick-plan CTA was counted as though it were an action slot. | Test counts controls inside `.slots` only. |
| TV crash on Pray redirect | `public/board.js` accessed `topo.hexById` although serialised client topology contains arrays but no lookup index. | Animation uses `topo.hexes.find(...)`, with a missing-plot guard; targeted regression verifies the moving marker. |
| TV crash on Sympathy Vote | `public/v2/index.html` tried to iterate `v.options`, which is intentionally not supplied to TV/public views. | TV displays the chooser and a neutral waiting message instead of the secret options. |
| Private ballot leak in game events | Engine emitted `sympathyStart` with the three choice names; `server/rooms.js` broadcasts public game events. | `sympathyStart` now emits the chooser only. The authorised voting player's private state still contains the options. Protocol tests assert that no TV or rival event reveals them. |

**Important:** The last two fixes (TV Sympathy panel and event privacy) are included in this local ZIP, and all local regression checks have passed. The GitHub branch currently contains the earlier Phase 5 work and the TV Pray fix but **not the last two privacy/TV fixes**. The most recent checked CI run (`39934767440`) failed because of that Sympathy panel. It would be inaccurate to claim GitHub is green or the live browser acceptance is complete.

## Local verification

| Verification | Result |
| --- | --- |
| `npm run test:offline` | Passed, including 10 Phase 5 checks and private-choice regression |
| `npm run test:protocol-acceptance` | Passed, 2/4/6/8 controllers, full 9-round games/rematches |
| `npm run test:modes` | Passed, 63 full seeded games (Standard, Extended, Epic; 2–8 players) |
| `python test/phase5-browser.py` | Passed, 320/375/430px (stubbed Socket.io) |
| GitHub Actions real Socket.io server integration | Passed on previous run before browser UI failure |
| GitHub Actions full browser acceptance | **Not green**; final local privacy corrections still need to be pushed and rerun |
| Physical TV and phones, Wi-Fi/4G switching | Not performed |
| Human enjoyment/voluntary rematches | Not measured |

## Next release gate

1. Publish the final **four** local source files from this ZIP: `src/engine/garden.js`, `public/v2/index.html`, `test/phase4-protocol.test.js` and `test/phase5-first-run.test.js`.
2. Rerun `.github/workflows/test.yml`; do not mark the build releasable until `npm test`, protocol acceptance and mode smoke tests all pass.
3. Perform a physical 2-phone/1-TV Standard match including Pray, Sympathy Vote, speaker sound, phone sleep/rejoin and rematch.
4. Repeat with 4, 6 and 8 devices, record comprehension and observed rematches, then adjust gameplay balancing on evidence.

**No gameplay costs, odds, scores or game-length values were changed during Phase 5.**
