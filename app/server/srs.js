// SM-2 based spaced repetition (CLAUDE.md, section 1).
// The first five successful reviews follow the fixed ladder 1, 3, 7, 14, 30 days; after that the
// interval grows by the SM-2 ease factor. A failed recall goes back to the 1-day pool.

export const LADDER = [1, 3, 7, 14, 30];
export const GRADES = { again: 1, hard: 3, good: 4, easy: 5 }; // SM-2 quality (0-5)
export const MIN_EASE = 1.3;
export const START_EASE = 2.5;

const pad = (n) => String(n).padStart(2, '0');
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return fmt(new Date(y, m - 1, d + n));
}

export const intervalDays = (stage) => Math.max(1, parseInt(stage, 10) || 1);

/** SM-2 ease update: EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)), never below 1.3. */
export function updateEase(ease, q) {
  const ef = (Number(ease) || START_EASE) + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  return Math.max(MIN_EASE, Math.round(ef * 100) / 100);
}

/**
 * Next schedule for a vocabulary row after a review graded again | hard | good | easy.
 * hard keeps the current interval, good moves one step up the ladder, easy skips a step.
 */
export function schedule(row, grade, today) {
  const q = GRADES[grade];
  if (q === undefined) throw Object.assign(new Error('grade must be again, hard, good or easy'), { status: 400 });
  const ease = updateEase(row.ease, q);
  const cur = intervalDays(row.stage);
  let reps = Number(row.reps) || 0;
  let days;
  if (q < 3) {
    days = 1;
    reps = 0;
  } else {
    reps += 1;
    const i = LADDER.indexOf(cur);
    if (grade === 'hard') days = cur;
    else if (cur >= LADDER[LADDER.length - 1] || i === -1) days = Math.round(Math.max(cur, LADDER[LADDER.length - 1]) * ease * (grade === 'easy' ? 1.3 : 1));
    else days = LADDER[Math.min(LADDER.length - 1, i + (grade === 'easy' ? 2 : 1))];
  }
  const mastered = q < 3 ? 'No' : row.mastered === 'Yes' || (q >= 4 && cur >= LADDER[LADDER.length - 1]) ? 'Yes' : 'No';
  return { stage: `${days}d`, next: addDays(today, days), ease: ease.toFixed(2), reps: String(reps), mastered };
}

/** What each grade would do, for the review buttons. */
export function preview(row, today) {
  return Object.fromEntries(Object.keys(GRADES).map((g) => [g, schedule(row, g, today).stage]));
}
