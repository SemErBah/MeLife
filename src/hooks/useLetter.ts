import { useMemo } from 'react';
import { useFinance } from '../finance/store/useFinance';
import { isSpending } from '../finance/utils/effects';
import { useStore } from '../store/useStore';
import { addDays } from '../utils/date';
import { weeklyLetter } from '../utils/letter';
import { weekSummary } from '../utils/review';
import { doneCount } from '../utils/trackers';
import { useDoneCtx } from './useDay';

/** Bir haftanın mektubu (Hafta ekranı ve Telegram aynı metni kullanır) */
export function useWeeklyLetter(weekOf: string): string {
  const { trackers, days, tasks, weeks, sessions, settings, user } = useStore();
  const today = useStore((s) => s.today());
  const { transactions } = useFinance();
  const ctx = useDoneCtx();

  return useMemo(() => {
    const s = weekSummary(weekOf, { trackers, days, tasks, ctx }, today);
    const past = s.dates.filter((d) => d <= today);
    const best = past.map((d) => ({ date: d, count: doneCount(trackers, days[d], d, tasks, ctx) })).sort((a, b) => b.count - a.count)[0];
    const end = addDays(weekOf, 6);
    const spending = transactions.filter((t) => isSpending(t) && t.date >= weekOf && t.date <= end);
    const byCat: Record<string, number> = {};
    spending.forEach((t) => { byCat[t.category] = (byCat[t.category] ?? 0) + t.amount; });
    const week = weeks[weekOf];
    return weeklyLetter({
      name: (settings.displayName || user?.name || '').split(' ')[0] || undefined,
      doneTasks: s.doneTasks.length,
      bestDay: best,
      routines: s.routines.map((r) => ({ name: r.t.name, done: r.done, planned: r.planned })),
      sleepAvg: s.sleepAvg,
      moodAvg: s.moodAvg,
      studyMinutes: sessions.filter((x) => x.date >= weekOf && x.date <= end).reduce((a, x) => a + x.minutes, 0)
        || s.durations.filter((d) => d.t.key === 'study').reduce((a, d) => a + d.minutes, 0),
      reduce: s.reduce.map((r) => ({ name: r.t.name, unit: r.t.unit, avg: r.avg, prevAvg: r.prevAvg })),
      spent: spending.reduce((a, t) => a + t.amount, 0),
      topCategory: Object.entries(byCat).sort((a, b) => b[1] - a[1])[0]?.[0],
      intentionsTotal: week?.intentions?.length,
      intentionsDone: week?.intentions?.filter((i) => i.done).length,
    });
  }, [weekOf, trackers, days, tasks, weeks, sessions, settings.displayName, user, today, transactions, ctx]);
}
