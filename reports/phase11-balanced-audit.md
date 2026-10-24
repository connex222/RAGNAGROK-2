# Phase 11 balanced strategy audit — 1.2.0-dev.12

Seed 240000+k*59, seat count 2+k%7, deterministic style rotation without random robot. 800 seeded game-level bootstrap resamples per mode; intervals approximate, not human data.

| Measure | Standard | Extended | Epic | Design target |
| --- | --- | --- | --- | --- |
| Median winning margin | 11.26% (95% bootstrap 4.44–20%) | 18.02% (95% bootstrap 8.31–30.21%) | 13.65% (95% bootstrap 9.88–17.53%) | <15% |
| Ruined owned plots | 18.02% (95% bootstrap 13.13–23.21%) | 25.43% (95% bootstrap 18.03–32.04%) | 20.69% (95% bootstrap 15.09–27.01%) | 10–25% |
| Emergency success | 95.24% (95% bootstrap 88.1–100%) | 100% (95% bootstrap 100–100%) | 97.62% (95% bootstrap 94.05–100%) | 55–70% |
| Goodwill share | 14.46% (95% bootstrap 13.51–15.16%) | 14.89% (95% bootstrap 14.19–15.54%) | 17.33% (95% bootstrap 16.27–18.26%) | 10–20% |
| Players with zero Prestige | 0% (95% bootstrap 0–0%) | 0% (95% bootstrap 0–0%) | 0% (95% bootstrap 0–0%) | <2% |
| Car-Boot actions | 13.1% (95% bootstrap 11.34–14.87%) | 12.56% (95% bootstrap 11.44–13.89%) | 18.25% (95% bootstrap 16.42–19.81%) | ≤20% |
| Pray + Meddle actions | 24.84% (95% bootstrap 21.62–27.37%) | 28.93% (95% bootstrap 25.37–32.21%) | 32.66% (95% bootstrap 30.8–34.76%) | ≥18% |

## Gods — ratio to fair share (95% match-bootstrap intervals)

| God | Standard | Extended | Epic |
| --- | --- | --- | --- |
| Thor | 0 (0–0) | 1.39 (0–3.49) | 0 (0–0) |
| Freya | 0.96 (0–1.8) | 0.48 (0–1.85) | 1.91 (0.59–3.49) |
| Heimdall | 1.82 (0.43–3.49) | 3.03 (1.15–5.1) | 3.03 (1.22–5.34) |
| Njord | 0 (0–0) | 0 (0–0) | 0 (0–0) |
| Frigg | 1.79 (0.44–3.71) | 0.89 (0–1.9) | 0.45 (0–1.49) |
| Hel | 1.03 (0–2.28) | 1.03 (0–1.93) | 0.69 (0–1.56) |
| Odin | 0 (0–0) | 0.73 (0–2.04) | 0.73 (0–2.51) |
| Loki | 1.69 (0–3.59) | 0 (0–0) | 0.84 (0–3.04) |

**Interpretation:** Intervals account for match-level grouping but do not guarantee target precision, and gods are not assigned in a fully factorial counterfactual experiment. These numbers reflect programmed robot decisions, not real enjoyment, subjective fairness, mobile latency, or voluntary rematches. Make changes only with controlled paired evidence.
