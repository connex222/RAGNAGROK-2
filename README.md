# RAGNAGROK — The Last Garden Show

**A 2–8-player TV-and-phone party strategy game.** The Norse apocalypse has reached a respectable English suburb, and the Village Garden Show is carrying on regardless. Everyone plans secretly on their phone, watches disaster and mischief unfold on the shared TV, and competes for the Golden Flamingo.

**Current build:** `1.2.0-dev.4` — internal playtest edition, not a production release. This version redesigns gameplay and changes the V2 saved-game format.

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
