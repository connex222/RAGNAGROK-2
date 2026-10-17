# Ragnagrok: The Last Garden Show

A party strategy game for one shared TV and 2–8 phones. The Norse apocalypse is
destroying the neighbourhood; the Village Garden Show is going ahead anyway.

- **Play at home on Windows:** see `INSTALL-WINDOWS.md` (double-click `Start Ragnagrok.bat`).
- **Rules:** How to Play is built into the game (📖 button), and the full rulebook is the included
  `docs/RULEBOOK-V2.md`.

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
| `npm test` | V2 rules, server, phone+TV tap-through, 300 balance games |
| `npm run test:core` | V2 rules and 60-game Standard simulation (no external packages needed) |
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

On Render's free plan games live in memory only: a restart or redeploy ends games in progress.

## Development build (v1.1.0-dev.1)

This is a development/playtest build, **not a certified commercial release**.
See `docs/RELEASE-NOTES.md` for confirmed fixes, balance data and remaining release blockers.
The original V1 edition remains available and unchanged.

The most important new rule is **Garden Design Prestige**: +1 point per qualifying
Bee Hotel, Water Feature or Hedge Maze with the relevant neighbouring features.
Tend now clears a harmful condition and repairs health at the same time.

For fast tests without external npm packages: `npm run test:core`.
For the complete integration and browser tests, first run `npm ci` on a computer
with internet access and then `npm test`.

### Proxy deployment note

The anti-guessing limiter uses the socket's transport IP by default, ignoring
client-supplied `X-Forwarded-For`. Set `TRUST_PROXY=1` **only** when the game
server is behind a reverse proxy that you control and that strips/replaces
untrusted forwarding headers. Misconfiguration allows attackers to spoof IPs.

Game sessions use volatile memory unless persistent `SAVE_DIR` storage is
configured. Free hosts with ephemeral filesystems cannot guarantee recovery.
