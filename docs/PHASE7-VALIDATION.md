# RAGNAGROK — Phase 7 multiplayer acceptance

**Version:** 1.2.0-dev.7  
**Date:** 23 October 2026

## Verified GitHub source

The 225-file dev.6 ZIP was checked against GitHub `main` at commit `97df10654e3d059635eb4daed411e1b544be9ec3`: its Git tree SHA matched exactly (`a0dc3466d3262c38ac2cfc476b4c4578d18aac25`). The initial CI job failed when the automated browser player stopped making progress during round 7. No rule/engine error was identified. A later CI run with more detailed stalled-player diagnostics passed completely at commit `4376ad48c63014793e140ee1a10a2f100fabe73f`.

## Phase 7 changes

- `RoomManager` accepts an explicit optional `gameSeed` **only from in-process test code**, used by `createGame` for deterministic board and disasters.
- `startServer` can pass that test-only seed directly; no environment variable, HTTP route or socket command accepts it.
- The JSDOM phone acceptance test uses seed `215063` for the game and its existing seed `99` for simulated tap decisions. The room code and authentication tokens remain securely random.
- New `test/phase7-seed.test.js` ensures explicit seeds work, invalid values fail, production seed remains unspecified, and failure diagnostics remain available.
- No gameplay balancing or scoring changes, no extra npm dependencies.

## Commands

```bash
npm ci
npm run test:offline
npm run test:modes
npm test
npm run test:protocol-acceptance
python test/phase5-browser.py
python test/phase6-browser.py
```

Browser test can still fail on scheduling, UI state or other bugs. When stalled, it now reports a privacy-safe per-phone summary of the stage, action sheet, locked state and available controls, with no join or authentication tokens. Do not replace failing checks with automatic success or skip steps.

## Still outstanding

The CI run for this **exact version**, stress/repeated browser tests on separate runners, device disconnect/reconnect on actual phones, 320px accessibility testing on hardware, and measured human rematches must be completed before claiming release readiness. Follow `docs/PHASE6-ACCEPTANCE.md` for the physical-session script.
