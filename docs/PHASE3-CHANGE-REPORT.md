# RAGNAGROK — Phase 3 Development & Validation Report

**Build:** `1.2.0-dev.3`  
**Date:** 23 October 2026  
**Source:** `RAGNAGROK-2-v1.2.0-dev.2.zip`  
**Deliverable:** `RAGNAGROK-2-v1.2.0-dev.3.zip`  
**Status:** Internal playtest build, not production certified

## Purpose

Phase 3 concentrates on the real first-game experience and multiplayer session liveness. No more game mechanics were introduced. This reduces the risk of adding features ahead of completing genuine multiplayer and human tests.

## Actual implementation

| Finding | Before | Now | Files |
|---|---|---|---|
| Abandoned game with TV | An explicitly paused match could remain indefinitely when the TV stayed connected after every phone left | Idle cleanup now detects **zero authenticated phone controller sockets** for an active match, regardless of whether the pause was manual or automatic. The existing idle timeout is respected, and connected controllers prevent accidental removal | `server/rooms.js` |
| Join screen at 320px | Six avatar columns could push the screen wider than the viewport | Four columns at widths up to 360px; minimum widths are suppressed so tap targets fit | `public/v2/play.html` |
| Incomplete plan | A disabled orange button simply said to choose more actions | An enabled **Plan action 1 · 2 remaining** button opens the next available planning slot | `public/v2/play.html` |
| Resource labels | Sprinklers and Gnome Dust could wrap awkwardly on small screens | Responsive typography preserves the full names in the five-column resource bar | `public/v2/play.html` |
| TV progress display | Rules and Enable Sound buttons overlapped the coloured round progression and, at smaller sizes, long round text crowded the header | Timeline, controls and countdown now occupy separate horizontal areas; planning heading is shortened | `public/v2/index.html` |
| Regression evidence | No specific regression for manually paused rooms with a TV connected | New dependency-free `test/phase3-validation.test.js` with six focused contracts | `test/phase3-validation.test.js`, `package.json` |
| Browser visuals | No fresh narrow-phone and TV layout suite | Python Playwright harness uses genuine Chromium and reproducible **mock** authorised game snapshots at 320/375/430px on phones and 720p/1080p TVs; captures six screenshots | `test/phase3-visual.py`, `reports/phase3/` |
| Release identification | dev.2 | Updated `package.json`, lockfile, TV/phone compatibility constants and changelog to dev.3 | `package.json`, `package-lock.json`, `CHANGELOG.md`, `README.md` |

Additional documentation: `docs/PHASE3-VALIDATION.md`. The mode smoke runner also generated `reports/smoke-v2-dev3.md`.

## Verification — actually executed

| Command / check | Result |
|---|---|
| `npm run test:offline` | **Passed**: 39 V2 rules, protocol, 10 engine contracts, 9 replayability, 12 party-rule tests, six Phase 3 tests and other audio/artwork/version/branding/resilience checks |
| `npm run test:modes` | **Passed**, 63 complete robot games: 2–8 players in Standard, Extended and Epic, three seeds for each player count |
| `node test/sim.js 24` | **Passed**, 24 archived V1 games |
| `python test/phase3-visual.py` | **Passed**, six Chromium layouts with mocked state; no uncaught script errors or horizontal overflow, and the CTA opens a picker |
| HTML embedded JavaScript parse checks | **Passed** |
| `npm ci` | **Failed**: DNS lookup of npm registry returned `EAI_AGAIN`; npm could not finish dependency installation |
| `npm test` / genuine Socket.io suite | **Not run**; required dependencies unavailable |
| Actual phone-to-TV multiplayer | **Not run**; physical devices and networks still required |
| Real people / enjoyment / rematch observation | **Not run**; cannot be inferred from bot matches |

**Browser test qualification:** The Chromium suite executes the real HTML/CSS/JavaScript and board rendering, but uses a fake Socket.io client with engine-generated public/private state snapshots. It is a UI layout test, **not** confirmation of real network delivery, disconnection, reconnecting or actual audio playback.

## What was deliberately not changed

- Pray, Meddle, Loki, Sympathy Vote, disaster probabilities, god powers, scoring, supplies and other balance values.
- The V2 saved-game schema (`4`) or event/payload interfaces.
- Archived V1 mechanics.
- The no-new-npm-dependencies constraint.

There is no new god-win-rate or human-replayability claim from this build. The Phase 2 balance findings remain open.

## Remaining release blockers

1. Install dependencies on a connected development machine or CI runner: `npm ci && npm test`. Investigate any failing actual Socket.io integration tests.
2. Test four, six and eight simultaneous physical phones with a TV host, including a mid-plan disconnect, post-lock reconnect, manual and automatic pause, data/network switching and saved-game restoration.
3. Conduct observed first-time player sessions. Record whether the new action CTA actually improves first-round planning and how long players need to understand Pray, Shows and disasters.
4. Run real-world accessibility checks (colour-blind users, reading distance, screen reader, touch targets and light/dark settings).
5. Conduct subsequent balance passes using measured human behaviour; Standard/Extended winning margins and weak strategies still need attention.

**Recommendation:** Do not label dev.3 a public release. Use it for the next controlled acceptance test with human players and real devices, alongside the checklist in `docs/PHASE3-VALIDATION.md`.
