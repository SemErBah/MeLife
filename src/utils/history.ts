import type { DayLog, Tracker } from '../types';
import { addDays, weekday, weekStart } from './date';
import { isDone, isScheduled, type DoneContext } from './trackers';

/** Rutin geçmişi (12 hafta): yapılan günler, seriler (yalnız planlı günler sayılır), en çok yapılan gün, son notlar */
export function routineHistory(t: Tracker, days: Record<string, DayLog>, today: string, ctx: DoneContext, weeks = 12) {
  const start = addDays(weekStart(today), -7 * (weeks - 1));
  const done = new Set<string>();
  const perWeekday = [0, 0, 0, 0, 0, 0, 0];
  let best = 0, run = 0;
  for (let d = start; d <= today; d = addDays(d, 1)) {
    if (isDone(t, days[d], d, ctx)) {
      done.add(d);
      perWeekday[weekday(d)]++;
      run++;
      best = Math.max(best, run);
    } else if (isScheduled(t, d) && d !== today) run = 0;
  }
  let current = 0;
  for (let d = today; d >= start; d = addDays(d, -1)) {
    if (done.has(d)) current++;
    else if (isScheduled(t, d) && d !== today) break;
  }
  const max = Math.max(...perWeekday);
  const bestWeekday = done.size >= 6 && max >= 3 ? perWeekday.indexOf(max) : null;
  const notes = Object.keys(days)
    .filter((d) => d >= start && d <= today && days[d]?.notes?.[t.id])
    .sort().reverse().slice(0, 4)
    .map((d) => ({ date: d, text: days[d].notes![t.id] }));
  return { done, total: done.size, current, best, bestWeekday, notes };
}
