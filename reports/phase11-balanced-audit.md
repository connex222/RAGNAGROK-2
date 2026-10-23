# Phase 11 — Controlled robot balance audit (v1.2.0-dev.12)

**420 seeded matches:** 140 each for Standard, Extended and Epic. Four competent strategies rotate through all seven player counts (2–8); deliberately random play is excluded from this run.

95% uncertainty ranges below are 800 seeded bootstrap resamples at the **match**, not individual-player, level. The exact JSON and Markdown report can be regenerated with npm run test:balance-controlled.

| Metric | Standard | Extended | Epic | Target |
| --- | --- | --- | --- | --- |
| Median winning margin | 13.34% (10.82–15.91) | 13.55% (10.53–16.11) | 12.82% (10.26–15.12) | <15% |
| Ruined owned plots | 17.74% (16.05–19.47) | 24.85% (22.87–26.71) | 24.71% (22.82–26.66) | 10–25% |
| Emergency success | **93.81% (91.19–95.95)** | **95.95% (94.05–97.86)** | **95.71% (94.17–97.38)** | 55–70% |
| Goodwill share of score | 14.30% (13.86–14.71) | 14.34% (13.93–14.75) | 17.10% (16.71–17.48) | 10–20% |
| Players with zero Prestige | 0% (0–0) | 0% (0–0) | 0% (0–0) | <2% |
| Car-Boot Sale actions | 12.82% (12.20–13.54) | 11.86% (11.28–12.47) | 16.35% (15.68–17.04) | ≤20% |
| Pray + Meddle actions | 24.53% (23.30–25.72) | 27.55% (26.42–28.79) | 34.56% (33.78–35.38) | ≥18% |

## God fair-share win ratios

| God | Standard | Extended | Epic |
| --- | --- | --- | --- |
| Thor | 0.95 (0.57–1.40) | 1.06 (0.64–1.48) | 0.84 (0.48–1.23) |
| Freya | 0.71 (0.39–1.08) | 1.04 (0.66–1.50) | 1.37 (0.93–1.85) |
| Heimdall | 0.91 (0.55–1.39) | 1.27 (0.82–1.72) | 1.58 (1.06–2.10) |
| Njord | 0.91 (0.55–1.29) | 1.09 (0.68–1.56) | 0.48 (0.18–0.80) |
| Frigg | 1.24 (0.83–1.68) | 0.93 (0.59–1.31) | 1.29 (0.91–1.75) |
| Hel | 1.24 (0.81–1.73) | 0.96 (0.57–1.43) | 0.67 (0.33–1.04) |
| Odin | 0.82 (0.48–1.21) | 0.88 (0.54–1.25) | 0.67 (0.37–0.99) |
| Loki | 1.27 (0.75–1.81) | 0.77 (0.36–1.21) | 1.13 (0.62–1.62) |

## Independent assessment

**The emergency system is insufficiently demanding for the tested competent robots.** Earlier mixed-style reports included a deliberately random robot with poor performance, masking how reliably strategic groups avert emergencies.

God estimates are not yet a reliable ranking: god assignment is not a fully factorial counterfactual study; intervals remain wide. Experimental increases to emergency thresholds in small matched-seed samples improved target success rates but risked excessive ruined gardens, particularly in longer modes. **No costs, probabilities, abilities or scoring values were changed** because the effects on human enjoyment and balance are not established.

This is software-controlled robot evidence, not real participants, real network conditions or proof of voluntary replay. Retain the 55–70% target as open and prioritise the November human sessions.
