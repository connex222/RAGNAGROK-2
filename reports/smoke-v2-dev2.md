# V2 game-mode smoke test — v1.1.0-dev.2

Every match completed with valid scoring; all seven player counts (2–8) were covered with three deterministic seeds per mode.

These 21-game samples per mode are **not** a statistically sound god-balance or strategy-balance analysis. The winner margin here is a **mean**, not the historical reports' median.

| Mode | Games | Mean winner margin | Ruined owned plots | Failed actions |
| --- | ---: | ---: | ---: | ---: |
| standard | 21 | 23.3% | 35.1% | 2.6% |
| long | 21 | 21.3% | 38.1% | 2.6% |
| epic | 21 | 17.1% | 30.0% | 4.9% |

Command: `node test/modes-smoke.js`. Fixed seeds: 50000 + modeIndex * 1000 + playerCount * 100 + seedIndex.
