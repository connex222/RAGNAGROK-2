# RAGNAGROK V2 — Real-Player Playtest Protocol

**Do not manufacture results.** This is a template for future sessions.

## Test matrix

Run at least two sessions each with 2, 4, 6 and 8 people, including new and returning players. Start with Standard, then Extended and Epic after the first-session UX issues are resolved. Prefer testing on a genuine TV from 2–3 metres and at least one 320px-class phone.

## Facilitator observation sheet

Record: date, build version, player count, experience level, phone/browser model, session length, and whether any devices disconnected. During each round note: time to lock in, timing confusion, unaffordable actions, accidental taps, requests for rules explanation, stalled turns, confusing or abandoned actions and what surprised the players about disasters.

After the match, ask each player to score 1–5:

1. I understood what was happening.
2. My decisions made a difference.
3. Disaster outcomes were fair or understandable.
4. The game was enjoyable even when I was losing.
5. I'd play again.

Ask separately: “Which decision was most interesting?”, “What felt repetitive?”, “What stopped you from acting?”, “Was your god worth choosing?”, and “Would you immediately play another game?”

## Release thresholds to consider

Track join-to-start completion, game completion, planning time, disconnect recovery and immediate rematch rate. Investigate any critical UI blocker or reproducible premature phase transition before widening a playtest. Balance targets must be treated as hypotheses until human evidence supports them.


## dev.9 Show race / honours validation

Compare the **same Standard game length** under dev.8 and dev.9 with comparable player groups (ideally rotate version order). Do not expose two versions to players in one session. Record the build and whether the Show race panel was viewed; don't force participants to open it.

After the game, ask each player **without suggesting an answer**:

- "At the start of your last planning round, what were you trying to achieve and why?"
- "Could you tell what each announced Garden Show rewarded?"
- "Did you understand why you did or didn't receive points?"
- "Did the final ceremony give you a satisfying result even if you didn't win?"
- "Would you choose to play again right now?" (yes/no)

Record the same metrics in both versions. Useful exploratory targets include a median 4/5 or better for decision clarity, 4/5 enjoyment and at least 60% immediate rematch willingness, but these are **hypotheses**, not a definition of proven fun. Also watch whether the optional Show race panel lengthens average planning time; if it does, simplify or move it further down. Record observed rematches separately from stated intentions.

Use the anonymised CSV templates in this folder. Do not collect player names, email addresses or phone identifiers. The game does not automatically transmit survey responses.


## Phase 5: first-round guide and accessibility

Ask new players to choose a first action without coaching. Note whether they discover the suggestion, whether they understand it is optional, and whether they can choose a different action. Do not rate its usefulness for them. At least one tester should try keyboard-only operation at 320px width, large browser text, daylight/dusk themes, and reduced motion. Record whether a screen reader announces actual phase changes without announcing every second of the countdown. See `PHASE5-VALIDATION.md`.


## Phase 8: after-game feedback pulse

On build 1.2.0-dev.8 and later, the phone displays an **optional** post-game enjoyment rating and willingness-to-rematch question. The host can copy only grouped responses after at least three participants reply. Do not mistake the copied `would_rematch_now` count for observed rematches. Record an actual started rematch separately in `PLAYTEST-SESSIONS.csv`. No responses are retained between games or server restarts, so a host who wants an aggregate must copy it **before** beginning a rematch. For two-player sessions, record feedback with the existing anonymous paper template; no 2-person group score is exposed to the host phone. See `PHASE8-GAME-NIGHT.md`.
