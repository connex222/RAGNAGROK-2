# RAGNAGROK v1.1.0-dev.6 — Full test suite green, lock-in and assets fixed

**20 October 2026 — Internal development / playtesting build**

No rules, probabilities, god powers or scoring were changed.

## Fixes

| # | Problem | Fix |
|---|---|---|
| 1 | The phone let players build a plan the server would refuse to lock. Its cost check ignored the emergency pledge and composting, and let a pledge use Car-Boot supplies that only arrive at the end of the round. Players saw an error after tapping Lock, under the timer. | The server now sends each phone a private `commit` status (`canLock` and the exact shortfall). The Lock button stays disabled with a message such as "Short 1 Compost. Change an action, lower your pledge or trade." The phone's own projection now reserves the pledge first and never counts Car-Boot income, matching the server. Pledge "spare" counts are corrected. |
| 2 | On Render every player arrives through one proxy address, so 20 wrong room codes from anyone would lock out everyone for a minute. | `render.yaml` sets `TRUST_PROXY=1`. Home play is unchanged. |
| 3 | Eight recorded sounds never played: five filenames had a space before `.mp3`, and `offerin`, `playerjoined`, `disaster-gnome` didn't match the names the game uses. | Files renamed. The loader now ignores case and stray spaces. New `test/audio.test.js` checks every requested sound. |
| 4 | Each feature/condition icon had a 2 MB PNG and an SVG with the same name; which one phones loaded depended on disk order. | Painted art converted to 320 px WebP (34 MB → 0.7 MB). Masters moved to `docs/art-sources/`. The art loader picks formats in a fixed order. The asset test enforces one file per slot and a size cap. |
| 5 | `npm test` failed: two test robots were out of date with the dev.3 rules. | Robots updated; the UI robot now reacts to the shortfall message as a person would. |
| 6 | Nothing ran the tests automatically. | `.github/workflows/test.yml` runs `npm test` and `npm run test:modes` on every push. |
| 7 | A laptop driving the TV could sleep during long games. | TV page requests a screen wake lock after the first click. |

Version bumped to dev.6 so phones and TVs already open show the "Refresh game now" notice after deployment.

## Verified results (Node 22, all npm packages installed)

| Check | Result |
|---|---|
| `npm test` | **Pass** — 39 rules tests, offline protocol/assets/audio/UX/branding/cache/version, live Socket.io server (incl. restart and rematch), full phone+TV tap-through game, 300 robot games |
| `npm run test:modes` | **Pass** — 63 games, Standard/Long/Epic, 2–8 players |
| Real TV and phones | Not run |
| Human playtest | Not run |
