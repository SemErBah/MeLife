import type { Cashflow, Debt, SavingsGoal, Transaction } from '../types';
import { daysUntil, isInMonth, parseDate, safePct, toLocalDateStr } from './format';

export const DEFAULT_MONTHLY_LIMIT = 15000;

export type LimitStatus = 'safe' | 'warn' | 'over';

export const statusOf = (pct: number): LimitStatus =>
  pct >= 100 ? 'over' : pct > 75 ? 'warn' : 'safe';

export const STATUS_COLOR: Record<LimitStatus, string> = {
  safe: 'var(--emerald-base)',
  warn: 'var(--warning-base)',
  over: 'var(--danger-base)',
};

export const STATUS_TEXT: Record<LimitStatus, string> = {
  safe: 'text-emerald',
  warn: 'text-warning',
  over: 'text-danger',
};

export function monthTransactions(transactions: Transaction[], year: number, month: number) {
  return transactions.filter((t) => isInMonth(t.date, year, month));
}

export function sumBy(txs: Transaction[], income: boolean) {
  return txs.filter((t) => t.isIncome === income).reduce((s, t) => s + t.amount, 0);
}

export const sortByDateDesc = (txs: Transaction[]) =>
  txs.slice().sort((a, b) => b.date.localeCompare(a.date));

/**
 * Kırmızı Çizgi hesaplayıcısı.
 * Günlük limit, BUGÜNDEN ÖNCEKİ harcamalara göre sabitlenir; böylece bugün
 * harcadıkça limit de küçülüp harcamayı iki kez saymaz.
 */
export function computeBudget(transactions: Transaction[], monthlyLimit: number, now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const remainingDays = daysInMonth - day + 1;
  const todayStr = toLocalDateStr(now);

  const monthTx = monthTransactions(transactions, year, month);
  const monthExpense = sumBy(monthTx, false);
  const monthIncome = sumBy(monthTx, true);
  const todayExpense = sumBy(monthTx.filter((t) => t.date === todayStr), false);

  const spentBeforeToday = monthExpense - todayExpense;
  const dailyLimit = Math.max(monthlyLimit - spentBeforeToday, 0) / remainingDays;
  const todayLeft = dailyLimit - todayExpense;
  const dailyPct = dailyLimit > 0 ? safePct(todayExpense, dailyLimit) : todayExpense > 0 ? 100 : 0;
  const monthlyPct = safePct(monthExpense, monthlyLimit);
  const avgDaily = monthExpense / day;

  return {
    year, month, day, daysInMonth, remainingDays, todayStr,
    monthTx, monthExpense, monthIncome, todayExpense,
    monthlyLimit,
    monthlyRemaining: monthlyLimit - monthExpense,
    dailyLimit, todayLeft, dailyPct, monthlyPct,
    dailyStatus: statusOf(dailyPct),
    monthlyStatus: statusOf(monthExpense >= monthlyLimit ? 100 : monthlyPct),
    avgDaily,
    projectedMonthEnd: avgDaily * daysInMonth,
  };
}

/* ── Borçlar ─────────────────────────────────────────── */

export const debtRemaining = (d: Debt) => Math.max(d.totalAmount - d.paidAmount, 0);

/** Kredi kartı asgari ödeme: limit ≤ 50.000 ₺ ise %20, üstü %40 (BDDK). */
export function minPayment(d: Debt) {
  const remaining = debtRemaining(d);
  if (d.type !== 'Kredi Kartı') return remaining;
  return remaining * ((d.cardLimit || 0) > 50000 ? 0.4 : 0.2);
}

export type DebtStrategy = 'avalanche' | 'snowball';

/** Çığ: en yüksek faizliden başla (toplam faizi en aza indirir).
 *  Kartopu: en küçük bakiyeden başla (motivasyonu yüksek tutar). */
export function orderDebts(debts: Debt[], strategy: DebtStrategy) {
  const active = debts.filter((d) => !d.isPaidOff);
  return active.sort((a, b) =>
    strategy === 'avalanche'
      ? (b.interestRate || 0) - (a.interestRate || 0) || debtRemaining(a) - debtRemaining(b)
      : debtRemaining(a) - debtRemaining(b),
  );
}

/* ── Birikim hedefleri ───────────────────────────────── */

export function goalPlan(goal: SavingsGoal, now = new Date()) {
  const remaining = Math.max(goal.targetAmount - goal.currentAmount, 0);
  if (!goal.deadline || remaining === 0) return { remaining, daysLeft: null, monthlyNeeded: null };
  const daysLeft = daysUntil(goal.deadline, now);
  const monthsLeft = Math.max(daysLeft / 30.44, 1);
  return { remaining, daysLeft, monthlyNeeded: daysLeft < 0 ? remaining : remaining / monthsLeft };
}

/* ── Yaklaşan ödemeler / gelirler zaman çizelgesi ───── */

export interface UpcomingEvent {
  id: string;
  name: string;
  amount: number;
  date: string;
  days: number;
  kind: 'debt' | 'expense' | 'income';
  note?: string;
}

const isMonthlyDay = (s: string) => /^\d{1,2}$/.test(s.trim());

/** Düzenli akışın bir sonraki gerçekleşme tarihi (işlenmişse bir sonraki ay). */
export function nextOccurrence(cf: Cashflow, now = new Date()): string | null {
  const todayStr = toLocalDateStr(now);
  if (!isMonthlyDay(cf.expectedDate)) {
    return cf.lastProcessedDate ? null : cf.expectedDate;
  }
  const day = Number(cf.expectedDate);
  const at = (y: number, m: number) =>
    toLocalDateStr(new Date(y, m, Math.min(day, new Date(y, m + 1, 0).getDate())));

  const y = now.getFullYear();
  const m = now.getMonth();
  const thisMonth = at(y, m);
  const processedThisMonth = !!cf.lastProcessedDate && isInMonth(cf.lastProcessedDate, y, m);
  if (thisMonth >= todayStr && !processedThisMonth) return thisMonth;
  return cf.isRecurring ? at(y, m + 1) : null;
}

export function upcomingEvents(debts: Debt[], cashflows: Cashflow[], horizonDays = 30, now = new Date()) {
  const events: UpcomingEvent[] = [];

  for (const d of debts) {
    if (d.isPaidOff || !d.dueDate) continue;
    const days = daysUntil(d.dueDate, now);
    if (days > horizonDays) continue;
    const isCard = d.type === 'Kredi Kartı';
    events.push({
      id: 'd_' + d.id,
      name: d.name,
      amount: isCard ? minPayment(d) : debtRemaining(d),
      date: d.dueDate,
      days,
      kind: 'debt',
      note: isCard ? 'Asgari ödeme' : d.type,
    });
  }

  for (const cf of cashflows) {
    const date = nextOccurrence(cf, now);
    if (!date) continue;
    const days = daysUntil(date, now);
    if (days < 0 || days > horizonDays) continue;
    events.push({
      id: 'c_' + cf.id,
      name: cf.name,
      amount: cf.amount,
      date,
      days,
      kind: cf.type === 'income' ? 'income' : 'expense',
      note: cf.isRecurring ? 'Her ay' : 'Tek seferlik',
    });
  }

  return events.sort((a, b) => a.days - b.days);
}

export const cashflowScheduleLabel = (cf: Cashflow) =>
  isMonthlyDay(cf.expectedDate)
    ? cf.isRecurring ? `Her ayın ${cf.expectedDate}. günü` : `Ayın ${cf.expectedDate}. günü (tek sefer)`
    : parseDate(cf.expectedDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
