# dev.4 balance validation — unchanged dev.3 game rules

**Source:** `node test/balance-lab.js candidate 100`; Standard and Long rows
completed in a run interrupted before Epic, then Epic was completed separately
with `node test/balance-lab.js candidate 100 epic`.

100 deterministic robot matches were successfully completed **per mode**,
using the simulator's original fixed seeds (`90000 + gameIndex * 31`) and
player counts cycling through 2–8. This is 300 valid completed matches in total.
No game-mechanics adjustments were made in dev.4, so these results evaluate the
rules from dev.3. Do not interpret them as a measured before/after improvement.

| Metric | Standard | Long | Epic | Historical design target |
| --- | ---: | ---: | ---: | --- |
| Games completed | 100 | 100 | 100 | exploratory only |
| Final owned plots ruined | 22.55% | 27.23% | 22.74% | 10–30% |
| Median winner margin | 18.18% | 20.00% | 12.86% | below 15% |
| Garden Show scoring share | 53.87% | 49.79% | 54.96% | 40–60% |
| Fizzled actions | 2.49% | 2.74% | 4.81% | below 10% |

## Interpretation

Ruin, Garden Show point share, and fizzle rate are within the project's historical
targets. Winner margins still miss the target in Standard and Long, especially at
this larger sample size. Epic meets it in this specific sample.

The winner-margin target itself needs validation with people: competitive games
can have wider score margins while still feeling fair, and robot tactics are an
imperfect representation of humans. Do not add arbitrary comeback bonuses merely
to force the score distribution to meet a numerical target.

The simulation does **not** model human trades, negotiations, emotional reactions,
reading comprehension, onboarding or enjoyment. Larger controlled simulations and
human sessions remain necessary, especially for god-specific claims.
