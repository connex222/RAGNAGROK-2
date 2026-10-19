# v1.1.0-dev.4 — Connection recovery, safer rooms and planning usability (17 October 2026)

**Internal development candidate only.** No full live-network or physical-device certification.

- Phone reconnection no longer deletes the saved seat token on a transient Socket.io acknowledgement timeout. It retries automatically while retaining the session and clears only demonstrably invalid sessions.
- Existing host TV connections can securely retrieve their own room code, host key and QR link if the initial create acknowledgement was lost. This is accessible only to the already authenticated TV socket.
- Room creation is protected against overlapping asynchronous QR requests and QR failures; inaccessible orphan rooms are cleaned up.
- Dormant saved room-code filenames are reserved against new-room creation, preventing accidental overwrites when MAX_ROOMS skips some restores.
- Save files storing player tokens and host keys are written with owner-only permissions on supporting platforms.
- Phone planning displays forecast risks and next-Show categories above action slots; Edit/Clear are separate real buttons rather than nested controls.
- Phone planning sheets preserve scroll position and keyboard focus while re-rendering and support Escape to close.
- Every owned garden plot displays a contrasting numbered player marker as well as a coloured ownership border; corresponding labels appear on the TV scoreboard and phone Garden tab.
- TV startup failures are visible, with a retry control; transient attach failures preserve the saved host key.
- Added independent regression tests for room-code reservations, concurrent/failing QR requests, TV host recovery, saved-file permissions, SVG ownership labels and phone transient reconnects.
- No new game mechanics or disaster tuning were introduced in dev.4: measured balance results reflect the existing dev.3 rules and robot strategies, not a new balance fix.

See `reports/balance-v2-dev4-check.md` and `Ragnagrok-v1.1.0-dev.4-Changes.md` included alongside the ZIP.

# v1.1.0-dev.3 — Reliability, scoring and final-act balance (17 October 2026)

**Development/playtest candidate only. Not certified for public release.**

- Fixed the Hardy Perennial competition excluding players with zero damaged plots.
- Fixed Blessed allowing a zero-health Ruined plot to harvest.
- Provisional Act III balance change: Surtur's Mower causes one health damage
  rather than two, and simultaneous Act III disasters decrease from 2 to 1
  (2–4 players) or 3 to 2 (5–8 players). Its large-area threat remains.
- Hardened join URLs: forwarded scheme/host are ignored unless TRUST_PROXY=1,
  while a same-host browser Origin can select HTTPS when appropriate.
- Invalid JSON save files with room-code names are quarantined automatically.
- Room restorations respect MAX_ROOMS while retaining excess valid saves.
- Added rules, protocol, simulation and security regression checks.
- See `reports/balance-lab-v1.1.0-dev.3.md` for paired-seed exploratory results.

# v1.1.0-dev.2 — Second development pass (17 October 2026)

**Development/playtest build. Not certified for public or commercial deployment.**

### Reliability and security

- One active phone controller per player seat. A replacement connection detaches the old connection and informs its browser; a stale connection cannot continue issuing actions.
- Prevents a bound phone from joining multiple seats or swapping its role into a host TV without leaving first.
- Refuses repeat `tv:create` from a socket that is already attached to a game.
- Adds a configurable cap on active rooms (`MAX_ROOMS`, 100 by default) and a useful error when full.
- Pause/resume now shifts disconnected-player grace timers in addition to the planning deadline, including a player who disconnects during the pause.
- Save loading validates the state structure, room identity and seat/token consistency rather than checking only the schema number. Malformed but parseable matching-schema saves are moved into `saves/corrupt`.
- Original V1 save recovery is covered in the offline protocol suite.

### Visuals and rules consistency

- Added nine original, editable SVG feature icons and five condition icons under `public/img/`.
- Artwork discovery already supports SVG; game board and phone feature picker automatically use these icons.
- Phone garden list now displays the corresponding feature artwork.
- Corrected the phone Tend description, confirmation preview and TV how-to-play summary to say that Tend restores health **and** clears a harmful condition.
- The game engine itself was not rebalanced in this pass; old balance reports remain diagnostic.

### Validation

- `npm run test:offline`: **passed** (35 V2 rules tests, 8 protocol/persistence test groups, 14 icon checks and JavaScript syntax checks).
- `npm run test:modes`: **63** completed seeded robot games across Standard, Long, Epic and all player counts 2–8; see `reports/smoke-v2-dev2.md`.
- Full live `test/server2.test.js`, `test/ui2.test.js`, V1 Socket.io tests, actual Windows launcher, and real phones/TV **not executed** because npm dependencies and physical devices were unavailable in this environment.
- A 1,000-game run was attempted but did not finish within execution limits; no result from it has been used as balance evidence.

### Remaining release blockers

1. Install dependencies with `npm ci` on Windows or CI and execute the full `npm test` and `npm run test:all` suites, fixing failures.
2. Real-device testing with 2–8 phones, Wi-Fi/Ethernet, disconnections, host control, restart and rematch.
3. Larger statistically meaningful balance batches (particularly god powers and trading) followed by human playtesting. Ruined plots and winner margins are still too high for Standard and Long in the robot samples.
4. Complete human-led onboarding, contrast, TV viewing distance and screen-reader/accessibility checks.
5. Verify the long-term persistence strategy on the chosen host. Without persistent SAVE_DIR storage, a host restart loses running matches.
6. Release licensing, naming and security audits.

