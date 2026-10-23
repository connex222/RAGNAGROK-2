# RAGNAGROK — Development Changelog

## v1.2.0-dev.7 — Reproducible multiplayer acceptance (23 October 2026)

- GitHub Phase 6 source verified byte-for-byte against the complete 225-file ZIP.
- GitHub Actions completed a fully green run on 23 October after introducing diagnostic logging for a previously intermittent round-7 browser stall; no engine regression was established by that earlier failure.
- Added a **test-only fixed game seed** passed explicitly from the real Socket.io browser acceptance harness through the server and room manager. Production servers retain cryptographic randomness, and neither HTTP nor socket commands accept the test seed.
- Added reproducibility tests, enhanced failure diagnostics and CI version synchronisation. Existing rules, scoring, player actions and graphics are unchanged.
- Human playtesting, physical TV/phone acceptance and repeat CI reliability remain outstanding; one green CI run is not a guarantee against future flaky failures.


## v1.2.0-dev.6 — TV reveal and reduced-motion acceptance (23 October 2026)

- **Theatre board refresh:** A newly revealed Pray action can share the same authoritative `stateVersion` as a previous reveal. The board cache now includes phase, theatre cursor, redirect destination and the complete threatened-plot set, preventing stale board frames.
- **Reduced-motion redirect:** The animated Pray SVG marker has a motion-free version that appears at the redirected destination when the user's OS requests reduced motion. CSS-only reduced-motion rules did not cover this SVG animation.
- **Actual code execution in automated tests:** Added four dependency-free contracts that render the TV Sympathy panel from a public-only view, exercise board memoisation during action reveals and verify the reduced-motion SVG.
- **Chromium TV coverage:** Seven authorised public-state TV screens (Omens, Plan, Sympathy Vote, Resolve, Disasters, Harvest, Show) at 1280×720, with no JavaScript errors or horizontal overflow; Resolve additionally verifies reduced motion. Snapshot tests mock networking, so they do not certify live Socket.io or real devices.
- **No changes** to scores, god powers, disasters, timers, save schema or npm dependencies. Prior Phase 5 hotfixes for the public Sympathy Vote still require verified GitHub publication and a green pipeline before release.

## v1.2.0-dev.5 — Real CI repair and first-round accessibility (23 October 2026)

- **GitHub real integration result:** Phase 4 CI successfully executed the real Socket.io V2 server integration suite, including reconnect, persistence and a full nine-round game. The subsequent phone UI test failed because it still assumed Long was the default; the browser robot was also outdated for Pray and Sympathy Vote. Updated these expectations and interactions so the genuine end-to-end suite can exercise the new game.
- **First-time guidance:** Added an optional first-round action recommendation based solely on the player’s visible legal targets and current affordable hand. The shortcut opens the normal action picker and never submits an action automatically. Hide Tips still controls its visibility.
- **Accessibility:** Polite screen-reader phase announcements, Tab/Shift+Tab modal focus containment, Escape support and reduced-motion handling; added eight offline checks and three headless Chromium tests at 320/375/430px.
- **Quality gates:** All offline, game-mode and simulated-controller full-match suites pass; true end-to-end integration on this build needs a fresh GitHub Actions run. Physical phones/TV, actual disconnect conditions and human enjoyment are not yet verified. See `docs/PHASE5-VALIDATION.md`. No scoring or networking rules changed.


## v1.2.0-dev.4 — Multiplayer protocol acceptance and private decisions (23 October 2026)

- **Full-match protocol tests:** four tests now run actual room-manager, handler and V2-engine flows with 2, 4, 6 and 8 simulated phone controllers. Every scenario completes all nine Standard rounds, chooses gods, uses Pray and the Sympathy Vote, exercises a disconnected seat's saved plan and duplicate command acknowledgement, reaches final scoring and rematches. Test sockets are local fakes; this is **not** an actual Socket.io transport test.
- **Sympathy Vote privacy:** the three category choices are sent only to the voter. The shared TV and rival phones see who is choosing, but not the options; non-voters still cannot choose. Public/private projection tests now enforce this.
- **Interactive browser checks:** new optional Python/Chromium suite tests Pray's forecast-to-destination picker at 320/375/430px, submits the Sympathy Vote in dusk/daylight styles, verifies rematch, and checks no horizontal overflow or unhandled script errors. These browser scenarios use engine-generated snapshots and mocked sockets; no network certification is implied.
- **UI colour consistency:** fixed an undefined `--gold` token used by the phone Show race; increased the resource-name font floor to 10px on narrow phones.
- **Tooling:** added `test:protocol-acceptance`, `test:phase4` and the protocol check to `test:offline`; updated version guards, notes and release documentation. No gameplay balance, disasters, scores, saved-game schema or dependencies were changed.

