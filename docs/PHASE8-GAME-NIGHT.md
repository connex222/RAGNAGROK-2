# RAGNAGROK — Phase 8 game-night playtest

**Build:** 1.2.0-dev.8 (23 October 2026) · **Status:** test tooling implemented, real participant data not yet collected.

## Purpose

Find out whether ordinary players **understand the game**, **enjoy the disasters and rivalries**, and **choose to play again**. Neither an automated win-rate simulation nor five-star survey responses prove repeat-play appeal.

## A realistic 45-minute first session

1. Seat 3–5 friends with one actual television and phones. Record build SHA, browser versions, player count, network setup and whether each has played before. Do not log names or phone identifiers.
2. Have everyone join from the TV's QR code, then ask one first-time player to explain the game after reading the two-minute guide. Record confusing terminology without correcting the player in advance.
3. Play Standard without facilitator intervention unless the game becomes stuck. Note failed actions, long decisions, awkward first turns, outbursts of laughter, complaints and whether the least-successful gardener stays engaged.
4. At the end, offer the optional two-question pulse. Players can decline without consequence. Rematch never depends on submission.
5. If **three or more** gardeners respond, the host can tap **Copy group totals** and paste `version,players,responses,mean_enjoyment,would_rematch_now` into the session notes. The results are aggregated, not individual.
6. Explicitly ask for a new game **without promising a change or reward**. Record whether a second match was *actually started*, separately from the survey's predicted willingness.
7. Compare with later groups of 2, 4, 6 and 8 players on actual hardware. Repeat on day and dusk themes and with reduced motion.

## Privacy and analysis

- Feedback is accepted only after a game finishes, from a joined and authenticated phone; invalid ratings, unexpected fields and changed resubmissions are rejected.
- Each answer is held under the player's **seat number only**, in volatile room memory, to prevent duplicates. No IP address, name, free text or account information is captured as feedback.
- Host-only combined scores are hidden until **3 replies**; nonhosts and TV never receive feedback data. Two-player groups show only response counts, not the scores.
- Feedback is **not persisted** or transmitted to any analysis service. It vanishes on rematch, server restart or room closure. The host must deliberately copy grouped values before rematching.
- This tool is **not a substitute** for the existing anonymous paper/CSV facilitation template. Low response rates can severely bias results.

## Targets (hypotheses, not results)

- Suggested: 4/5 or better median enjoyment, 60%+ willingness to play again, at least half of groups actually begin a rematch, and no repeated serious UI blockages. Interpret with sample sizes and confidence intervals rather than claiming statistically established enjoyment.
- Require multiple independent sessions with first-time players, different group sizes and real TV + phones before a public release decision.

## Test matrix

| Test | Tool | Interpretation |
|---|---|---|
| Server response validation, privacy and rematch reset | `npm run test:phase8` | Automated (not human play) |
| Complete offline engine and handler regression | `npm run test:offline` | Automated |
| Real Socket.io full game with feedback | `node test/server2.test.js` | Live software integration (not physical phones) |
| Phone at 320, 375, 430 pixels; aggregate/non-host views | `npm run test:phase8:browser` | Chromium with stub sockets |
| Full game modes | `npm run test:modes` | Seeded robots |
| Actual interest in another game | Facilitator/session records | Requires real people |

## Outstanding gates

Physical-device playtesting; dropped connections on Wi-Fi and cellular; actual TV readability at 3 metres; supervised participant enjoyment and repeat matches. Without these, this remains a development build.
