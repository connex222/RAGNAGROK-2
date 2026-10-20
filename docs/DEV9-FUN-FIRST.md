# RAGNAGROK-2 v1.1.0-dev.9 — Replayability / feedback development

**Date:** 20 October 2026  
**Status:** Offline-validated development build; real multiplayer and human enjoyment not yet demonstrated.

## Aim

Make competition easier to follow, help players make intentional decisions and make the end of a match more satisfying for people who did not win. These changes are **information and ceremony only**: there are no balance, action-cost, disaster, Show scoring or god-power changes in this iteration.

## Implemented

| Area | File(s) | Behaviour |
|---|---|---|
| Single-source Show ranking | `src/engine/garden.js` | `categoryStandings()` is now used both to judge a Show and to calculate an upcoming Show's temporary public comparison. Tied leaders share a rank and point reward. Min-plot eligibility is retained. |
| Safe provisional preview | `src/engine/garden.js` | `upcomingShowStandings()` exposes only **announced** categories for the first unjudged Show. It neither reads secret plans nor changes state or RNG. Public and private views see the same public race. |
| Phone Show race | `public/v2/play.html` | Optional collapsed panel after the action slots gives the player's current position, possible points, eligibility and current leader. States clearly that secret actions/future events can change the result. |
| TV Show race | `public/v2/index.html` | The announced Show area lists category leaders and scores on the shared screen. |
| End-game honours | `src/engine/garden.js`, TV/phone UI | Showstopper, Garden Architect, Neighbourhood Hero and Lush Legend. All tied players receive a distinction. Zero achievements produce no honour. These **never add Prestige, shift rank or alter victory**. |
| Instructions | `public/v2/rules.js` | Explains temporary standing previews and that honours are cosmetic. |
| Testing | `test/fun-loop.test.js`, `package.json` | Nine new contracts cover hidden categories, read-only projections, ties, preview/judgement agreement, final outcomes and inline UI JavaScript parsing. |
| Playtesting | `docs/PLAYTEST.md`, two CSV templates | Structured measures for clarity, satisfaction, replay intent and actual rematches. |

## Automated checks performed

- `npm run test:offline` — **passed** (39 existing V2 rules checks, 9 new replayability checks plus the pre-existing protocol, contract, asset, branding and resilience suites).
- `npm run test:modes` — **passed** (63 full V2 robot matches, 2–8 players across all three game lengths).
- `node test/balance-lab.js candidate 35` — **passed**, 105 complete seeded robot matches.
- The exact same 105 seeds and configuration run against dev.8 produced **identical** ruin rates, winner margins, Show share and failed-action percentages. This validates absence of measurable balance change in this sample; it is not evidence of increased fun.
- `npm ci` and live Socket.io/browser tests — **not run**, npm registry DNS access unavailable. No claim of real-device or release readiness.

### Baseline / current balance snapshot (identical in dev.8 and dev.9)

| Mode | Matches | Ruined plots | Median winner margin | Show scoring share | Failed actions |
|---|---:|---:|---:|---:|---:|
| Standard | 35 | 25.03% | 15.69% | 57.58% | 2.22% |
| Long | 35 | 28.44% | 16.00% | 52.71% | 2.71% |
| Epic | 35 | 23.51% | 16.95% | 56.13% | 5.22% |

This small sample is diagnostic only. Historical target for median winner margin was under 15%; the samples above exceed it. Do not add rubber-band points just to force the number.

## Limitations / next gates

1. **Full Socket.io/browser verification:** Dependencies are not available in this environment; run `npm ci && npm test` on a machine with registry access, plus physical TV and phones.
2. **Visual usability:** Confirm at 320–430px widths and from ~2–3m on an actual TV that the preview is readable without displacing action choices.
3. **Human enjoyment:** Run blinded/comparable dev.8 versus dev.9 playtests using the templates; monitor planning friction, understanding, rematches and non-winner satisfaction.
4. **Balance and activity:** Standard/Long winner margins and Meddle's relative strength still warrant actual human playtesting before rebalancing.
5. **Commercial launch:** Not yet ready; neither a software release candidate nor a scientifically established fun rating.

## Design decisions

- Preview uses existing public, deterministic state, not predicted end-of-round results. This avoids rewarding advance knowledge of another player's secret plan.
- Cosmetic honours encourage distinctive strategies and give memorable outcomes without unfair catch-up points or forced leader penalties.
- A collapsed phone panel keeps decisions above commentary; the TV shows leaders more prominently for social conversation.
- V1 remains archived and unchanged.
