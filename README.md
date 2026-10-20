# RAGNAGROK: The Last Garden Show

A party strategy game for one shared TV and 2–8 phones. The Norse apocalypse is
destroying the neighbourhood; the Village Garden Show is going ahead anyway.

- **Play at home on Windows:** see `INSTALL-WINDOWS.md` (double-click `Start Ragnagrok.bat`).
- **Rules:** How to Play is built into the game (📖 button), and the full rulebook is the included
  `docs/RULEBOOK-V2.md`.

## Development build v1.1.0-dev.9 — Show race and replayability feedback

This iteration focuses on **understandable competition** and **rewarding game endings** without adjusting scores or winner determination:

- The phone planner now includes a compact, optional **Show race** panel. It compares the current public garden against the next announced Garden Show's categories, with personal placement and conditional point awards. The preview explicitly excludes secret plans and future disasters.
- The TV's Show forecast now shows the current leaders in announced categories, so everyone can follow the rivalry.
- End-of-game **honours** recognise Show performance, garden design, Goodwill and surviving lush plots. Ties share an honour and honours are cosmetic only, so losing players can still celebrate achievements without changing the winner.
- The Show race and actual judging use one shared ranking function; regression tests confirm they agree. A compact `<details>` control prevents the additional information from overwhelming the phone planner.

**Verification:** `npm run test:offline`, `npm run test:modes`, and paired 35-match-per-length balance checks have passed. The paired samples reproduce dev.8 outcomes exactly; **this iteration does not claim improved gameplay balance or proven player enjoyment**. Validate the change through human playtesting. See [`docs/DEV9-FUN-FIRST.md`](docs/DEV9-FUN-FIRST.md) and [`docs/PLAYTEST.md`](docs/PLAYTEST.md).

## Development build v1.1.0-dev.8

This release hardens **lost-acknowledgement recovery**: request IDs cannot be reused for different commands, and the 256-entry bounded request-response cache is saved with a room when `SAVE_DIR` is configured. After restart, an authenticated controller may retry an identical command after all players have reconnected and the game has resumed; the engine will not apply it twice. As with any debounced save, a sudden process crash before the latest state reaches disk remains a limitation. Commands that use no request ID are not deduplicated.

The phone retries a transient action acknowledgement once using **the same ID**. Closed rooms revoke attached socket roles and host rights. WebP preloading releases stuck image/decode requests after twelve seconds and retries previously failed artwork on subsequent load attempts.

**Verification:** `npm run test:offline` and `npm run test:modes` need no npm dependencies. The GitHub Actions workflow runs `npm ci` and the existing real Socket.io/browser tests on push. Live end-to-end verification remains required before public release. For changes, regression cases and limitations see `docs/DEV8-RELIABILITY.md`.

## Development build v1.1.0-dev.7

This release adds dependency-free core-engine contracts plus an optional Vitest runner, strict inbound command validation, bounded action request-ID deduplication, authenticated single-socket state refresh, automatic pause/resume when all player controllers disconnect, idle cleanup for TV-attached abandoned matches, and a staged WebP preloader shared by TV and phones. The live Socket.io/browser test environment and Vitest install could not be verified without npm registry access; do not treat this as a production-certified build.

**Detailed instructions and examples:** [`docs/DEV7-ENGINE-NETWORK-ASSETS.md`](docs/DEV7-ENGINE-NETWORK-ASSETS.md).

Quick offline checks: `npm run test:offline` and `npm run test:modes`. To run Vitest, use Node.js 20+, install it with `npm install --save-dev vitest`, then run `npm run test:vitest`.

## Development build v1.1.0-dev.6

The official product name is **RAGNAGROK**. See `docs/BRAND-GUIDE.md` for naming standards. dev.6 makes the full test suite pass (`npm test`), stops phones offering a Lock button for plans the server will refuse, fixes eight recorded sounds that never played, shrinks the icon artwork from 34 MB to under 1 MB, and adds automatic testing on GitHub. See `docs/DEV6-CHANGE-REPORT.md`.

Dependency-free verification: `npm run test:offline` (includes the brand, asset, cache and version-guard tests) and `npm run test:modes` (63 seeded matches). Full server/browser tests require `npm ci` first. See `docs/DEV5-CHANGE-REPORT.md` for verified results and outstanding issues.

## Folders

| Path | What it is |
|---|---|
| `src/engine/garden.js` | V2 rules: every rule lives here and only here |
| `src/data/v2.json` | All V2 content: gods, features, disasters, shows, game lengths. Tune numbers here. |
| `src/engine/rules.js` | The original v0.5 rules (kept playable) |
| `server/` | Rooms, room codes, saving, reconnecting, home-network join links |
| `public/v2/` | V2 TV (`index.html`) and phone (`play.html`) |
| `public/` | Shared board drawer, sound engine, artwork; the v0.5 screens |
| `public/img`, `public/audio` | Drop artwork and sounds here (see the README in each) |
| `test/` | Automated tests and the balance simulation |
| `reports/` | Balance reports and screenshots |

