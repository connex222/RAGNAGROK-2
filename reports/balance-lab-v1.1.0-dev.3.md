# RAGNAGROK v1.1.0-dev.3 — Exploratory paired-seed balance comparison

## Method

35 games in each mode for both variants, with identical starting seeds
`90000 + k * 31` and 2–8 players selected cyclically.
Reported winner margin is the median, not the mean.
All results are **robot simulations without negotiation or human playtesting**.
They are too small to certify balance, god parity or enjoyment.

The baseline includes the two scoring/harvest correctness fixes but retains
the dev.2 disaster settings. The candidate changes only Act III: Surtur's
Mower deals -1 instead of -2; disaster events per round fall from 2 to 1
for 2–4 players and from 3 to 2 for 5–8 players.

| Mode | Setting | Ruined owned plots | Median winner margin | Show point share | Failed actions |
| --- | --- | ---: | ---: | ---: | ---: |
| Standard | Baseline | 37.7% | 19.5% | 62.0% | 2.3% |
| Standard | Candidate | 25.0% | 15.7% | 57.6% | 2.2% |
| Long | Baseline | 40.5% | 17.2% | 57.6% | 3.0% |
| Long | Candidate | 28.4% | 16.0% | 52.7% | 2.7% |
| Epic | Baseline | 29.5% | 15.1% | 59.0% | 4.8% |
| Epic | Candidate | 23.5% | 16.9% | 56.1% | 5.2% |

The candidate reduces ruin substantially in this sample, bringing Standard
and Long within the historical 10–30% target. **The desired winner-margin
target (<15%) is still missed in all three modes**, and Epic's median margin
actually worsened. This is not evidence of generally improved fairness.

### Interpretation

This is a provisional trade-off: reducing final-act disaster frequency
allows more features to survive, but may reduce the intended apocalyptic
feeling. Human playtesting must assess whether the finale remains exciting.
The robot strategies have limited variety and do not trade or negotiate.
A larger study and actual group sessions are required before commercial release.

### Reproduce

`node test/balance-lab.js baseline 35` runs the original dev.2 disaster
settings; `node test/balance-lab.js candidate 35` runs the dev.3 proposal.
Both variants are selected explicitly, independent of the default game
configuration; all other rules (including the scoring fixes) remain identical.

Note: this tool is intentionally a lightweight diagnostic, not a statistical
release gate. No simulated trading or human reactions are incorporated.
