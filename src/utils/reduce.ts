import type { DayLog, ReducePlan, Tracker } from '../types';
import { addDays, daysBetween } from './date';

/* Kötü alışkanlığı azaltma — kademeli, suçlamasız.
   Sınır bir öneridir: aşılırsa sadece bilgi verilir, ceza yok. */

export const isReduce = (t: Tracker) => t.mode === 'reduce';

export const DEFAULT_TRIGGERS = ['Kahve', 'Stres', 'Yemek sonrası', 'Sosyal', 'Can sıkıntısı', 'Yolda'];

/** O haftanın önerilen günlük sınırı: başlangıçtan her hafta stepPerWeek azalır, floor'un altına inmez */
export function limitFor(plan: ReducePlan, date: string): number {
  const weeks = Math.max(0, Math.floor(daysBetween(plan.startDate, date) / 7));
  return Math.max(plan.floor, plan.start - plan.stepPerWeek * weeks);
}

/** Bir sonraki sınır düşüşü kaç gün sonra (sabit ya da tabana inmişse null) */
export function daysToNextStep(plan: ReducePlan, date: string): number | null {
  if (plan.stepPerWeek <= 0 || limitFor(plan, date) <= plan.floor) return null;
  const elapsed = Math.max(0, daysBetween(plan.startDate, date));
  return 7 - (elapsed % 7);
}

export const countOn = (id: string, day?: DayLog) => day?.entries?.[id] ?? 0;

/** En son ne zaman (bugün ya da önceki 2 gün içinde) */
export function lastTime(id: string, days: Record<string, DayLog>, today: string): number | null {
  for (let i = 0; i < 3; i++) {
    const times = days[addDays(today, -i)]?.times?.[id];
    if (times?.length) return Math.max(...times);
  }
  return null;
}

export interface ReduceStats {
  series: { date: string; count: number; limit: number | null; logged: boolean }[];
  avg7: number;           // son 7 kayıtlı günün ortalaması
  prevAvg7: number;       // ondan önceki 7 kayıtlı gün
  saved: number;          // başlangıca göre içilmeyen adet (kayıtlı günlerde)
  savedMoney: number;     // ₺
  urges: number;          // toplam atlatılan istek
  triggers: { tag: string; n: number }[];
  bestStreakUnder: number; // art arda sınırın altında/eşit kalınan gün (bugün dahil)
}

export function reduceStats(t: Tracker, days: Record<string, DayLog>, today: string, span = 14): ReduceStats {
  const plan = t.reduce!;
  const series = Array.from({ length: span }, (_, i) => {
    const date = addDays(today, i - span + 1);
    const day = days[date];
    return { date, count: countOn(t.id, day), limit: date >= plan.startDate ? limitFor(plan, date) : null, logged: day?.entries?.[t.id] !== undefined };
  });

  // Biten ve kayıtlı günler (plan başlangıcından beri; bugün henüz bitmediği için dahil değil)
  const loggedDates = Object.keys(days)
    .filter((d) => d >= plan.startDate && d < today && days[d]?.entries?.[t.id] !== undefined)
    .sort();
  const counts = loggedDates.map((d) => countOn(t.id, days[d]));
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const last = counts.slice(-7);
  const prev = counts.slice(-14, -7);

  const saved = counts.reduce((sum, c) => sum + Math.max(0, plan.start - c), 0);
  const perUnit = plan.unitPrice && plan.perPack ? plan.unitPrice / plan.perPack : 0;

  const tagTotals: Record<string, number> = {};
  let urges = 0;
  for (const d of Object.keys(days)) {
    if (d < plan.startDate) continue;
    urges += days[d]?.urges?.[t.id] ?? 0;
    for (const [tag, n] of Object.entries(days[d]?.tags?.[t.id] ?? {})) tagTotals[tag] = (tagTotals[tag] ?? 0) + n;
  }

  let streak = 0;
  for (let d = today; d >= plan.startDate; d = addDays(d, -1)) {
    const day = days[d];
    if (day?.entries?.[t.id] === undefined && d !== today) break;
    if (countOn(t.id, day) <= limitFor(plan, d)) streak++;
    else break;
  }

  return {
    series,
    avg7: avg(last),
    prevAvg7: avg(prev),
    saved,
    savedMoney: saved * perUnit,
    urges,
    triggers: Object.entries(tagTotals).map(([tag, n]) => ({ tag, n })).sort((a, b) => b.n - a.n),
    bestStreakUnder: streak,
  };
}

/** "1 sa 12 dk" gibi; 1 dakikadan azsa "az önce" */
export function sinceText(ms: number): string {
  const min = Math.floor(ms / 60_000);
  if (min < 1) return 'az önce';
  if (min < 60) return `${min} dk`;
  const h = Math.floor(min / 60);
  const r = min % 60;
  return r ? `${h} sa ${r} dk` : `${h} sa`;
}
