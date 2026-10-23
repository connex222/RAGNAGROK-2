> **Historical v1.2.0-dev.1 report:** predates all phase 2 gameplay and robot changes. Do not use as a current balance verdict.

# RAGNAGROK V2 v1.2.0-dev.1 — Historical Robot Balance Snapshot (dev.1 only)

**Simulations are diagnostic, not proof of fairness or fun.** 80 Standard, 80 Extended and 25 Epic seeded robot games, completed 23 October 2026. The Epic results have wide uncertainty. This version still misses several core targets.

| Metric (target) | Standard (80) | Extended (80) | Epic (25) |
|---|---:|---:|---:|
| Median winner margin (under 15%) | 18.8% | 22.5% | 19.2% |
| Ruined plots (10–25%) | 19.5% | 25.2% | 30.7% |
| Goodwill share (10–20%) | 11.6% | 11.5% | 13.1% |
| Emergency success (55–70%) | 67.1% | 68.8% | 64.7% |
| First-Show leader wins (35–55%) | 55.0% | 50.0% | 36.0% |
| Fizzled actions (under 10%) | 7.0% | 9.0% | 12.5% |
| Car-Boot actions (20% or less) | 13.2% | 12.5% | 17.8% |
| Pray actions | 24.2% | 27.3% | 27.1% |
| Meddle actions | 3.0% | 3.4% | 6.9% |
| Combined Pray + Meddle (18% or more) | 27.2% | 30.7% | 34.0% |
| Menace robot fairness ratio (0.9 or better) | 0.78 | 0.64 | 0.38 |

**Not verified against the design targets:** percentage of individual players finishing on zero Prestige, first-round Car-Boot specifically, full all-eight-gods 0.85–1.15 ratio in every mode, and human replay willingness. Existing sim reports include god-by-god ratios, but sample sizes and bots are insufficient to claim balance.

**Interpretation:** The opening resource change lowered Car-Boot use, and Pray appears frequently. That does not automatically make the aggressive strategy competitive: Menace bots still underperform. Standard/Extended have wider winning margins, and Epic exceeds the targeted ruin cap and fizzled-action ceiling. These require deliberate balancing and human tests, not invented results.

**Commands:** `node test/sim2.js 80 standard`, `node test/sim2.js 80 long`, `node test/sim2.js 25 epic`. See source/robot assumptions in `test/sim2.js` and `docs/PLAYTEST.md`.
