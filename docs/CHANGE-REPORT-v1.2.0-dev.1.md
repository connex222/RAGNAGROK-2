# RAGNAGROK 1.2.0-dev.1 — Development Change Report

**Based on:** `RAGNAGROK-Review-and-ChatGPT-Prompt.md` and the uploaded `RAGNAGROK-2-main.zip`.
**Focus:** First implementation phase of a clearer, more interactive party game.
**Build status:** Offline-tested development candidate; not production ready.

## Gameplay changes — before and after

| Area | Previous build | This build |
|---|---|---|
| Conditions | Frozen, Flooded, Infested, Ash, Blessed | Blighted (no harvest), Ash, Blessed; Njord ignores Blighted harvest blocking |
| Features | Nine, including Bee Hotel/Hedge Maze/Greenhouse | Six remaining; Flora, Water and Ornament tags all occur on at least two features |
| Design scoring | Invisible conditional adjacency bonuses | Removed, no extra design points |
| Trading | Phone Trade tab and player offer resolution | Removed from the active engine and phone/TV UI (archived V1 unaffected) |
| Default length | Extended/Long | Standard; longer modes under advanced lobby option, Long's display name is Extended |
| Disaster interaction | Meddle mainly attacks neighbours | Pray redirects a forecast hit before Shelter; conflicts cost Dust; Loki/Heimdall/Gnome Battalion exceptions |
| Starting supplies | 1 of each of five supplies | 2 Turf, 2 Fertiliser, 1 Sprinklers, 2 Compost, 2 Gnome Dust |
| Catch-up | None | 20-second Sympathy Vote after each non-final Show, selecting a category not bonus points |
| TV reveals | Basic action-by-action notifications | Seeded comic blame banners and short redirection-marker animation |
| Emergency presentation | Limited pledge clarity | Aggregated anonymous pledge progress bar |
| Phone usability | Unlabelled resource icons, buried options | Explicit resource names, two-step Pray picker, advanced length control and clearer affordability feedback |
| Ownership | Border and small seat label | Added translucent owner-colour wash, keeps seat number for colour-blind distinction |
| V1 organisation | Adjacent to live V2 | Archived original V1 rules, cards and screens; compatibility gateway still runs V1 |

## Technical details and assumptions

- All outcome-changing rules remain in `src/engine/garden.js`; content, Prayers costs, durations and joke templates in `src/data/v2.json`. All randomness uses the existing seeded RNG. No npm dependency added.
- `src/engine/rules.js` is now a thin require wrapper for the unchanged behaviour of the archived original engine in `archive/v1/`. V1 static pages/cards are separately routed when `RAGNAGROK_RULES=v1`.
- **Breaking save compatibility:** The rules schema advances from 3 to 4. A saved schema-3 room is not transparently migrated. Back up/save outside this tree prior to deployment; do not hot-upgrade a running match.
- Pray source conflicts are judged on the original forecast hit. All valid ordinary contenders lose their payment. Loki is exempt from ordinary cancellation, but multiple redirects still cannot target a hit already moved out of the original position. This edge case is documented for further human review.
- The supplied design criticises low interactivity and complexity; simulations cannot determine whether more Pray actions make human play fun.
- Artwork for removed features has been retained where it may still be referenced by archive/shared assets; Blighted reuses a copied condition image. Original V1 rules and soundtrack are preserved.

## Tests actually run

- **`npm run test:offline`: PASS**, including pre-existing V2 rules (39 checks), server protocol checks, static scripts, brand and media, engine contracts, network resilience, 9 existing fun-loop checks and **10 new `party-upgrade` assertions**.
- **`npm run test:modes`: PASS**, 63 complete seeded V2 games (2–8 players and three lengths).
- **`node test/sim.js 24`: PASS**, original V1 rules, 24 complete simulations after archive relocation.
- **`node test/sim2.js 80 standard`: PASS**, 80 seeded games.
- **`node test/sim2.js 80 long`: PASS**, 80 seeded games.
- **`node test/sim2.js 25 epic`: PASS**, 25 seeded games.
- **`node test/balance-lab.js candidate 15`: PASS**, earlier small exploratory sample (prior to last tag retargeting; not used as final balance evidence).
- **JavaScript/server syntax:** checked as part of static tests, plus `node --check server/index.js`.
- **Not executed:** `npm ci` (dependency download unavailable), full live Socket.io/Express test suite, actual TV/phone browser sessions, Wi-Fi-loss tests, visual accessibility measurements and human playtest interviews. These are open release blockers.