---

# RAGNAGROK v1.1.0-dev.1 — Development Work Report

**Status: internal playtesting only; not a final commercial release.**

## Implemented

- Fixed disconnected players being counted as locked. Planning still respects its original deadline and honours a short configured grace period if a participant disconnects close to expiry.
- Preserved unfinished/locked plans across disconnect/reconnect; extra regression tests cover both.
- Prevented trades from consuming a locked plan's resources. Outgoing offers expire when the proposer locks, and locked parties cannot accept trades.
- Validated total committed action costs and emergency pledges before locking; warned when resources are insufficient.
- Improved automatic composting so, where possible, shed overflow discards uncommitted cards first rather than the resources needed by an already locked plan.
- Corrected atomic validation of combined lobby settings; invalid combinations now leave the entire state unchanged.
- Corrected god selection in the simulator to seeded Fisher–Yates rather than a comparator-based pseudo-shuffle.
- Corrected robot planning so compulsory shed overflow is subtracted before choosing actions and pledges; robots now retry unaffordable plans instead of corrupting simulations.
- Changed Tend so removing a harmful condition also restores 1 health; Freya restores 2.
- Added a limited garden-positioning score: qualifying Bee Hotels, Water Features and Hedge Mazes earn +1 final Prestige each, with bonus details in score reporting.
- Corrected misleading Ash, Epic-action-count and locked-trading explanations in the in-game rules.
- Hardened command and feature-name lookups against inherited-object property names such as `constructor` and `__proto__`.
- Prevented blindly trusting socket-supplied `X-Forwarded-For` for room-code rate limiting unless the operator explicitly enables trusted proxy operation.
- Changed the Windows launcher to wait for `/healthz` before opening the browser; added dependency install error handling.
- Added a standalone rulebook, Windows guidance updates, playtest protocol and physical/hybrid concept note.
- Incremented the V2 saved-state schema to 3. V2 rc1 saved matches are incompatible with the new rules and will be moved to the incompatible-saves folder rather than loaded into a changed ruleset.

## Tests and limitations

- All **35** V2 rules unit/regression tests passed after these changes.
- The actual engine is exercised by seeded robot simulations; see `reports/balance-v2-*.md`.
- HTML inline scripts and modified JavaScript files passed syntax checks.
- Socket.io server, browser/DOM and cross-device integration tests **not verified** in this environment because npm package installation did not complete. These are mandatory release blockers, not passing tests.
- Windows `.bat` was updated but **not executed on Windows** here. It needs an actual Windows trial.
- Real-player usability, accessibility, 2–8-device sessions, security penetration testing and player-retention measurements are **not yet performed**.
- The full artwork set still lacks separate polished icons for some feature/condition asset references; emoji fallbacks remain possible.

## Balance decisions

The supplied original ZIP contained historical reports with simulation assumptions since corrected. Old and new samples are not directly equivalent because the shuffle, robot resource planning and rules have changed. The current reports are diagnostic, **not certification of fairness or fun**.

The early post-fix Standard sample showed improved destruction from 38.6% to ~34%; the 15% margin and 30% ruined-plot objectives are **not reliably met** across game modes. Sample sizes remain too small for precise per-god comparisons. Do not make additional major disaster/scoring changes solely to hit a percentage without real-player feedback.

## Next release blockers (highest priority first)

1. Install dependencies on Windows or a reliable CI runner; run and fix `test/server2.test.js`, `test/ui2.test.js` and V1 compatibility suites.
2. Validate the revised locked-resource and server disconnect behaviour in an actual live match, including concurrent reconnects and host pause/resume.
3. Run at least 1,000 varied seeded games per major balance configuration and improve the bot test methodology for negotiation, goals and tactical interference.
4. Conduct genuine four-, six- and eight-person playtests; tune disaster pressure, scoring gaps, god abilities and the Meddle incentive from evidence.
5. Complete missing game icons, TV readability, smartphone onboarding, reduced motion and accessibility checks.
6. Establish durable session recovery for production hosting; document ephemeral-storage risks.
7. Complete licensing/trademark clearance and release QA before charging players or manufacturing.

This report deliberately does **not** claim that every item from the original master prompt is finished.

## Latest reproducible samples (post-fix)

| Mode | Games | Median winning margin | Ruined owned plots | Emergency success | Shows share |
|---|---:|---:|---:|---:|---:|
| Standard | 320 | 19.0% | 34.0% | 48.9% | 56.2% |
| Long | 180 | 19.6% | 38.8% | 53.1% | 53.9% |
| Epic | 80 | 14.7% | 26.9% | 57.5% | 55.3% |

These use the revised seed/shuffle and bot resource-planning logic. **Epic's sample is small; no definitive balance claim is justified.** Standard and Long still miss their winner-margin and ruined-plot targets. They require another balance cycle after human playtesting.
