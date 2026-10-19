# V2 game-mode smoke test — 1.1.0-dev.5

Every match completed with valid scoring; all seven player counts (2–8) were covered with three deterministic seeds per mode.

These 21-game samples per mode are **not** a statistically sound god-balance or strategy-balance analysis. The winner margin here is a **mean**, not the historical reports' median.

| Mode | Games | Mean winner margin | Ruined owned plots | Failed actions |
| --- | ---: | ---: | ---: | ---: |
| standard | 21 | 19.6% | 20.1% | 2.4% |
| long | 21 | 17.0% | 29.5% | 3.0% |
| epic | 21 | 20.5% | 21.1% | 5.5% |

Command: `node test/modes-smoke.js`. Fixed seeds: 50000 + modeIndex * 1000 + playerCount * 100 + seedIndex.