## Latest balance

| Metric (target) | Standard (80) | Extended (80) | Epic (25) |
|---|---:|---:|---:|
| Median winner margin (under 15%) | 18.8% | 22.5% | 19.2% |
| Ruined plots (10–25%) | 19.5% | 25.2% | 30.7% |
| Goodwill share (10–20%) | 11.6% | 11.5% | 13.1% |
| Emergency success (55–70%) | 67.1% | 68.8% | 64.7% |
| First-Show leader wins (35–55%) | 55.0% | 50.0% | 36.0% |
| Fizzled actions (under 10%) | 7.0% | 9.0% | 12.5% |
| Car-Boot actions (20% or less) | 13.2% | 12.5% | 17.8% |
| Pray actions | 24.2% | 27.3% | 27.1% |
| Meddle actions | 3.0% | 3.4% | 6.9% |
| Combined Pray + Meddle (18% or more) | 27.2% | 30.7% | 34.0% |
| Menace robot fairness ratio (0.9 or better) | 0.78 | 0.64 | 0.38 |


Full report: `reports/balance-v2-current.md`. The all-gods and Menace fairness thresholds **are not met**, and winning margins are too wide. Do not market this version as fully balanced.

## Outstanding / deferred work

1. Live Socket.io/browser integration across real TV and 2–8 phones, host skip, rejoin, session resume and version upgrades.
2. Full TV 24px minimum-font audit and measured 3m readability; verified 320px phone overflow and WCAG contrast tests. Ownership wash, resource labels and sound button have been implemented but not visually verified.
3. Redirection animations are in the SVG/TV presentation but not validated by real browsers; action blame sounds currently reuse existing effects rather than a dedicated mastered cue.
4. Final engine/robot tuning for Standard median margin below 15%, Menace viability, god fairness and Epic final ruin/fizzle rates.
5. Full 1000+ seeded match batches and controlled human playtesting. Real world rematch, enjoyment and the rate of players with zero Prestige are unverified.
6. Remove residual shared unused media only after real browser asset coverage confirms they are unreferenced.
7. Validate stored game upgrades; schema-3 migration is intentionally not implemented.

## Exact file inventory

**Modified existing files:**
- `README.md`
- `docs/RULEBOOK-V2.md`
- `package-lock.json`
- `package.json`
- `public/board.js`
- `public/v2/index.html`
- `public/v2/play.html`
- `public/v2/rules.js`
- `reports/balance-v2-epic.md`
- `reports/balance-v2-long.md`
- `reports/balance-v2-standard.md`
- `server/index.js`
- `server/rooms.js`
- `src/data/v2.json`
- `src/engine/garden.js`
- `src/engine/rules.js`
- `test/branding.test.js`
- `test/garden.test.js`
- `test/sim2.js`

**New or moved-in files:**
- `.gitignore`
- `CHANGELOG.md`
- `archive/v1/public/index.html`
- `archive/v1/public/play.html`
- `archive/v1/public/rules.js`
- `archive/v1/src/data/cards.json`
- `archive/v1/src/engine/rules.js`
- `docs/HOW-TO-PLAY-IN-2-MINUTES.md`
- `public/img/cond-blighted.webp`
- `reports/smoke-v2-dev1.md`
- `test/party-upgrade.test.js`

**Removed or archived originals:**
- `docs/DEV4-CHANGE-REPORT.md`
- `docs/DEV5-CHANGE-REPORT.md`
- `docs/DEV6-CHANGE-REPORT.md`
- `docs/DEV7-ENGINE-NETWORK-ASSETS.md`
- `docs/DEV8-RELIABILITY.md`
- `docs/DEV9-FUN-FIRST.md`
- `docs/RELEASE-NOTES.md`
- `public/img/cond-flooded.webp`
- `public/img/cond-frozen.webp`
- `public/img/cond-infested.webp`
- `public/index.html`
- `public/play.html`
- `public/rules.js`
- `reports/balance-lab-v1.1.0-dev.3.md`
- `reports/balance-v2-dev4-check.md`
- `reports/smoke-v2-dev2.md`
- `reports/smoke-v2-dev3.md`
- `reports/smoke-v2-dev4.md`
- `reports/smoke-v2-dev5.md`
- `reports/smoke-v2-dev6.md`
- `reports/smoke-v2-dev7.md`
- `reports/smoke-v2-dev8.md`
- `reports/smoke-v2-dev9.md`
- `src/data/cards.json`

Additionally excluded 14 archived PNG masters and 4 stale screenshot files from the delivery.
