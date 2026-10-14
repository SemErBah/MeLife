import type { DayLog, Task, Tracker } from '../types';
import { addDays, weekday } from './date';
import { countOn, limitFor } from './reduce';
import { entryOf, isActive, isDone, isScheduled, type DoneContext } from './trackers';

/* Gün sonu ve hafta sonu özetleri — yargısız: ne yapıldıysa o listelenir. */

interface Data {
  trackers: Tracker[];
  days: Record<string, DayLog>;
  tasks: Task[];
  ctx: DoneContext;
}

export interface DaySummary {
  doneTasks: Task[];
  openTasks: Task[];
  doneRoutines: Tracker[];
  durations: { t: Tracker; minutes: number }[];
  reduce: { t: Tracker; count: number; limit: number }[];
  sleepMin?: number;
}

export function daySummary(date: string, { trackers, days, tasks, ctx }: Data): DaySummary {
  const day = days[date];
  const live = trackers.filter((t) => t.active);
  const sleepT = live.find((t) => t.type === 'sleep');
  return {
    doneTasks: tasks.filter((t) => t.forDate === date && t.done),
    openTasks: tasks.filter((t) => t.forDate === date && !t.done),
    doneRoutines: live.filter((t) => t.mode !== 'reduce' && t.type !== 'sleep' && t.type !== 'scale' && isDone(t, day, date, ctx)),
    durations: live.filter((t) => t.type === 'duration' && entryOf(t, day) > 0).map((t) => ({ t, minutes: entryOf(t, day) })),
    reduce: live.filter((t) => t.mode === 'reduce' && t.reduce && !t.paused)
      .map((t) => ({ t, count: countOn(t.id, day), limit: limitFor(t.reduce!, date) })),
    sleepMin: day?.sleep && sleepT ? entryOf(sleepT, day) : undefined,
  };
}

export interface WeekSummary {
  dates: string[];
  doneTasks: Task[];
  openTasks: Task[];                       // bu haftaya ait, bitmemiş (günlü + "bir ara")
  routines: { t: Tracker; done: number; planned: number }[];
  durations: { t: Tracker; minutes: number }[];
  reduce: { t: Tracker; avg: number; prevAvg: number | null; days: number }[];
  sleepAvg: number | null;                 // dakika
  moodAvg: number | null;                  // 1–5
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function weekSummary(weekOf: string, { trackers, days, tasks, ctx }: Data, today: string): WeekSummary {
  const dates = Array.from({ length: 7 }, (_, i) => addDays(weekOf, i));
  const inWeek = (t: Task) => (t.forDate ? t.forDate >= weekOf && t.forDate <= dates[6] : t.weekOf === weekOf);
  // Gelecek günler henüz yaşanmadı: özet bugüne kadar
  const past = dates.filter((d) => d <= today);
  const live = trackers.filter((t) => t.active);

  const routines = live
    .filter((t) => isActive(t) && t.mode !== 'reduce' && t.type !== 'scale')
    .map((t) => ({
      t,
      done: past.filter((d) => isDone(t, days[d], d, ctx)).length,
      planned: past.filter((d) => isScheduled(t, d)).length,
    }))
    .filter((r) => r.planned > 0 || r.done > 0);

  const durations = live
    .filter((t) => t.type === 'duration')
    .map((t) => ({ t, minutes: past.reduce((s, d) => s + entryOf(t, days[d]), 0) }))
    .filter((x) => x.minutes > 0);

  const reduce = live.filter((t) => t.mode === 'reduce' && t.reduce).map((t) => {
    const logged = (ds: string[]) => ds.filter((d) => d < today && days[d]?.entries?.[t.id] !== undefined).map((d) => countOn(t.id, days[d]));
    const cur = logged(dates);
    const prev = logged(dates.map((d) => addDays(d, -7)));
    return { t, avg: avg(cur) ?? 0, prevAvg: avg(prev), days: cur.length };
  }).filter((x) => x.days > 0);

  const sleepT = live.find((t) => t.type === 'sleep');
  const moodT = live.find((t) => t.type === 'scale');

  return {
    dates,
    doneTasks: tasks.filter((t) => inWeek(t) && t.done),
    // Bitmeyenler: geçmiş günlerinkiler + "bir ara" işleri (+ pazar akşamıysa bugününkiler). Önündeki günlerin planı karışmaz.
    openTasks: tasks.filter((t) => inWeek(t) && !t.done
      && (!t.forDate || t.forDate < today || (t.forDate === today && weekday(today) === 0))),
    routines,
    durations,
    reduce,
    sleepAvg: sleepT ? avg(past.filter((d) => days[d]?.sleep).map((d) => entryOf(sleepT, days[d]))) : null,
    moodAvg: moodT ? avg(past.map((d) => entryOf(moodT, days[d])).filter((v) => v > 0)) : null,
  };
}
