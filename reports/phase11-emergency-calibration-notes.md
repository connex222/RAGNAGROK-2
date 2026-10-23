# Emergency pledge balance: safe calibration investigation

Status: **Diagnostic only — no production tuning applied.** 23 October 2026.

## Why the blanket difficulty increase was not adopted

Earlier 420-game competent-robot research showed emergency success of 93.81% Standard, 95.95% Extended and 95.71% Epic versus a target of 55–70%. A separate paired-seed Standard experiment (70 games per candidate, same robot profiles and seeds) found:

| Emergency per-player target | Emergency success | Ruined owned plots | Median winning margin |
| --- | ---: | ---: | ---: |
| Existing production values | 95.24% | 18.59% | 12.50% |
| All targets ×1.15 | 78.57% | 23.23% | 13.64% |
| All targets ×1.30 | 57.14% | 25.93% | 18.18% |

The ×1.30 change meets the emergency target in this robot sample but worsens both ruin (design target 10–25%) and margin (under 15%) and could make losing players feel helpless. It was **not** applied.

The new `test/phase11-emergency-sensitivity.js` adds a repeatable, smaller smoke experiment across 2–8 players and all three game lengths. Results are in `reports/phase11-emergency-sensitivity.json` for the local seven-game-per-mode demonstration only. Its sample is **too small** for confident balance claims; it cannot measure human enjoyment or voluntary rematches.

## Next calibration requirements

Compare act-specific thresholds, especially the weaker late-game emergency, instead of raising every act equally. Pair seeds and robot strategies; measure success **and** collateral damage, player-zero-Prestige rates, early-leader advantage, god fairness, Goodwill fraction and winning margin. For any proposed candidate, rerun sufficiently large seeds (140 or more per length as a starting point), all seven player counts, and full game engine tests. Never tune by silently changing an already running match or adjust hidden Prestige awards. Human playtests must validate whether failure creates humour and decisions rather than resentment.

## Security correction shipped with this investigation

Emergency pledges remain sealed until settlement. The old live group total exposed a two-player rival's individual contribution by subtraction. The TV now states only the target and that pledges are secret; final totals and contributor amounts remain public after settlement. Regression tests exercise all seven room sizes and every real Socket.io session checks the pre-resolution boundary.
