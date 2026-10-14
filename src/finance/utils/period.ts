import type { Cashflow, Transaction } from '../types';
import { isSpending, txKind } from './effects';
import { parseDate, toLocalDateStr } from './format';

/* Dönem = maaştan maaşa. Maaşın günü ve tutarı değişken; dönem "Maaş yattı" kaydıyla başlar.
   Hiç maaş kaydı yoksa takvim ayı kullanılır. */

const addDays = (date: string, n: number) => {
  const d = parseDate(date);
  d.setDate(d.getDate() + n);
  return toLocalDateStr(d);
};
const diffDays = (a: string, b: string) => Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86_400_000);
const monthStart = (date: string) => `${date.slice(0, 7)}-01`;
const prevMonthStart = (date: string) => {
  const d = parseDate(monthStart(date));
  d.setMonth(d.getMonth() - 1);
  return toLocalDateStr(d);
};

export interface Period { start: string; end: string; bySalary: boolean }

export function salaryDates(txs: Transaction[]): string[] {
  return Array.from(new Set(txs.filter((t) => txKind(t) === 'salary').map((t) => t.date))).sort();
}

/** Bugünü içeren dönem ve bir öncekisi */
export function currentPeriods(txs: Transaction[], today: string): { current: Period; previous: Period } {
  const dates = salaryDates(txs).filter((d) => d <= today);
  if (dates.length) {
    const start = dates[dates.length - 1];
    const prevStart = dates.length > 1 ? dates[dates.length - 2] : prevMonthStart(start);
    return {
      current: { start, end: today, bySalary: true },
      previous: { start: prevStart, end: addDays(start, -1), bySalary: dates.length > 1 },
    };
  }
  const start = monthStart(today);
  return {
    current: { start, end: today, bySalary: false },
    previous: { start: prevMonthStart(today), end: addDays(start, -1), bySalary: false },
  };
}

/** Tüm dönemler, yeniden eskiye (işlem listesi gezintisi için) */
export function allPeriods(txs: Transaction[], today: string): Period[] {
  const dates = salaryDates(txs).filter((d) => d <= today);
  const out: Period[] = [];
  let end = today;
  for (let i = dates.length - 1; i >= 0; i--) {
    out.push({ start: dates[i], end, bySalary: true });
    end = addDays(dates[i], -1);
  }
  // İlk maaştan öncesi: takvim ayları, en eski işleme kadar
  const oldest = txs.reduce((m, t) => (t.date < m ? t.date : m), end);
  let cursor = end;
  while (cursor >= oldest && out.length < 60) {
    const start = monthStart(cursor);
    out.push({ start, end: cursor, bySalary: false });
    cursor = addDays(start, -1);
  }
  return out;
}

export const inPeriod = (date: string, p: Period) => date >= p.start && date <= p.end;
export const periodDays = (p: Period) => diffDays(p.start, p.end) + 1;

export function spentIn(txs: Transaction[], p: Period): number {
  return txs.filter((t) => isSpending(t) && inPeriod(t.date, p)).reduce((s, t) => s + t.amount, 0);
}

export function byCategory(txs: Transaction[], p: Period): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of txs) if (isSpending(t) && inPeriod(t.date, p)) out[t.category] = (out[t.category] ?? 0) + t.amount;
  return out;
}