## Commands

| Command | Does |
|---|---|
| `npm start` | Runs V2 on port 3000 |
| `npm run start:v1` | Runs the original v0.5 game |
| `npm test` | Offline suite, live server, phone+TV tap-through, 300 balance games (needs `npm ci` first) |
| `npm run test:audio` | Every sound the screens ask for reaches a file or fallback; catches filename typos |
| `npm run test:offline` | V2 rules, server-protocol stubs, artwork coverage, UI/reconnect checks and syntax checks (no external packages needed) |
| `npm run test:ux` | Ownership markers, planning controls and transient reconnect logic (no external packages needed) |
| `npm run test:core` | Offline suite plus 60-game Standard simulation (no external packages needed) |
| `npm run test:modes` | 63 seeded games covering Standard, Long, Epic and 2–8 players |
| `npm run test:all` | Everything, including the v0.5 suites |
| `npm run balance` | Full balance reports for all three game lengths |

## Settings (environment variables)

| Name | Default | What it does |
|---|---|---|
| `PORT` | 3000 | Set automatically on Render |
| `RAGNAGROK_RULES` | `v2` | `v1` runs the original game |
| `SAVE_DIR` | off | Folder to save games in, so they survive a restart (use on Oracle or a home server) |
| `PUBLIC_URL` | automatic | Force the address in join links and QR codes |
| `IDLE_MINUTES` | 30 | Delete rooms nobody has used for this long |
| `MAX_ROOMS` | 100 | Maximum active game rooms at once (clamped to 1–1000) |
| `TRUST_PROXY` | off | `1` behind a proxy you control. **Already set in `render.yaml`**, because on Render every player otherwise shares one address |

On Render's free plan games live in memory only: a restart or redeploy ends games in progress.

## Development build (v1.1.0-dev.3)

This is a development/playtest build, **not a certified commercial release**.
See `docs/RELEASE-NOTES.md` for confirmed fixes, balance data and remaining release blockers.
The original V1 edition remains available and unchanged.

The most important new rule is **Garden Design Prestige**: +1 point per qualifying
Bee Hotel, Water Feature or Hedge Maze with the relevant neighbouring features.
Tend now clears a harmful condition and repairs health at the same time.
The latest build also includes original vector icons for every V2 garden feature and condition, one-active-phone-per-player handling, safer save recovery and an explicit room limit.

For fast tests without external npm packages: `npm run test:offline`.
For seeded games across all three lengths and seven player counts: `npm run test:modes`.
The complete Socket.io and DOM/browser tests still require the external npm dependencies and live-device validation.
For the complete integration and browser tests, first run `npm ci` on a computer
with internet access and then `npm test`.

### Proxy deployment note

The anti-guessing limiter uses the socket's transport IP by default, ignoring
client-supplied `X-Forwarded-For`. Set `TRUST_PROXY=1` **only** when the game
server is behind a reverse proxy that you control and that strips/replaces
untrusted forwarding headers. Misconfiguration allows attackers to spoof IPs.

Game sessions use volatile memory unless persistent `SAVE_DIR` storage is
configured. Free hosts with ephemeral filesystems cannot guarantee recovery.

### Join-link reverse proxy safety (dev.3)

The server ignores `X-Forwarded-Host` and `X-Forwarded-Proto` by default.
On managed HTTPS hosting, prefer setting `PUBLIC_URL=https://your-domain.example`
to generate a correct phone QR link. Set `TRUST_PROXY=1` **only** behind a
reverse proxy that correctly sanitises forwarding headers. Never enable it
solely to make a QR code work on a home network.

### v1.1.0-dev.3 design/testing summary

- Hardy Perennial now correctly rewards undamaged gardens with zero damaged plots.
- Ruined plots never harvest, even when Blessed.
- Act III has fewer simultaneous disasters and Mower deals one health damage
  (provisional balance settings; see `reports/balance-lab-v1.1.0-dev.3.md`).
- Malformed room saves are quarantined and restoring saves respects `MAX_ROOMS`.
- Phone QR join URLs ignore untrusted reverse-proxy headers; HTTPS site
  origins on the same host are supported. Prefer an explicit `PUBLIC_URL`
  for managed hosting.
- Run `npm run test:offline`, `npm run test:modes`, and optionally
  `npm run test:balance-lab` without external dependencies.

This build has not passed the real Socket.io and browser suites in this
environment. It is **not a verified commercial release**.

## v1.1.0-dev.4 notes

This development build includes temporary-failure recovery for phone session tokens,
a secure authenticated-TV room recovery command, collision prevention for dormant
save files, QR-room creation cleanup, and usability improvements to the phone
planner and numbered garden ownership. See `docs/RELEASE-NOTES.md` and
`reports/balance-v2-dev4-check.md`. These changes have **not** passed a full
network Socket.io/browser or real device playtest.
