# RAGNAGROK-2 v1.1.0-dev.8 — Network and asset reliability

**20 October 2026 · Internal development build**

## Scope and implementation

This phase builds on dev.7. It focuses on the remaining problems around dropped action acknowledgements, interrupted sessions and stalled WebP requests. It does **not** change game scoring, god powers, disaster tuning or board-generation rules.

| Change | Files | Reason |
| --- | --- | --- |
| Canonical action fingerprints and bounded request-ID cache | `server/action-requests.js`, `server/handlers.js` | Duplicate delivery returns the original response; an ID reused for a *different* command is rejected rather than silently acknowledged as success. |
| Persist up to 256 recent action responses when `SAVE_DIR` is enabled | `server/rooms.js`, `server/handlers.js` | Protect against duplicate execution when a phone resends an accepted command after a room restart. Missing optional field in older save files remains supported. |
| Validate restored reply caches | `server/rooms.js`, `server/action-requests.js` | Invalid cache records quarantine the saved room instead of entering an unsafe state. |
| Clear caches on rematch | `server/rooms.js` | IDs from the preceding game cannot replay in a new one. |
| Revoke socket privileges when a room closes | `server/rooms.js`, `server/handlers.js` | Former player/TV sockets cannot continue issuing commands with stale room credentials. |
| Client acknowledgement retry reuses the same request ID | `public/v2/play.html` | A phone makes one automatic retry when the connection is still active following a timeout. |
| Timeout stalled artwork and allow failures to retry later | `public/assets.js` | A nonterminating request or `Image.decode()` cannot monopolise one of four loader slots indefinitely. |
| Version bump and matching TV/phone compatibility guards | `package.json`, `package-lock.json`, `public/v2/index.html`, `public/v2/play.html` | Keeps client/server protocol version checks consistent. |
| Expanded offline and optional real-socket assertions | `test/resilience.test.js`, `test/preloader.test.js`, `test/server2.test.js` | Prevents regressions in request replay, persistence, corruption handling, bounded memory and image stalls. |

## Network action semantics

- Each new phone action includes a distinct `requestId`. A retry of the *same intended action* uses **the same** ID and the same payload.
- The server stores the SHA-256 fingerprint of a canonicalised action payload, so harmless object-key ordering differences do not change command identity.
- A repeated ID with a different action fails with a clear error, without state mutation.
- The cache is limited to the latest 256 `{seat, requestId}` pairs. Older IDs can be evicted: this is not an unlimited, distributed exactly-once guarantee.
- If persistent storage is enabled, those entries are saved with the room; a resumed match can return the original result after a restart. If the host has no persistent volume, a restart destroys the match and cache.
- Saves are debounced (two seconds). **A process crash between a successful action and durable save can still lose the last accepted action or reply.** No claim of crash-proof exactly-once execution is made.
- A rematch starts with a fresh cache. A paused room returns cached replies for already processed commands, but refuses new commands until play resumes.
- Only the owning seat can retrieve an earlier reply for its action ID. The cache stores success/error responses, not other players' private events.

## Asset loading semantics

- The loader continues to request no more than four images at a time.
- Each image or decode gets a 12-second logical timeout; failed loads release their queue slot.
- A later preload can retry a URL that previously failed. Successful downloads are cached for the session.
- Failed images use existing UI fallbacks; this code does not force successful network delivery.
- The timeout is not an HTTP abort, so a browser may continue transferring an abandoned asset in the background. A later optimisation could adopt explicit request cancellation and content-hashed asset filenames.

## Test evidence in the build environment

| Test | Outcome |
| --- | --- |
| `npm run test:offline` | **Passed** after changes; V2 rules, dependency-free Socket.io handler simulation, source/asset checks, RNG/board contracts and WebP timeout scenarios |
| `npm run test:modes` | **Passed**: 63 complete V2 matches, 3 modes × 7 player counts (2–8) × 3 seeds |
| `node test/sim.js 24` | **Passed**: 24 archived V1 games |
| Real Socket.io/Express server suite (`npm test`) | **Not executed** here; `npm ci` could not complete due unavailable npm registry/packages |
| Optional Vitest adapter | **Not executed**; Vitest is not included in the lockfile and must be installed before use |
| Physical phones/TV, real Wi-Fi loss and Windows launcher | **Not executed** |

The GitHub Actions workflow already performs `npm ci`, `npm test` (which includes the updated `test/server2.test.js`) and `npm run test:modes` on connected CI runners. Check the actual CI results on your next push rather than assuming success.

## Suggested next quality gate

1. On a connected Windows development PC or CI runner, run `npm ci && npm test && npm run test:modes`.
2. Complete one real-TV/multiple-phone match. Disconnect one player while planning and again while resolving; test lost acknowledgements, browser refresh, phone sleep, host reconnection and rematch.
3. If `SAVE_DIR` is enabled, intentionally restart the server after saving a locked action and confirm that the restored game does not execute it again on retry.
4. Record the results. Address any actual live-integration or device bugs **before** additional gameplay systems are added.

**Release status:** Playtest development candidate, not production-verified.
