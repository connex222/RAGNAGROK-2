# V2 game-mode smoke test — 1.2.0-dev.1

Every match completed with valid scoring; all seven player counts (2–8) were covered with three deterministic seeds per mode.

These 21-game samples per mode are **not** a statistically sound god-balance or strategy-balance analysis. The winner margin here is a **mean**, not the historical reports' median.

| Mode | Games | Mean winner margin | Ruined owned plots | Failed actions |
| --- | ---: | ---: | ---: | ---: |
| standard | 21 | 15.9% | 21.4% | 6.3% |
| long | 21 | 21.9% | 26.5% | 7.8% |
| epic | 21 | 19.8% | 22.9% | 13.0% |

Command: `node test/modes-smoke.js`. Fixed seeds: 50000 + modeIndex * 1000 + playerCount * 100 + seedIndex.
