# V2 game-mode smoke test — 1.2.0-dev.8

Every match completed with valid scoring; all seven player counts (2–8) were covered with three deterministic seeds per mode.

These 21-game samples per mode are **not** a statistically sound god-balance or strategy-balance analysis. The winner margin here is a **mean**, not the historical reports' median.

| Mode | Games | Mean winner margin | Ruined owned plots | Failed actions |
| --- | ---: | ---: | ---: | ---: |
| standard | 21 | 19.3% | 20.6% | 6.8% |
| long | 21 | 14.9% | 29.1% | 8.3% |
| epic | 21 | 21.3% | 25.6% | 13.7% |

Command: `node test/modes-smoke.js`. Fixed seeds: 50000 + modeIndex * 1000 + playerCount * 100 + seedIndex.
