// Pure streak calculators. Given a SET of date keys (yyyy-MM-dd) on which the
// user "hit" the goal, returns current + longest consecutive-day streaks.
// Calling code is responsible for deciding what counts as a hit.

import { addDays, daysBetween, localDateKey, parseDateKey } from "./dates";
import type { DateKey, StreakInfo } from "../types";

export function computeStreak(hits: Iterable<DateKey>, today: DateKey = localDateKey()): StreakInfo {
  const set = new Set<string>();
  for (const d of hits) set.add(d);
  if (set.size === 0) return { current: 0, longest: 0 };

  const sorted = [...set].sort();
  let longest = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const gap = daysBetween(sorted[i - 1], sorted[i]);
    if (gap === 1) {
      run += 1;
      if (run > longest) longest = run;
    } else if (gap > 1) {
      run = 1;
    }
  }

  // Current streak: walk back from today (or yesterday if today not yet hit)
  // — counting today as not-yet-failed.
  let cursor: Date;
  if (set.has(today)) cursor = parseDateKey(today);
  else {
    const y = localDateKey(addDays(today, -1));
    if (!set.has(y)) return { current: 0, longest, lastDate: sorted.at(-1) };
    cursor = parseDateKey(y);
  }
  let current = 0;
  while (set.has(localDateKey(cursor))) {
    current += 1;
    cursor = addDays(cursor, -1);
  }
  return { current, longest, lastDate: sorted.at(-1) };
}
