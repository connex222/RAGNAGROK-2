# Ragnagrok v1.1.0-dev.1 — Development Work Report

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
