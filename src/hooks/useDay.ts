import { useMemo } from 'react';
import { useStore } from '../store/useStore';
import { doneCount, entryOf, isActive, isDone, isScheduled, weeklyCount, type DoneContext } from '../utils/trackers';
import type { DayLog, Tracker } from '../types';

export interface TrackerView {
  t: Tracker;
  value: number;
  done: boolean;
  weekly: number;      // bu hafta yapılan gün (weeklyTimes varsa)
}

export function useDoneCtx(): DoneContext {
  const tasks = useStore((s) => s.tasks);
  return useMemo(() => {
    const counts: Record<string, number> = {};
    tasks.forEach((t) => { if (t.forDate) counts[t.forDate] = (counts[t.forDate] || 0) + 1; });
    return { tasksFor: (d: string) => counts[d] || 0 };
  }, [tasks]);
}

/** Bir günün rutinleri + hesaplanmış durumları */
export function useDay(date: string) {
  const trackers = useStore((s) => s.trackers);
  const days = useStore((s) => s.days);
  const tasks = useStore((s) => s.tasks);
  const focusUntil = useStore((s) => s.settings.focusUntil);
  const ctx = useDoneCtx();
  const day: DayLog | undefined = days[date];
  // Odak modu: o gün açıksa yalnızca "odakta göster" işaretli rutinler (azaltılanlar her zaman görünür)
  const focus = !!focusUntil && date <= focusUntil;

  return useMemo(() => {
    const items: TrackerView[] = trackers
      .filter((t) => isActive(t) && isScheduled(t, date) && (!focus || t.focus || t.mode === 'reduce'))
      .map((t) => ({
        t,
        value: entryOf(t, day),
        done: isDone(t, day, date, ctx),
        weekly: t.weeklyTimes ? weeklyCount(t, days, date, ctx) : 0,
      }));
    return { day, items, focus, done: doneCount(trackers, day, date, tasks, ctx) };
  }, [trackers, days, tasks, day, date, ctx, focus]);
}
