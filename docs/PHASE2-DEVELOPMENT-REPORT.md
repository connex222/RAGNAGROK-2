# RAGNAGROK v1.2.0-dev.2 — Phase 2 development report

**23 October 2026 · Based on v1.2.0-dev.1**

## Objective

Make direct player interaction worthwhile without letting sabotage become a compulsory or purely punitive move. Improve the validity of robot-based balance evidence before changing victory points or introducing comeback scoring. This is a **testable balancing candidate**, not a certified release.

## Changes implemented

| Area | Before | After | Files |
|---|---|---|---|
| Pilfer | Only steals one resource matching the target plot's terrain, even when the defender holds other resources | Still takes the plot's resource first. If unavailable, takes one unit of the defender's most abundant supply; if the defender's entire hand is empty, takes nothing. Tie is broken by the existing supply order. No hidden hand is exposed during planning. | `src/engine/garden.js`, `src/data/v2.json`, phone picker, rulebook |
| Menace robot | Almost always prefers interference to earning Prestige, even when attacks cannot yield enough advantage | Scores development, defensive choices and tactical interference more fairly; does not repeatedly target the same plot for Meddle in one plan; contributes modestly to emergencies | `test/sim2.js` |
| Odin robot | Shifted a dangerous sector event in a random direction 80% of the time it threatened its own garden | Compares the two adjacent sector outcomes and uses the once-per-act power only when the alternative would be beneficial | `test/sim2.js` |
| Emergency thresholds | 0.65 / 0.85 / 1.05 resource-equivalents per player by act | 1.0 / 1.2 / 1.5 per player by act; chosen to counter overly frequent emergency successes under more cooperative bot play | `src/data/v2.json` |
| Balance evidence | General summary omits players finishing on zero Prestige and a clear separation of matches with random opponents | Added repeatable `test/phase2-benchmark.js` script measuring god and robot fair-share ratios, zero-Prestige rates, margin including/excluding random opponents, resource/sabotage action mix, ruin, emergency and Goodwill outcomes | `test/phase2-benchmark.js` |
| Regression coverage | No test for an empty terrain-specific supply with other resources in the defender's hand | Added two new Pilfer tests checking fallback priority and terrain-resource first preference | `test/party-upgrade.test.js` |
| Documentation / release identification | dev.1 | dev.2, consistent phone/TV/server version and rulebook/changelog | `README.md`, `CHANGELOG.md`, `package.json`, `package-lock.json`, both V2 pages, player guides |

**Unchanged:** Seven actions including Pray, Sympathy Vote, god rules, score awards, RNG engine, V1 archive, networking, save schema (V2 schema 4), dependencies and host permissions.

## Verification executed

- `npm run test:offline` — **passed**, including 39 core V2 rule tests, 9 replayability checks, 12 party-rule cases and existing network/source/artwork checks.
- `npm run test:modes` — **passed**, 63 complete seeded games: Standard, Extended and Epic with 2–8 players (three seeds per player count).
- `node test/phase2-benchmark.js 7` — **passed**, 7 seeded games per mode. **This is a smoke check only, not statistically meaningful god-balance evidence.**
- `node test/build-version.test.js` — **passed**.
- `node --check test/sim2.js` and `node --check server/index.js` — **passed**.
- Earlier in this phase, a 200-game Standard diagnostic under the improved Menace policy (before the final emergency tuning) showed its fair-share ratio around **0.97**, compared with approximately **0.68** in a different 140-game starting sample. **These are not matched-seed, independent trials, so the apparent improvement is provisional and should not be quoted as a controlled causal estimate.**
- A preliminary 60-per-mode diagnostic after adjusting thresholds to 1.0 / 1.2 / 1.5 (before Odin's final robot update) returned **70.0%, 72.2%, and 74.4%** emergency success for Standard, Extended and Epic. The latter two exceed the target; this is not a final certified balance finding.

### Very small final build balance smoke sample

Seven games each (21 total) with fixed IDs `140000 + k * 47`, player counts 2–8. The numbers below are diagnostic **only**; one game's result can change them substantially.

| Measure | Standard | Extended | Epic |
|---|---:|---:|---:|
| Emergency success | 57.1% | 47.6% | 61.9% |
| Menace fair-share ratio | 0.97 | 0.49 | 0.97 |
| Ruined owned plots | 24.2% | 33.1% | 28.0% |

See `reports/PHASE2-BALANCE.md` and rerun `npm run test:balance-audit` for a much larger sample. The 7-game ratios do **not** prove balance.

## Findings and critical limitations

1. **Robot balance is not game balance.** Raising the competence of an aggressive robot changes every strategy and god win rate. Do not treat old and new ratios as a clean rules-effect comparison.
2. **Meddle still costs an action.** Resource theft is now more reliable, but the direct attacker may still lose to a focused Garden Show strategy. Confirm with humans rather than making all negative actions dominant.
3. **Emergency balance is unresolved.** High success was found with cooperative robot assumptions; different groups and player counts can have very different pledge behaviour. Adjust `perPlayer` values based on larger stratified samples and real players, not a tiny benchmark run.
4. **Full live Socket.io/browser integration not executed.** npm registry installation was not completed in this environment. The offline protocol tests do not replace actual network/reconnection testing.
5. **No real-device tests** at 320px phone widths or television distances; no human player survey or measured rematch results.
6. **Standard winner margin, Loki/Frigg god balance and Epic ruins/fizzles remain open.** Do not call the game commercially ready.
7. **Safety for saved matches:** game rules change within schema 4. Finish current matches before switching software; take backups of `SAVE_DIR` if enabled. Do not deploy mid-match.

## Next recommended phase

On a connected test machine, run `npm ci && npm test && npm run test:modes`. Follow with **at least 300 seeded Standard games using a robust, rotation-balanced strategy/god assignment**, then a controlled four-player and eight-player human TV-and-phone session. Record actual action use, confusion, frustrations, surprises and whether players voluntarily rematch. Tune numbers only after the resulting evidence is credible.
