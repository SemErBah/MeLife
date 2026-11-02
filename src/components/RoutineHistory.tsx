import { useMemo } from 'react';
import { useDoneCtx } from '../hooks/useDay';
import { useStore } from '../store/useStore';
import type { Tracker } from '../types';
import { addDays, shortDate, weekStart, WEEKDAY_LETTERS } from '../utils/date';
import { routineHistory } from '../utils/history';

/** Rutin kartında 12 haftalık ısı haritası, seriler, en çok yapılan gün ve son notlar */
export default function RoutineHistory({ t }: { t: Tracker }) {
  const days = useStore((s) => s.days);
  const today = useStore((s) => s.today());
  const ctx = useDoneCtx();
  const h = useMemo(() => routineHistory(t, days, today, ctx), [t, days, today, ctx]);
  if (!h.total) return null;

  const start = addDays(weekStart(today), -7 * 11);
  const cols = Array.from({ length: 12 }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)));
  const rowOrder = [1, 2, 3, 4, 5, 6, 0];

  return (
    <div className="space-y-3">
      <p className="field-label">Son 12 hafta</p>
      <div className="flex gap-2">
        <div className="grid grid-rows-7 gap-[3px] text-[9px] text-text-muted leading-none">
          {rowOrder.map((d) => <span key={d} className="h-3 flex items-center">{WEEKDAY_LETTERS[d]}</span>)}
        </div>
        <div className="flex gap-[3px] overflow-x-auto">
          {cols.map((col, i) => (
            <div key={i} className="grid grid-rows-7 gap-[3px]">
              {col.map((d) => (
                <span key={d} title={shortDate(d)} className="w-3 h-3 rounded-[3px]" style={{
                  background: d > today ? 'transparent' : h.done.has(d) ? 'var(--c, var(--accent-base))' : 'var(--surface-el)',
                  opacity: d > today ? 0 : 1,
                }} />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat n={h.current} label="şimdiki seri" />
        <Stat n={h.best} label="en uzun seri" />
        <Stat n={h.total} label="gün (12 hafta)" />
      </div>
      {h.bestWeekday !== null && <p className="text-xs text-text-muted">En çok {WEEKDAY_NAMES[h.bestWeekday]} yapıyorsun.</p>}
      {h.notes.length > 0 && (
        <ul className="space-y-1">
          {h.notes.map((n) => <li key={n.date} className="text-sm"><span className="text-text-muted num">{shortDate(n.date)}</span> · {n.text}</li>)}
        </ul>
      )}
    </div>
  );
}

const WEEKDAY_NAMES = ['pazar günleri', 'pazartesileri', 'salıları', 'çarşambaları', 'perşembeleri', 'cumaları', 'cumartesileri'];

function Stat({ n, label }: { n: number; label: string }) {
  return <div className="rounded-2xl bg-surface-el py-2"><p className="font-display text-xl num leading-none">{n}</p><p className="text-[10px] text-text-muted mt-1">{label}</p></div>;
}
