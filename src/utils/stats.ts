import type { DayLog, StudySession, Tracker } from '../types';
import { addDays, weekStart } from './date';
import { entryOf, isDone, isScheduled, type DoneContext } from './trackers';

/* İstatistik hesapları — yargısız, sadece eğilim. */

export const rangeDates = (end: string, n: number) => Array.from({ length: n }, (_, i) => addDays(end, i - n + 1));

export const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Rutin başına: planlanan günlerin kaçında yapıldı */
export function routineRates(trackers: Tracker[], days: Record<string, DayLog>, dates: string[], ctx: DoneContext) {
  return trackers
    .filter((t) => t.active && t.mode !== 'reduce' && t.type !== 'scale')
    .map((t) => {
      const planned = dates.filter((d) => isScheduled(t, d));
      const done = planned.filter((d) => isDone(t, days[d], d, ctx)).length;
      return { t, done, planned: planned.length, pct: planned.length ? done / planned.length : 0 };
    })
    .filter((r) => r.planned > 0)
    .sort((a, b) => b.pct - a.pct);
}

/** Günlük değer serisi (kayıt yoksa null) */
export function dailySeries(t: Tracker | undefined, days: Record<string, DayLog>, dates: string[]) {
  return dates.map((d) => {
    const day = days[d];
    if (!t) return { date: d, value: null as number | null };
    if (t.type === 'sleep') return { date: d, value: day?.sleep ? entryOf(t, day) : null };
    const has = day?.entries?.[t.id] !== undefined && (day.entries[t.id] > 0 || t.mode === 'reduce');
    return { date: d, value: has ? entryOf(t, day) : null };
  });
}

/** Yatış saati: 18:00'den sonraki dakika (grafikte gece yarısı geçişini düz çizmek için) */
export function bedMinutes(days: Record<string, DayLog>, dates: string[]) {
  return dates.map((d) => {
    const bed = days[d]?.sleep?.bed;
    if (!bed) return { date: d, value: null as number | null };
    const [h, m] = bed.split(':').map(Number);
    const mins = h * 60 + m;
    return { date: d, value: mins < 18 * 60 ? mins + 24 * 60 - 18 * 60 : mins - 18 * 60 };
  });
}

/** Haftalık ders çalışma (dk): oturumlar varsa onlar, yoksa ders rutininin süreleri */
export function weeklyStudy(sessions: StudySession[], days: Record<string, DayLog>, studyTracker: Tracker | undefined, dates: string[]) {
  const weeks = Array.from(new Set(dates.map(weekStart)));
  return weeks.map((w) => {
    const wd = dates.filter((d) => weekStart(d) === w);
    const fromTracker = studyTracker ? wd.reduce((s, d) => s + entryOf(studyTracker, days[d]), 0) : 0;
    const fromSessions = sessions.filter((s) => wd.includes(s.date) && (!studyTracker || s.trackerId !== studyTracker.id)).reduce((a, s) => a + s.minutes, 0);
    return { week: w, minutes: fromTracker + fromSessions };
  });
}

export function minutesByCourse(sessions: StudySession[], dates: string[]) {
  const set = new Set(dates);
  const out: Record<string, number> = {};
  for (const s of sessions) if (set.has(s.date)) out[s.courseId ?? '_'] = (out[s.courseId ?? '_'] ?? 0) + s.minutes;
  return out;
}
