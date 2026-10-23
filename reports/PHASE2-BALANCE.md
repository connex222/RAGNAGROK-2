# Phase 2 balance verification — provisional

The principal result of this phase is **better measurement**, not a claim that all modes are balanced. The small current-run output is contained in `reports/phase2-audit-7games.json`; it is a smoke sample of 7 games per mode and is NOT appropriate for ranking gods or predicting human behaviour.

To rerun in the source folder:

```bash
node test/phase2-benchmark.js 60
npm run test:modes
```

### Calibration record (earlier iteration, 60 games per mode)

The candidate thresholds were **1.0 / 1.2 / 1.5** per player in acts I/II/III. An earlier same-run preliminary sample (before Odin robot's last update) reported:

| Measure | Standard | Extended | Epic |
|---|---:|---:|---:|
| Emergency success | 70.0% | 72.2% | 74.4% |
| Goodwill share | 12.5% | 11.8% | 14.8% |
| Median winner margin, no random bot | 10.6% | 13.3% | 7.8% |
| Menace ratio to expected fair wins | 0.99 | 0.91 | 1.44 |

These are **not post-release measurements**; they are exploratory robot diagnostics. Extended/Epic emergency rates miss the requested 55–70% range. A later final seven-per-mode smoke sample also shows substantial variance. Full rotation-controlled larger samples and human playtesting must drive further tuning.

**Never treat the simulation alone as evidence of fun or commercial readiness.**