**Evidence:** `npm run test:offline`, `npm run test:modes`, archived V1 simulation and both optional Chromium suites passed in the isolated environment. `npm ci` could not complete (npm registry DNS/network access), so live Socket.io and physical-device multiplayer remain a launch blocker. Human replayability is not yet established. See `docs/PHASE4-VALIDATION.md`.

## v1.2.0-dev.3 — Multiplayer liveness and first-game presentation (23 October 2026)

- **Abandoned-room recovery:** manually paused games whose final phone controllers have disconnected now expire after the normal idle timeout, even when the shared TV remains attached. Active phone controllers keep paused games alive. Host credentials are revoked on removal.
- **Small-screen join:** the avatar selector now uses four accessible columns at widths up to 360px; no horizontal scroll at 320px in Chromium.
- **Action planning:** while a plan is incomplete, the bottom button now opens the next empty action slot, instead of displaying a disabled pseudo-button.
- **Resource labels:** narrow-phone typography keeps full names, including Sprinklers and Gnome Dust, inside the five-column resource bar.
- **TV heading/layout:** shortened the planning-phase heading and gave the timeline, TV controls and countdown separate visual space. Rules/Enable sound no longer obscure the round timeline in the tested layouts.
- **Testing:** added six dependency-free Phase 3 regression contracts, an optional real-Chromium scripted layout test with simulated snapshots, and six reference screenshots (join 320px, phone 320/375/430px, TV 720p/1080p).
- **Gameplay, scoring and balance values:** unchanged from dev.2. No new npm packages or changes to the V2 saved-game schema.

**Evidence:** `npm run test:offline`, `npm run test:modes` and the optional Python/Chromium visual suite pass. `npm ci` failed because the npm registry could not be reached (`EAI_AGAIN`); therefore live Socket.io tests and real TV/phone multiplayer tests remain unverified. No human fun/replayability outcomes are claimed.

## v1.2.0-dev.2 — Strategic interaction and balance diagnostics (23 October 2026)

- **Meddle / Pilfer:** if a neighbour has none of the supply matching the targeted plot, the action now steals one of their most plentiful supplies instead, if any remain. The usual plot supply still takes priority. No hidden hand is revealed during planning.
- **Aggressive robot:** stopped treating every sabotage as inherently better than garden-building. Weights now reward productive development, allow rational defence and avoid multiple planned Meddles against one target in the same turn. The robot also contributes modestly in emergencies.
- **Odin robot:** assesses both adjacent sectors before shifting disasters instead of blindly picking a direction. The live player's god power is unchanged.
- **Emergency thresholds:** raised the per-player thresholds to 1.0 / 1.2 / 1.5 across acts to compensate for improved robot contributions. Success rates require further validation with human players.
- **Evaluation:** added `test/phase2-benchmark.js` to report winning margins both with and without random opponents, god/style fair-share ratios, zero-Prestige finishes, action mix, destruction, Goodwill and emergency rates across modes.
- **Tests:** added two Pilfer regression tests covering alternative-supply theft and first preference for the targeted plot's terrain.
- **No new dependencies.** Saved game schema remains v4; all game-facing branding remains RAGNAGROK.

**Status:** An internal playtest build. This phase does not certify balanced gods, fun, real browser play, or multiplayer network reliability.

## v1.2.0-dev.1 — Party-game redesign (23 October 2026)

