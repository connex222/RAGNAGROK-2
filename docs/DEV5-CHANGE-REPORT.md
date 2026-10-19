# RAGNAGROK v1.1.0-dev.5 — Naming and deployment consistency

**19 October 2026 — Internal development / playtesting build**

## Scope

Continued from the **v1.1.0-dev.4** ZIP without changing game mechanics, rules-engine probabilities, god powers, or match scoring.

### 1. Official spelling and presentation

- Visually inspected `public/img/logo.webp`: its lettering already reads **RAGNAGROK**. The artwork was retained.
- Corrected four potentially confusing references to a differently spelled mythological name in `public/v2/index.html` (2), `public/v2/rules.js` (1) and `docs/RULEBOOK-V2.md` (1).
- Standardised player-facing HTML page titles, join-screen brand headings and logo alternate text to **RAGNAGROK**, including the archived original game's public pages.
- Standardised the prominent report/document headings and Windows launcher *messages*. Existing BAT filenames are intentionally unchanged to avoid breaking desktop shortcuts or installation guides.
- Added `docs/BRAND-GUIDE.md` and `test/branding.test.js`; the brand check scans all supported text source formats and checks primary public page labels. It deliberately does not rename backward-compatible keys, folder names, schema IDs, or URLs.

### 2. Deployment and stale-client protection

- `server/cache-policy.js`: critical executable and rules assets (`.html`, `.js`, `.css`, `.json`, `.svg`) now request HTTP revalidation instead of remaining fresh for up to one hour. Binary pictures and sound can retain a one-hour cache.
- `server/index.js`: JSON game data routes now use `no-cache`; `/healthz` includes the active application version. This endpoint contains no credentials or private player details.
- `server/rooms.js`: Socket.io state views include a `meta.version` string.
- Both V2 clients check the version in state updates and via `/healthz` on load and every five minutes. A mismatch displays a blocking update notice and an explicit **Refresh game now** button. Refresh is never automatic during an active match.
- Kept existing player tokens and stored session identifiers intact so standard rejoin should still work after refreshing. The prompt warns that uncommitted local choices may need to be re-entered.
- Added dependency-free tests `test/cache-policy.test.js` and `test/build-version.test.js` with simulated version mismatch and refresh callback.

**Important:** The version guard starts in dev.5. Clients that are already running pre-dev.5 JavaScript cannot retroactively receive its mismatch UI. Live end-to-end upgrades still require browser testing.

### 3. Verified tests from dev.5 source

| Check | Result |
| --- | --- |
| V2 engine/regression tests | **38 passed** |
| Dependency-free multiplayer/room protocol groups | **16 passed** |
| Assets, SVG coverage, embedded script syntax | **Passed** |
| UX/reconnection checks | **3 passed** |
| Branding audit | **Passed — 72 text/source files audited** |
| Cache-policy checks | **Passed** |
| Version guard: matching, mismatching and refresh | **Passed in dependency-free VM tests** |
| V2 full-game smoke simulations | **63 completed — 21 per game length, player counts 2–8** |
| Package vs lockfile version metadata | **Matched** |
| Real Express/Socket.io browser integration | **Not run — Node modules unavailable** |
| Windows/physical TV and phones | **Not run** |
| Human balancing/fun assessment | **Not run** |

The V1 simulation invoked during development did not finish before execution timeout; no new V1 game-simulation success is claimed for dev.5. V1 public page wording and project source have been preserved.

### 4. Known remaining work

1. Run `npm ci` and the full server/browser suites on a network-enabled computer with npm dependencies installed.
2. Test an actual deployment upgrade with a TV and several phones already in a live match; confirm the new version notice, manual refresh, session restoration, and survival of locked plans.
3. Test rooms with 2–8 physical devices over Wi-Fi, including Ethernet host / Wi-Fi phone setups, disconnections, reconnections and rematches.
4. Conduct human playtests using `docs/PLAYTEST.md`; Standard and Long scores remain a balance investigation area.
5. Continue artwork/UI refinement after those stability gates, rather than expanding mechanics now.

## Commands

```powershell
npm ci
npm run test:offline
npm run test:modes
npm test
npm run test:all
```

`test:offline` does not require installed packages. The last two commands do require npm packages and may run many games.

**Status:** Internal development build — not certified for commercial public use.