/** Bir sonraki maaşın tahmini tarihi: son maaşlar arası ortalama süre; tek kayıt varsa ~30 gün; hiç yoksa ipucu günü */
export function expectedSalary(txs: Transaction[], today: string, hintDay?: number): string | null {
  const dates = salaryDates(txs);
  if (dates.length >= 2) {
    const recent = dates.slice(-4);
    const gaps = recent.slice(1).map((d, i) => diffDays(recent[i], d));
    const avg = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
    return addDays(dates[dates.length - 1], Math.min(Math.max(avg, 20), 40));
  }
  if (dates.length === 1) {
    if (hintDay) {
      const d = parseDate(dates[0]);
      const next = new Date(d.getFullYear(), d.getMonth() + 1, Math.min(hintDay, new Date(d.getFullYear(), d.getMonth() + 2, 0).getDate()));
      return toLocalDateStr(next);
    }
    return addDays(dates[0], 30);
  }
  if (!hintDay) return null;
  const t = parseDate(today);
  const clamp = (y: number, m: number) => Math.min(hintDay, new Date(y, m + 1, 0).getDate());
  const thisMonth = toLocalDateStr(new Date(t.getFullYear(), t.getMonth(), clamp(t.getFullYear(), t.getMonth())));
  return thisMonth;
}

/** "Maaş yattı mı?" sorulsun mu: tahmini günden 1 gün önce başlar, son 10 günde maaş girildiyse sorulmaz */
export function shouldAskSalary(txs: Transaction[], today: string, hintDay?: number): boolean {
  const exp = expectedSalary(txs, today, hintDay);
  if (!exp) return false;
  const last = salaryDates(txs).filter((d) => d <= today).pop();
  if (last && diffDays(last, today) < 10) return false;
  return diffDays(today, exp) <= 1;
}

export const lastSalaryAmount = (txs: Transaction[]) =>
  txs.filter((t) => txKind(t) === 'salary').sort((a, b) => b.date.localeCompare(a.date))[0]?.amount;

/* ── Abonelik & faturalar: sessiz kayıt yok, sorar ───── */

const isMonthlyDay = (s: string) => /^\d{1,2}$/.test(s.trim());

/** Kalemin bu ayki tarihi (aylıklar) ya da tek seferlik tarihi */
export function billDateFor(cf: Cashflow, today: string): string {
  if (!isMonthlyDay(cf.expectedDate)) return cf.expectedDate;
  const t = parseDate(today);
  const y = t.getFullYear(), m = t.getMonth();
  return toLocalDateStr(new Date(y, m, Math.min(Number(cf.expectedDate), new Date(y, m + 1, 0).getDate())));
}

export function isBillHandled(cf: Cashflow, today: string): boolean {
  if (!isMonthlyDay(cf.expectedDate)) return !!cf.lastPaidPeriod || !!cf.lastProcessedDate;
  const ym = today.slice(0, 7);
  return cf.lastPaidPeriod === ym || (!!cf.lastProcessedDate && cf.lastProcessedDate.slice(0, 7) === ym);
}

/** Bugün sorulacak kalemler: tarihi gelmiş/geçmiş, bu ay işlenmemiş, ertelenmemiş */
export function dueBills(cashflows: Cashflow[], today: string): (Cashflow & { due: string; late: number })[] {
  return cashflows
    .filter((cf) => {
      if (isBillHandled(cf, today)) return false;
      if (!isMonthlyDay(cf.expectedDate) && cf.isRecurring === false && cf.lastProcessedDate) return false;
      if (cf.skippedUntil && cf.skippedUntil > today) return false;
      return billDateFor(cf, today) <= today;
    })
    .map((cf) => ({ ...cf, due: billDateFor(cf, today), late: diffDays(billDateFor(cf, today), today) }))
    .sort((a, b) => b.late - a.late);
}

/** Sıradaki tarih (liste için): bu ay işlendiyse gelecek ay */
export function nextBillDate(cf: Cashflow, today: string): string | null {
  if (!isMonthlyDay(cf.expectedDate)) return isBillHandled(cf, today) ? null : cf.expectedDate;
  const thisMonth = billDateFor(cf, today);
  if (!isBillHandled(cf, today)) return thisMonth;
  const t = parseDate(today);
  const y = t.getFullYear(), m = t.getMonth() + 1;
  return toLocalDateStr(new Date(y, m, Math.min(Number(cf.expectedDate), new Date(y, m + 1, 0).getDate())));
}

export { addDays as addDaysStr, diffDays };