- Three conditions: Blighted, Ash and Blessed; old Frozen/Flooded/Infested disaster effects share Blighted.
- Six active features; removed Bee Hotel, Hedge Maze and Greenhouse, and removed Garden Design adjacency bonuses.
- Removed player-to-player trading. Standard is now the default; Extended is the display name of the `long` mode.
- Added **Pray to the Wrong God**: forecast redirection, paid conflicts, shelter counterplay, Loki's two-plot reach and immunity to ordinary prayer cancellation, Heimdall destination protection and Gnome Battalion cost waiver.
- Starting supplies increased to 2 Turf/2 Fertiliser/1 Sprinklers/2 Compost/2 Dust.
- Added **Sympathy Vote** after non-final Shows: last player picks one seeded category for the next Show with a 20-second clock; no free points.
- Added action blame text, disaster redirect marker animation, emergency pledge progress and clearer phone costs and resources.
- Archived V1 source and pages in `archive/v1/`, preserving compatibility and V1 robot simulations.
- Added 10 new rule regressions and revised the rules, two-minute guide, board artwork slots and brand checks.
- **Breaking save change:** V2 SCHEMA_VERSION 4. Older saved games are not automatically migrated.
- **Quality gate:** offline tests and game-mode simulations pass. Live Socket.io/browser and real-device playtests remain unverified.

---

## Previous development history (archived reports)

### DEV9-FUN-FIRST.md

# RAGNAGROK-2 v1.1.0-dev.9 — Replayability / feedback development

**Date:** 20 October 2026  
**Status:** Offline-validated development build; real multiplayer and human enjoyment not yet demonstrated.

## Aim

Make competition easier to follow, help players make intentional decisions and make the end of a match more satisfying for people who did not win. These changes are **information and ceremony only**: there are no balance, action-cost, disaster, Show scoring or god-power changes in this iteration.

## Implemented

| Area | File(s) | Behaviour |
|---|---|---|
| Single-source Show ranking | `src/engine/garden.js` | `categoryStandings()` is now used both to judge a Show and to calculate an upcoming Show's temporary public comparison. Tied leaders share a rank and point reward. Min-plot eligibility is retained. |
| Safe provisional preview | `src/engine/garden.js` | `upcomingShowStandings()` exposes only **announced** categories for the first unjudged Show. It neither reads secret plans nor changes state or RNG. Public and private views see the same public race. |
| Phone Show race | `public/v2/play.html` | Optional collapsed panel after the action slots gives the player's current position, possible points, eligibility and current leader. States clearly that secret actions/future events can change the result. |
| TV Show race | `public/v2/index.html` | The announced Show area lists category leaders and scores on the shared screen. |
| End-game honours | `src/engine/garden.js`, TV/phone UI | Showstopper, Garden Architect, Neighbourhood Hero and Lush Legend. All tied players receive a distinction. Zero achievements produce no honour. These **never add Prestige, shift rank or alter victory**. |
| Instructions | `public/v2/rules.js` | Explains temporary standing previews and that honours are cosmetic. |
| Testing | `test/fun-loop.test.js`, `package.json` | Nine new contracts cover hidden categories, read-only projections, ties, preview/judgement agreement, final outcomes and inline UI JavaScript parsing. |
| Playtesting | `docs/PLAYTEST.md`, two CSV templates | Structured measures for clarity, satisfaction, replay intent and actual rematches. |

## Automated checks performed

- `npm run test:offline` — **passed** (39 existing V2 rules checks, 9 new replayability checks plus the pre-existing protocol, contract, asset, branding and resilience suites).
- `npm run test:modes` — **passed** (63 full V2 robot matches, 2–8 players across all three game lengths).
- `node test/balance-lab.js candidate 35` — **passed**, 105 complete seeded robot matches.
- The exact same 105 seeds and configuration run against dev.8 produced **identical** ruin rates, winner margins, Show share and failed-action percentages. This validates absence of measurable balance change in this sample; it is not evidence of increased fun.
- `npm ci` and live Socket.io/browser tests — **not run**, npm registry DNS access unavailable. No claim of real-device or release readiness.

### Baseline / current balance snapshot (identical in dev.8 and dev.9)

| Mode | Matches | Ruined plots | Median winner margin | Show scoring share | Failed actions |
|---|---:|---:|---:|---:|---:|
| Standard | 35 | 25.03% | 15.69% | 57.58% | 2.22% |
| Long | 35 | 28.44% | 16.00% | 52.71% | 2.71% |
| Epic | 35 | 23.51% | 16.95% | 56.13% | 5.22% |

