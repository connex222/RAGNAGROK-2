# RAGNAGROK-2 — Dev.7 Engine Tests, Network Resilience, and Staged Assets

## Scope

This update implements concrete code changes while retaining the existing CommonJS / Express / Socket.io architecture. `src/engine/rules.js` is **the archived V1 game**; the active V2 engine is `src/engine/garden.js`. Both require tests.

## 1. Core engine unit tests

**Files:** `test/engine-contracts.js`, `test/engine-contracts.test.js`, `test/vitest/engine.spec.mjs`.

The framework-neutral contract suite uses `node:assert/strict`. The same test cases run through a dependency-free Node runner and an optional Vitest adapter. The suite currently covers:

- Exact known mulberry32 RNG output and continued seed state; `[0,1)` bounds; integer dice bounds; deterministic, in-place shuffle.
- Standard and expanded board inventories, port uniqueness, the scorched plot, reproducibility, and the 6/8 adjacency restriction.
- Bidirectional hex-neighbour topology and hex corner uniqueness.
- Deterministic V1 starts from the same seed and timestamp. Random **authentication tokens are deliberately excluded** from equivalence assertions.
- Invalid actions leaving state untouched; terminal-state immutability.
- One-point-short and above-threshold V1 victory fixtures.
- Deterministic timer-based faction selection.
- Deterministic V2 start, unauthorised token handling, and no secrets/private hands in TV/public views.

### Run without installing anything

```bash
npm run test:offline
node test/engine-contracts.test.js
node test/modes-smoke.js
```

### Run through Vitest

Vitest is **not bundled or added to the lockfile** because npm registry access was unavailable in the development environment. With an internet connection and Node.js 20+:

```bash
npm install --save-dev vitest
npm run test:vitest
```

`test/vitest/engine.spec.mjs` imports `describe` and `it` from Vitest and executes the same contract list. Installing Vitest updates `package.json` and `package-lock.json` in sync. Do not manually insert Vitest into `package.json` without updating the lockfile, or `npm ci` on GitHub Actions will fail.

### Example of creating a deterministic transition test

```js
const { createGame, addPlayer, apply } = require('./src/engine/rules');
const a = createGame({ roomCode: 'TEST', seed: 1337, now: 1000 });
const b = createGame({ roomCode: 'TEST', seed: 1337, now: 1000 });
for (const game of [a, b]) {
  addPlayer(game, { name: 'Alice' }, 1000);
  addPlayer(game, { name: 'Bob' }, 1000);
  if (!apply(game, 0, { type: 'start' }, 1500).ok) throw Error('start failed');
}
// Compare public game state, boards, phase and RNG — not random session tokens.
require('node:assert/strict').deepEqual(a.board, b.board);
```

**Next cases to add:** property-based randomised state-machine testing; production/harvest conservation; five-to-eight-player interaction permutations; replayable high-severity disaster seeds; full end-to-end final-result assertions; fuzz testing for every action type.

## 2. Network and error resilience

**Files:** `server/payload-validation.js`, `server/handlers.js`, `server/rooms.js`, `server/index.js`, `public/v2/play.html`, `test/resilience.test.js`.

### Boundary validation

`validatePayload` rejects malformed roots, arrays as top-level commands, excessive nesting, arrays with more than 50 entries, strings over 1,024 characters, nonfinite numbers, dangerous prototype keys and cumulative payloads over 4 KB. The event handler returns `{ ok: false, error }` instead of attempting to execute bad commands. `Socket.io` independently enforces the 16 KB maximum transport payload.

This is a **structural** security boundary. The engine still performs **semantic** validation for a given action: targets, costs, player permissions, game phase and valid enumerations.

### Idempotent commands when acknowledgements are lost

Phone actions now carry a `requestId`. The room records the most recent 256 action responses per game instance keyed by `{seat}:{requestId}`. If the same command is delivered twice, the second attempt returns the cached reply without changing state or rebroadcasting events.

A retry must reuse the *same* request ID. A new click requires a new ID:

```js
const requestId = 'action_12345678';
let reply;
try {
  reply = await socket.timeout(6000).emitWithAck('action', {
    type: 'plan', slots: [], requestId
  });
} catch (_) {
  // If an ACK was lost, retry with the SAME requestId.
  // The engine still validates the current phase before new actions.
  reply = await socket.timeout(6000).emitWithAck('action', {
    type: 'plan', slots: [], requestId
  });
}
```

This is a **bounded, in-process** deduplication guarantee, not distributed exactly-once delivery. Recent reply cache is not restored across server restarts. After restarting, rely on the authoritative snapshot and never infer whether a command succeeded merely from its lost ACK.

### Fresh snapshots after disruption

