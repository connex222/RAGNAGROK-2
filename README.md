# RAGNAGROK — The Last Garden Show

**A 2–8-player TV-and-phone party strategy game.** The Norse apocalypse has reached a respectable English suburb, and the Village Garden Show is carrying on regardless. Everyone plans secretly on their phone, watches disaster and mischief unfold on the shared TV, and competes for the Golden Flamingo.

**Current build:** `1.2.0-dev.10` — internal playtest edition, not a production release. This version redesigns gameplay and changes the V2 saved-game format.

## Start on Windows

1. Install the supported LTS version of Node.js, then extract the complete project ZIP.
2. Double-click `Start Ragnagrok.bat`, or open a terminal in this folder and run `npm ci` followed by `npm start`.
3. Open `http://localhost:3000` on your host computer. Create a room and join from phones using the displayed QR link or room code. All phones must be able to reach your server (a local network or hosted URL).
4. Use **How to Play** on TV or phone for the quick rules. The [two-minute read-aloud guide](docs/HOW-TO-PLAY-IN-2-MINUTES.md) and [full V2 rulebook](docs/RULEBOOK-V2.md) are also included.

Run the archived original edition with `npm run start:v1`. Its rules, pages and cards are in `archive/v1/`, not the current V2 ruleset.

## Testing

| Command | Purpose |
|---|---|
| `npm run test:offline` | Dependency-free game rules, assets, protocol, new party-rule regressions, source checks |
| `npm run test:modes` | 63 completed seeded V2 games across 2–8 players and all three lengths |
| `npm run test:party` | Pray, Sympathy Vote and simplification contracts |
| `npm run test:phase8` | Anonymous post-match pulse privacy, acknowledgement and rematch tests |
| `npm run test:phase9` | Server-authoritative match starts, host privacy and restart-persistent aggregates |
| `npm run test:phase9:offline` | Seven player-count full-game protocol tests using real engine and mock transport |
| `npm run test:phase9:network` | Twenty-one actual Socket.io full-game tests: 2–8 players × Standard / Extended / Epic; requires installed npm dependencies |
| `npm run test:phase8:browser` | Optional Chromium phone viewports, feedback and consent controls (requires Python Playwright and Chromium) |
| `npm run test:phase3` | Abandoned-room and UI structure regressions |
| `npm run test:protocol-acceptance` | Complete 9-round protocol matches with 2/4/6/8 simulated controllers, no Socket.io transport |
| `python test/phase4-browser.py` | Optional Chromium UI flows: Pray, Sympathy Vote and rematch (mock sockets) |
| `python test/phase3-visual.py` | Optional headless Chromium layout check (requires Python Playwright and Chromium; mocks networking) |
| `node test/sim.js 24` | Archived V1 smoke simulations |
| `node test/sim2.js 100 standard` | Playstyle/god balance sample for Standard |
| `npm run test:balance-audit` | Consistent seeded balance diagnostics for all three modes |
| `npm test` | Full Socket.io/browser integration and automated sims; requires successful `npm ci` |

## Configuration

| Environment variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP/Socket.io listening port |
| `PUBLIC_URL` | inferred | Public join/QR link on hosted installs |
| `SAVE_DIR` | unset | Directory for durable saved matches; use persistent storage |
| `RAGNAGROK_RULES` | `v2` | Set `v1` to play the archived original game |
| `IDLE_MINUTES` | `30` | Remove idle/abandoned rooms |
| `MAX_ROOMS` | `100` | Maximum concurrently retained rooms |
| `TRUST_PROXY` | off | `1` only behind a trusted proxy you configure; `render.yaml` supplies it on Render |

## Project layout

- `src/engine/garden.js`: server-authoritative V2 game rules and seeded state progression.
- `src/data/v2.json`: resource, disaster, feature, god and scoring configuration.
- `server/`: hosting, rooms, authentication, state snapshots, reconnects and persistence.
- `public/v2/`: current TV and private phone interfaces; `public/img` and `public/audio` are shared media.
- `archive/v1/`: archived original game logic, page templates and cards; compatibility entrypoint remains in `src/engine/rules.js`.
- `test/`: game logic, protocol and balance tests; `docs/`: rulebook, playtests and future physical edition.
- `CHANGELOG.md`: full development and historical release notes.

**Upgrade warning:** V2 schema 4 is not compatible with unconverted schema-3 saved matches. Back up old saves before upgrading. Headless Chromium layout checks use simulated authorised snapshots. Full live Socket.io tests and physical-device/human playtests are still required before release.

## First-time experience and Phase 5 tests

The phone displays an optional first-round action suggestion based on legal targets and supplies; it opens a picker without submitting a move. Phase changes are screen-reader announced and planning dialogs support keyboard focus wrapping.

Run `npm run test:phase5` for first-run contracts and `python test/phase5-browser.py` for optional real-Chromium keyboard/responsive checks with a mock Socket.io connection. GitHub Actions runs `npm ci`, the **real** Socket.io/browser integration (`npm test`), full protocol acceptance and game-mode tests; check the latest run before claiming success. See `docs/PHASE5-VALIDATION.md`.

## Phase 6 — TV reveal reliability and live acceptance

The reveal renderer now refreshes when the action being shown changes, even if the authoritative server-state version does not. The Pray redirect marker respects system reduced-motion preferences by appearing directly at the destination instead of sliding there. Tests include dependency-free TV contract checks and seven Chromium public-screen snapshots; **these do not substitute for physical TV/phone testing**.

Run `npm run test:phase6` for the reveal/privacy contract suite and `python test/phase6-browser.py` for optional Chromium checks (Python Playwright and Chromium required). Follow the complete device acceptance protocol in [`docs/PHASE6-ACCEPTANCE.md`](docs/PHASE6-ACCEPTANCE.md). The game is not certified for release until the full GitHub Actions pipeline is green on the exact deployed commit.

## Phase 8 — Playtest feedback

After the final results, every phone offers a **completely optional** two-question enjoyment pulse. It does not delay Rematch or affect scoring. Responses are held only in the current server process, deduplicated by authenticated seat, discarded on rematch or restart, and **never included in saved games**. The host phone sees group totals only after **at least three** gardeners respond; the TV and other phones never receive the totals, and no one receives individual votes. Two-player matches do not expose aggregate scores. The host may copy the grouped figures as a short CSV if enough players answered. No external telemetry, accounts or new dependencies were introduced.

The pulse measures **stated** willingness to replay, which is not the same as an actual rematch. Facilitators should separately record who actually plays again and whether the playtest was enjoyable for people who lost. See `docs/PHASE8-GAME-NIGHT.md`.

## Phase 9 — Observed match starts

The TV and phone lobbies show the current match number. Only the authenticated host phone sees aggregate counts for matches started, matches completed and **rematches actually started**. Pressing Rematch merely prepares a new lobby; a rematch counts when the host successfully presses Start. The host can copy a games-night CSV record, independent of the optional Phase 8 pulse. This anonymous session tally survives restarts when `SAVE_DIR` uses durable storage; feedback votes never do. Host-controlled starts do not establish player consent, enjoyment or voluntary return. See [Phase 9 games-night protocol](docs/PHASE9-GAMES-NIGHT.md).