This small sample is diagnostic only. Historical target for median winner margin was under 15%; the samples above exceed it. Do not add rubber-band points just to force the number.

## Limitations / next gates

1. **Full Socket.io/browser verification:** Dependencies are not available in this environment; run `npm ci && npm test` on a machine with registry access, plus physical TV and phones.
2. **Visual usability:** Confirm at 320–430px widths and from ~2–3m on an actual TV that the preview is readable without displacing action choices.
3. **Human enjoyment:** Run blinded/comparable dev.8 versus dev.9 playtests using the templates; monitor planning friction, understanding, rematches and non-winner satisfaction.
4. **Balance and activity:** Standard/Long winner margins and Meddle's relative strength still warrant actual human playtesting before rebalancing.
5. **Commercial launch:** Not yet ready; neither a software release candidate nor a scientifically established fun rating.

## Design decisions

- Preview uses existing public, deterministic state, not predicted end-of-round results. This avoids rewarding advance knowledge of another player's secret plan.
- Cosmetic honours encourage distinctive strategies and give memorable outcomes without unfair catch-up points or forced leader penalties.
- A collapsed phone panel keeps decisions above commentary; the TV shows leaders more prominently for social conversation.
- V1 remains archived and unchanged.

---

### DEV8-RELIABILITY.md

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

---

### DEV7-ENGINE-NETWORK-ASSETS.md

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

---

### DEV6-CHANGE-REPORT.md

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

---

### DEV5-CHANGE-REPORT.md

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

---

### DEV4-CHANGE-REPORT.md

# RAGNAGROK v1.1.0-dev.4 — Engineering and game-design progress

**17 October 2026 · Internal playtesting build, not a commercial release**

## What was done

### Real player-session reliability

- **Phone reconnection under lost acknowledgements:** Previously, `rejoin()` removed a saved phone session when the server did not answer within six seconds, even if the session was still valid. Transient failures now preserve the token and schedule a retry when a socket is connected. Definitive room/token revocations still invalidate the local session.
- **TV startup/rejoin:** The host screen now catches room-create and attach failures, shows an error/retry control, and retains host credentials on transient failures. A `tv:recover` protocol command allows the *already authenticated, same TV socket* to retrieve its room code/host key/QR after a lost create ACK. Other sockets and player controllers cannot use that command.
- **QR room lifecycle:** A failed QR encoding no longer leaves an unreachable room. Overlapping `tv:create` calls from the same socket are refused while an asynchronous QR is pending, avoiding extra orphan rooms.
- **Dormant room-code protection:** New room codes do not reuse codes still reserved by saved `.json` or `.tmp` files, including sessions skipped because the configured MAX_ROOMS capacity has been reached.
- **Saved-session file permissions:** New or overwritten saved games (which contain bearer secrets) use owner-readable/writable `0600` permissions on POSIX systems. The save directory is created with `0700` if it does not already exist. Existing directory permissions are not changed.

### More usable phone/TV presentation

- The phone's planning screen shows a **risk count for this round** and the **announced next Garden Show categories** before action selection.
- Action cards now use separate **Edit** and **Clear** buttons instead of a role="button" nested within a real button. Clear now has a native accessible hit target.
- The planning bottom sheet preserves scroll position and attempts to retain keyboard focus when options or state re-render. Escape closes the modal.
- All owned garden hexes now have **contrasting numeric player-seat markers**, in addition to the existing coloured borders. Both TV and phone scoreboards use the same seat number. Colour vision is no longer the only way to identify a garden's owner.
- The mobile sheet height accepts modern viewport units (`dvh`) while retaining a fallback for older browsers.

### Gameplay decisions

**No new balance mechanics or score bonuses were introduced this iteration.** The 100-games-per-mode balance check reproduces the dev.3 rules. Standard and Long still miss the historic winner-margin target, while the environmental-destruction rate has improved since earlier development builds. A quick numeric band-aid could make the game worse; keep the existing rules until a more robust god- and strategy-aware evaluation and human testing are available.

## Test evidence from the modified files