`player:rejoin` already authenticates using a seat token and pushes a fresh private view. The new `state:request` event allows an attached client to request its current authorised snapshot without broadcasting state to every socket. The response contains `{ ok: true, stateVersion }` and the fresh `state` event is sent separately.

```js
socket.on('connect', async () => {
  // Reauthenticate first if this is a replacement connection.
  await socket.timeout(6000).emitWithAck('player:rejoin', { code, token });
  await socket.timeout(6000).emitWithAck('state:request', {});
});
```

Do not blindly append missed event animations as if they were authoritative state. The V2 phone and TV already ignore state snapshots with older `stateVersion` values.

### Abandoned room protection

When *all phone players* become disconnected mid-match, `RoomManager.refreshConnected()` automatically pauses the game, preserving phase deadlines and reconnect grace. When every player reconnects, the game resumes. The host cannot forcibly resume with zero online player controllers. An auto-paused abandoned room expires after the configured `idleMinutes`, even if a TV socket remains connected.

A single dropped player does **not** pause everybody else's match: the existing V2 planning/disconnect rules still determine what happens at the planning deadline.

### Network settings

`server/network.js` is currently a join-URL helper, **not** the Socket.io transport client. Keep LAN-interface detection and QR URL construction there. Reconnection belongs in the browser Socket.io client and the room manager. Socket.io server ping settings were changed from 10s/8s to 20s/20s to tolerate occasional mobile interruptions better. This means dead clients may take longer to be detected; test with actual Android/iOS devices and your deployment network.

**Open architecture limitations:** room data remains single-process and in-memory unless `SAVE_DIR` is configured; load balancing requires affinity and shared state architecture. Room-code/seat tokens must never be logged or sent in public views. The bounded deduplication cache does not survive restarts.

## 3. Staged WebP artwork loading

**File:** `public/assets.js`. Loaded by `public/v2/index.html` (TV) and `public/v2/play.html` (phone).

The loader provides:

- `RagnaAssets.preloadGroup(art, keys)` to request specific image slots.
- `RagnaAssets.preloadWhenIdle(art, keys)` to schedule noncritical batches during idle time.
- At most four simultaneous image requests.
- Promise caching and duplicate-key elimination.
- Decode-before-resolve when the browser supports `Image.decode()`.
- Failure containment; a missing/broken asset reports `loaded: false` and existing icon fallbacks remain available.
- Asset lookup by **known art-map keys**, never arbitrary user-input URLs.

TV stage 1: logo and TV background. TV stage 2: deity portraits, terrain, garden features, plot conditions. Phone stage 1: logo and deity face thumbnails; phone stage 2: larger deity portraits and game resource/feature/condition artwork.

Example:

```js
const manifest = RagnaBoard.artMap(await (await fetch('/art.json')).json());
await RagnaAssets.preloadGroup(manifest, ['logo', 'background-tv']);
RagnaAssets.preloadWhenIdle(manifest, Object.keys(manifest)
  .filter(key => key.startsWith('deity-') || key.startsWith('feature-')));
```

A WebP that is preloaded into the browser's cache can later be used by ordinary `<img src="...">` elements or SVG `<image>` links. For long lists or gallery content, add native `loading="lazy"` to **off-screen** HTML images; do not defer visible board tiles, current player portraits or current interaction targets.

### Future performance work

Measure real-world Core Web Vitals and image transfer size on slow 4G. Consider versioned long-cache filenames for raster assets. Avoid preloading dozens of noncritical images before showing the lobby; this creates competition for the initial UI's network bandwidth.

## 4. Verification status

Ran successfully in the current offline environment:

- 39 existing V2 rules assertions.
- 16 existing protocol/persistence check groups.
- 10 new cross-engine contracts.
- 5 new network/room lifecycle checks.
- 2 new asset loader tests.
- Existing asset, sound, version, branding, UX and cache checks.
- 63 complete V2 game-mode smoke simulations, including 2–8 players in Standard/Long/Epic.

**Not run:** Vitest itself, real Socket.io/browser integration and live network packet-loss tests; Node dependencies could not be installed because the npm registry could not be resolved. Run these after installation in an environment with registry access:

```bash
npm ci
npm run test:offline
npm run test:modes
npm run test:vitest      # only after installing Vitest as above
npm test                 # includes real Socket.io/browser tests
```

`npm test` includes 300 additional simulated games and may take longer to run.

## 5. Release guidance

This is **v1.1.0-dev.7**, a source development build and not a production certification. Test a TV host and 2–8 phones on one LAN and on a remote Render server before release. Explicitly test mobile backgrounding, host departure, wifi-to-cellular transitions, browser tab refresh, server restart, and a failed ACK followed by a request-ID retry.

Brand rule: use **RAGNAGROK**, never the usual mythological spelling, for game-facing text and releases.
