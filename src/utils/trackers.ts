import type { DayLog, Task, Tracker } from '../types';
import { addDays, timeToMin, weekDays, weekday } from './date';

/* Rutin mantığı — zorunluluk yok: yapılmayan şey nötr, yapılan sayılır. */

/** Tamamlanma hesabı için dışarıdan gelen bağlam (ör. eski "yarının 3 işi" görev listesine bakar) */
export interface DoneContext {
  tasksFor: (date: string) => number;
}

export const isActive = (t: Tracker) => t.active && !t.paused;

export function isScheduled(t: Tracker, date: string): boolean {
  return !t.days || t.days.length === 0 || t.days.includes(weekday(date));
}

export const entryOf = (t: Tracker, day?: DayLog) => day?.entries?.[t.id] ?? 0;

export function isDone(t: Tracker, day: DayLog | undefined, date: string, ctx: DoneContext): boolean {
  if (t.mode === 'reduce') return false; // azaltılan şey "yapılacak iş" değildir
  if (t.key === 'plan3') return ctx.tasksFor(addDays(date, 1)) > 0;
  if (t.type === 'sleep') return !!day?.sleep;
  const v = entryOf(t, day);
  switch (t.type) {
    case 'check': return v >= 1;
    case 'scale':
    case 'number': return v > 0;
    default: return v >= (t.doneAt ?? t.target ?? 1);
  }
}

/** Bu hafta (Pzt–Paz) kaç gün yapıldı — bilgi amaçlı */
export function weeklyCount(t: Tracker, days: Record<string, DayLog>, date: string, ctx: DoneContext): number {
  return weekDays(date).filter((d) => isDone(t, days[d], d, ctx)).length;
}

/** O gün yapılan şey sayısı: tamamlanan rutinler + görevler */
export function doneCount(
  trackers: Tracker[], day: DayLog | undefined, date: string, tasks: Task[], ctx: DoneContext,
): number {
  const routines = trackers.filter((t) => t.active && t.mode !== 'reduce' && isDone(t, day, date, ctx)).length;
  return routines + tasks.filter((t) => t.forDate === date && t.done).length;
}

/** İsteğe bağlı zincir: art arda en az bir şey kaydedilen gün sayısı (bugün henüz boşsa kırılmaz). */
export function streak(
  trackers: Tracker[], days: Record<string, DayLog>, today: string, tasks: Task[], ctx: DoneContext,
): number {
  let count = 0;
  for (let i = 0, d = today; i < 400; i++, d = addDays(d, -1)) {
    if (doneCount(trackers, days[d], d, tasks, ctx) > 0) count++;
    else if (d !== today) break;
  }
  return count;
}

/* ── Sıralama ─────────────────────────────────────────── */

const ORDER_LAST = 99_999;

export const byTime = (dayStartHour: number) => (a: Tracker, b: Tracker) =>
  (a.time ? timeToMin(a.time, dayStartHour) : ORDER_LAST) - (b.time ? timeToMin(b.time, dayStartHour) : ORDER_LAST) || a.order - b.order;

/** Görevler: yapılmayanlar önce; saatliler saat sırasıyla, sonra yıldızlılar, sonra eklenme sırası */
export const taskSort = (dayStartHour: number) => (a: Task, b: Task) =>
  Number(a.done) - Number(b.done)
  || (a.time ? timeToMin(a.time, dayStartHour) : ORDER_LAST) - (b.time ? timeToMin(b.time, dayStartHour) : ORDER_LAST)
  || Number(!!b.star) - Number(!!a.star)
  || a.order - b.order || a.createdAt - b.createdAt;