| Test | Result | Notes |
| --- | --- | --- |
| `npm run test:offline` | **Passed** | 38 V2 rules tests; 16 protocol/persistence check groups; icon coverage, source syntax; 3 UX/reconnect checks |
| `npm run test:modes` | **Passed** | 63 completed games: 3 lengths × 7 player counts (2–8) × 3 seeds |
| `node test/sim.js 24` | **Passed** | 24 original V1 simulations (legacy regression) |
| `node test/balance-lab.js candidate 100` | **Partial run** | Completed Standard and Long (100 each) before tool timeout; no Epic result claimed from this interrupted run |
| `node test/balance-lab.js candidate 100 epic` | **Passed** | Completed 100 Epic games separately; see balance report |
| `npm ci` | **Unavailable here** | npm registry DNS inaccessible; live Socket.io, Express and jsdom dependencies not installed |
| Real Socket.io server/TV/browser integration | **Not run** | Requires actual npm packages and connected browser tests |
| Chromium headless rendering attempt | **Could not complete** | Local Chromium instance hung even on a blank page; no browser success claimed |
| Windows startup and real phones/TV | **Not run** | Physical testing required |

### Current 100-game-mode balance snapshot

| Mode | Ruined plots | Median winning margin | Garden Shows / total score | Failed actions |
| --- | ---: | ---: | ---: | ---: |
| Standard | 22.55% | 18.18% | 53.87% | 2.49% |
| Long | 27.23% | 20.00% | 49.79% | 2.74% |
| Epic | 22.74% | 12.86% | 54.96% | 4.81% |

These are *robot simulation* results, not human playtesting. The robot implementation does not simulate human negotiation and trades. The winner margin numbers are not proof of runaway leaders, only a reason for targeted design investigation.

## Recommended next development gate

1. On Windows (or a network-enabled CI environment), run `npm ci`, then `npm test` and `npm run test:all`. Debug actual Socket.io/browser failures; none can be certified in this environment.
2. Test one TV plus **2–8 physical phones** joining, losing Wi-Fi, rejoining, pausing/resuming, finishing and rematching. Include an Ethernet TV host and Wi-Fi phones if possible.
3. Run controlled playtests using `docs/PLAYTEST.md` and record **planning time, unclear rules, early quit rates and rematches**.
4. Validate whether Standard/Long margin differentials feel bad before changing scoring; test god-specific outcomes and trading-capable strategies.
5. Conduct a public deployment and security review, including persistent SAVE_DIR, PUBLIC_URL, proxy trust, rate limiting and monitoring.

The game remains an **internal playtesting development build** rather than a fully tested public release.

---

### RELEASE-NOTES.md

# v1.1.0-dev.4 — Connection recovery, safer rooms and planning usability (17 October 2026)

**Internal development candidate only.** No full live-network or physical-device certification.

- Phone reconnection no longer deletes the saved seat token on a transient Socket.io acknowledgement timeout. It retries automatically while retaining the session and clears only demonstrably invalid sessions.
- Existing host TV connections can securely retrieve their own room code, host key and QR link if the initial create acknowledgement was lost. This is accessible only to the already authenticated TV socket.
- Room creation is protected against overlapping asynchronous QR requests and QR failures; inaccessible orphan rooms are cleaned up.
- Dormant saved room-code filenames are reserved against new-room creation, preventing accidental overwrites when MAX_ROOMS skips some restores.
- Save files storing player tokens and host keys are written with owner-only permissions on supporting platforms.
- Phone planning displays forecast risks and next-Show categories above action slots; Edit/Clear are separate real buttons rather than nested controls.
- Phone planning sheets preserve scroll position and keyboard focus while re-rendering and support Escape to close.
- Every owned garden plot displays a contrasting numbered player marker as well as a coloured ownership border; corresponding labels appear on the TV scoreboard and phone Garden tab.
- TV startup failures are visible, with a retry control; transient attach failures preserve the saved host key.
- Added independent regression tests for room-code reservations, concurrent/failing QR requests, TV host recovery, saved-file permissions, SVG ownership labels and phone transient reconnects.
- No new game mechanics or disaster tuning were introduced in dev.4: measured balance results reflect the existing dev.3 rules and robot strategies, not a new balance fix.

See `reports/balance-v2-dev4-check.md` and `Ragnagrok-v1.1.0-dev.4-Changes.md` included alongside the ZIP.

