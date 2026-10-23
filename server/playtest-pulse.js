'use strict';
/* Optional post-match pulse. Scores and willingness to replay are intentionally
   room-local, never sent to the television and never persisted to disk. */
const MIN_GROUP = 3;
function validFeedback(value) {
  return value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).sort().join(',') === 'enjoyment,rematch' &&
    Number.isInteger(value.enjoyment) && value.enjoyment >= 1 && value.enjoyment <= 5 &&
    typeof value.rematch === 'boolean';
}
function recordFeedback(room, seat, value) {
  if (room.state.phase.stage !== 'gameOver') return { ok: false, error: 'Finish the match before rating it' };
  if (!validFeedback(value)) return { ok: false, error: 'Choose an enjoyment score and whether you would play again' };
  if (!room.feedback) room.feedback = new Map();
  if (room.feedback.has(seat)) {
    const old = room.feedback.get(seat);
    return old.enjoyment === value.enjoyment && old.rematch === value.rematch
      ? { ok: true, alreadyRecorded: true }
      : { ok: false, error: 'Feedback has already been recorded for this match' };
  }
  room.feedback.set(seat, { enjoyment: value.enjoyment, rematch: value.rematch });
  return { ok: true };
}
function groupedFeedback(room) {
  const responses = [...(room.feedback || new Map()).values()];
  const base = { count: responses.length, players: room.state.players.length, minimum: MIN_GROUP };
  if (responses.length < MIN_GROUP) return base; // prevent singling out votes in small groups
  const sum = responses.reduce((n, x) => n + x.enjoyment, 0);
  return { ...base, mean: Math.round(sum / responses.length * 10) / 10,
    wouldRematch: responses.filter(x => x.rematch).length };
}
module.exports = { MIN_GROUP, validFeedback, recordFeedback, groupedFeedback };
