# Ragnagrok v1.1.0-dev.4 — Engineering and game-design progress

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