# v1.1.0-dev.3 — Reliability, scoring and final-act balance (17 October 2026)

**Development/playtest candidate only. Not certified for public release.**

- Fixed the Hardy Perennial competition excluding players with zero damaged plots.
- Fixed Blessed allowing a zero-health Ruined plot to harvest.
- Provisional Act III balance change: Surtur's Mower causes one health damage
  rather than two, and simultaneous Act III disasters decrease from 2 to 1
  (2–4 players) or 3 to 2 (5–8 players). Its large-area threat remains.
- Hardened join URLs: forwarded scheme/host are ignored unless TRUST_PROXY=1,
  while a same-host browser Origin can select HTTPS when appropriate.
- Invalid JSON save files with room-code names are quarantined automatically.
- Room restorations respect MAX_ROOMS while retaining excess valid saves.
- Added rules, protocol, simulation and security regression checks.
- See `reports/balance-lab-v1.1.0-dev.3.md` for paired-seed exploratory results.

# v1.1.0-dev.2 — Second development pass (17 October 2026)

**Development/playtest build. Not certified for public or commercial deployment.**

### Reliability and security

- One active phone controller per player seat. A replacement connection detaches the old connection and informs its browser; a stale connection cannot continue issuing actions.
- Prevents a bound phone from joining multiple seats or swapping its role into a host TV without leaving first.
- Refuses repeat `tv:create` from a socket that is already attached to a game.
- Adds a configurable cap on active rooms (`MAX_ROOMS`, 100 by default) and a useful error when full.
- Pause/resume now shifts disconnected-player grace timers in addition to the planning deadline, including a player who disconnects during the pause.
- Save loading validates the state structure, room identity and seat/token consistency rather than checking only the schema number. Malformed but parseable matching-schema saves are moved into `saves/corrupt`.
- Original V1 save recovery is covered in the offline protocol suite.

### Visuals and rules consistency

- Added nine original, editable SVG feature icons and five condition icons under `public/img/`.
- Artwork discovery already supports SVG; game board and phone feature picker automatically use these icons.
- Phone garden list now displays the corresponding feature artwork.
- Corrected the phone Tend description, confirmation preview and TV how-to-play summary to say that Tend restores health **and** clears a harmful condition.
- The game engine itself was not rebalanced in this pass; old balance reports remain diagnostic.

### Validation

- `npm run test:offline`: **passed** (35 V2 rules tests, 8 protocol/persistence test groups, 14 icon checks and JavaScript syntax checks).
- `npm run test:modes`: **63** completed seeded robot games across Standard, Long, Epic and all player counts 2–8; see `reports/smoke-v2-dev2.md`.
- Full live `test/server2.test.js`, `test/ui2.test.js`, V1 Socket.io tests, actual Windows launcher, and real phones/TV **not executed** because npm dependencies and physical devices were unavailable in this environment.
- A 1,000-game run was attempted but did not finish within execution limits; no result from it has been used as balance evidence.

### Remaining release blockers

1. Install dependencies with `npm ci` on Windows or CI and execute the full `npm test` and `npm run test:all` suites, fixing failures.
2. Real-device testing with 2–8 phones, Wi-Fi/Ethernet, disconnections, host control, restart and rematch.
3. Larger statistically meaningful balance batches (particularly god powers and trading) followed by human playtesting. Ruined plots and winner margins are still too high for Standard and Long in the robot samples.
4. Complete human-led onboarding, contrast, TV viewing distance and screen-reader/accessibility checks.
5. Verify the long-term persistence strategy on the chosen host. Without persistent SAVE_DIR storage, a host restart loses running matches.
6. Release licensing, naming and security audits.

---

# RAGNAGROK v1.1.0-dev.1 — Development Work Report

**Status: internal playtesting only; not a final commercial release.**

## Implemented

