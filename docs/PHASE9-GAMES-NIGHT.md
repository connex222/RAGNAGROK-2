# RAGNAGROK — Phase 9 games-night acceptance

**Build:** `1.2.0-dev.9` · **Date:** 23 October 2026 · **Status:** automated checks require passing CI; physical testing outstanding.

## What is counted

- **Matches started:** accepted host Start actions, including the first match.
- **Matches completed:** final states counted once by the authoritative server.
- **Rematches started:** accepted host Start actions following a completed match and an explicit rematch. Opening a new lobby does *not* count.
- **Match number:** the current match ordinal, including a pending rematch lobby.

The authenticated host phone can copy aggregate totals as `version,players,matches_started,matches_completed,rematches_started`. A non-host phone and the shared TV never receive `meta.session`. The public TV may display a match number. No per-person data, phone identifiers or feedback ratings are included. The optional Phase 8 feedback still disappears on rematch or server restart.

## Real-player acceptance

1. Start a game with three or more phones and a TV. Check Match 1 and one match started.
2. Finish a real game. Confirm the host phone shows one completion. The TV and other players must not receive the host session record.
3. Try the optional pulse and also try a rematch without pulse submission. Both should work.
4. Tap **Play again** on the host phone. Everyone should see Match 2 in the lobby, but **rematches started must still be zero**.
5. Tap **Start the game**. The host record should now show one rematch actually started; reconnect a phone and check that the number stays one.
6. With `SAVE_DIR` on persistent disk, restart the server, reconnect, and confirm that the record survives but private feedback does not.
7. Record *voluntary* player participation separately on the existing anonymous session sheet. A host-controlled start alone does not prove willingness or enjoyment.

## Commands

```bash
npm ci
npm run test:phase9
npm run test:offline
npm test
npm run test:protocol-acceptance
npm run test:modes
```

## Limitations

Counts are scoped to one room, not across fresh room codes. A restart without durable `SAVE_DIR` loses the whole room. Existing saves from before dev.9 have no historical session count, so are initialised conservatively. The test harness uses programmatically completed phases solely to verify server bookkeeping; it does not supply human enjoyment evidence. Real-device QA and observed games-night rematches are still necessary.
