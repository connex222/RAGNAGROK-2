# Ragnagrok: The Last Garden Show

A party strategy game for one shared TV and 2–8 phones. The Norse apocalypse is
destroying the neighbourhood; the Village Garden Show is going ahead anyway.

- **Play at home on Windows:** see `INSTALL-WINDOWS.md` (double-click `Start Ragnagrok.bat`).
- **Rules:** How to Play is built into the game (📖 button), and the full rulebook is the
  "Ragnagrok V2 — The Last Garden Show" document.

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