- Fixed disconnected players being counted as locked. Planning still respects its original deadline and honours a short configured grace period if a participant disconnects close to expiry.
- Preserved unfinished/locked plans across disconnect/reconnect; extra regression tests cover both.
- Prevented trades from consuming a locked plan's resources. Outgoing offers expire when the proposer locks, and locked parties cannot accept trades.
- Validated total committed action costs and emergency pledges before locking; warned when resources are insufficient.
- Improved automatic composting so, where possible, shed overflow discards uncommitted cards first rather than the resources needed by an already locked plan.
- Corrected atomic validation of combined lobby settings; invalid combinations now leave the entire state unchanged.
- Corrected god selection in the simulator to seeded Fisher–Yates rather than a comparator-based pseudo-shuffle.
- Corrected robot planning so compulsory shed overflow is subtracted before choosing actions and pledges; robots now retry unaffordable plans instead of corrupting simulations.
- Changed Tend so removing a harmful condition also restores 1 health; Freya restores 2.
- Added a limited garden-positioning score: qualifying Bee Hotels, Water Features and Hedge Mazes earn +1 final Prestige each, with bonus details in score reporting.
- Corrected misleading Ash, Epic-action-count and locked-trading explanations in the in-game rules.
- Hardened command and feature-name lookups against inherited-object property names such as `constructor` and `__proto__`.
- Prevented blindly trusting socket-supplied `X-Forwarded-For` for room-code rate limiting unless the operator explicitly enables trusted proxy operation.
- Changed the Windows launcher to wait for `/healthz` before opening the browser; added dependency install error handling.
- Added a standalone rulebook, Windows guidance updates, playtest protocol and physical/hybrid concept note.
- Incremented the V2 saved-state schema to 3. V2 rc1 saved matches are incompatible with the new rules and will be moved to the incompatible-saves folder rather than loaded into a changed ruleset.

## Tests and limitations

- All **35** V2 rules unit/regression tests passed after these changes.
- The actual engine is exercised by seeded robot simulations; see `reports/balance-v2-*.md`.
- HTML inline scripts and modified JavaScript files passed syntax checks.
- Socket.io server, browser/DOM and cross-device integration tests **not verified** in this environment because npm package installation did not complete. These are mandatory release blockers, not passing tests.
- Windows `.bat` was updated but **not executed on Windows** here. It needs an actual Windows trial.
- Real-player usability, accessibility, 2–8-device sessions, security penetration testing and player-retention measurements are **not yet performed**.
- The full artwork set still lacks separate polished icons for some feature/condition asset references; emoji fallbacks remain possible.

## Balance decisions

The supplied original ZIP contained historical reports with simulation assumptions since corrected. Old and new samples are not directly equivalent because the shuffle, robot resource planning and rules have changed. The current reports are diagnostic, **not certification of fairness or fun**.

The early post-fix Standard sample showed improved destruction from 38.6% to ~34%; the 15% margin and 30% ruined-plot objectives are **not reliably met** across game modes. Sample sizes remain too small for precise per-god comparisons. Do not make additional major disaster/scoring changes solely to hit a percentage without real-player feedback.

## Next release blockers (highest priority first)

1. Install dependencies on Windows or a reliable CI runner; run and fix `test/server2.test.js`, `test/ui2.test.js` and V1 compatibility suites.
2. Validate the revised locked-resource and server disconnect behaviour in an actual live match, including concurrent reconnects and host pause/resume.
3. Run at least 1,000 varied seeded games per major balance configuration and improve the bot test methodology for negotiation, goals and tactical interference.
4. Conduct genuine four-, six- and eight-person playtests; tune disaster pressure, scoring gaps, god abilities and the Meddle incentive from evidence.
5. Complete missing game icons, TV readability, smartphone onboarding, reduced motion and accessibility checks.
6. Establish durable session recovery for production hosting; document ephemeral-storage risks.
7. Complete licensing/trademark clearance and release QA before charging players or manufacturing.

This report deliberately does **not** claim that every item from the original master prompt is finished.

## Latest reproducible samples (post-fix)

| Mode | Games | Median winning margin | Ruined owned plots | Emergency success | Shows share |
|---|---:|---:|---:|---:|---:|
| Standard | 320 | 19.0% | 34.0% | 48.9% | 56.2% |
| Long | 180 | 19.6% | 38.8% | 53.1% | 53.9% |
| Epic | 80 | 14.7% | 26.9% | 57.5% | 55.3% |

These use the revised seed/shuffle and bot resource-planning logic. **Epic's sample is small; no definitive balance claim is justified.** Standard and Long still miss their winner-margin and ruined-plot targets. They require another balance cycle after human playtesting.

---

