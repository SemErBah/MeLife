import { Check, ChevronLeft, ChevronRight, GraduationCap, Moon, NotebookPen } from 'lucide-react';
import { useMemo, useState } from 'react';
import Modal from '../../components/Modal';
import { EXAM_KIND, SCALE_FACES } from '../../constants';
import { TrackerIcon } from '../../components/TrackerIcon';
import { useFinance } from '../../finance/store/useFinance';
import { isSpending } from '../../finance/utils/effects';
import { fmt } from '../../finance/utils/format';
import { useDoneCtx } from '../../hooks/useDay';
import { useStore } from '../../store/useStore';
import { addDays, fmtMinutes, fromKey, longDate, shortDate, toKey, WEEKDAY_LETTERS } from '../../utils/date';
import { daySummary } from '../../utils/review';
import { doneCount } from '../../utils/trackers';

const monthLabel = (y: number, m: number) => new Date(y, m, 1).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });

export default function Calendar() {
  const { trackers, days, tasks, exams, weeks } = useStore();
  const today = useStore((s) => s.today());
  const ctx = useDoneCtx();
  const t = fromKey(today);
  const [cursor, setCursor] = useState({ y: t.getFullYear(), m: t.getMonth() });
  const [open, setOpen] = useState<string | null>(null);

  // Pazartesi başlayan ay ızgarası
  const cells = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1);
    const lead = (first.getDay() + 6) % 7;
    const count = new Date(cursor.y, cursor.m + 1, 0).getDate();
    return [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => toKey(new Date(cursor.y, cursor.m, i + 1)))];
  }, [cursor]);

  const counts = useMemo(() => Object.fromEntries(cells.filter(Boolean).map((d) => [d, doneCount(trackers, days[d!], d!, tasks, ctx)])), [cells, trackers, days, tasks, ctx]);
  const max = Math.max(1, ...Object.values(counts) as number[]);
  const examDays = new Set(exams.map((e) => e.date));
  const shift = (n: number) => setCursor(({ y, m }) => { const d = new Date(y, m + n, 1); return { y: d.getFullYear(), m: d.getMonth() }; });

  const pastWeeks = Object.values(weeks).filter((w) => w.good || w.hard).sort((a, b) => b.id.localeCompare(a.id));

  return (
    <div className="space-y-5">
      <section className="widget p-4">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => shift(-1)} className="icon-btn text-text-muted hover:bg-surface-el rounded-full" aria-label="Önceki ay"><ChevronLeft size={18} /></button>
          <p className="font-display text-lg font-semibold capitalize">{monthLabel(cursor.y, cursor.m)}</p>
          <button onClick={() => shift(1)} className="icon-btn text-text-muted hover:bg-surface-el rounded-full" aria-label="Sonraki ay"><ChevronRight size={18} /></button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => <span key={d} className="text-[10px] font-bold text-text-muted pb-1">{WEEKDAY_LETTERS[d]}</span>)}
          {cells.map((d, i) => {
            if (!d) return <span key={`e${i}`} />;
            const n = counts[d] ?? 0;
            const future = d > today;
            return (
              <button key={d} onClick={() => setOpen(d)} disabled={future && !examDays.has(d)}
                className={`relative aspect-square rounded-xl flex items-center justify-center text-sm font-semibold num min-h-0 min-w-0 transition-colors ${d === today ? 'ring-2 ring-accent' : ''} ${future ? 'text-text-muted' : ''}`}
                style={{ background: n ? `color-mix(in srgb, var(--accent-base) ${12 + (n / max) * 50}%, transparent)` : 'var(--surface-el)' }}
                aria-label={`${longDate(d)}: ${n} şey`}
              >
                {Number(d.slice(8))}
                {examDays.has(d) && <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full" style={{ background: 'var(--cat-mind)' }} />}
                {days[d]?.closedAt && <span className="absolute top-1 right-1 w-1 h-1 rounded-full bg-text-muted" />}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-text-muted mt-3">Renk koyulaştıkça o gün daha çok şey kaydettin · mor nokta: sınav</p>
      </section>

      {pastWeeks.length > 0 && (
        <section className="widget">
          <div className="widget-header"><h3>Geçmiş haftalar</h3></div>
          <ul className="px-5 pb-4 space-y-4">
            {pastWeeks.slice(0, 12).map((w) => (
              <li key={w.id} className="space-y-1">
                <p className="text-xs font-semibold text-text-muted">{shortDate(w.id)} – {shortDate(addDays(w.id, 6))}</p>
                {w.good && <p className="text-sm"><span className="text-accent">İyi giden:</span> {w.good}</p>}
                {w.hard && <p className="text-sm"><span className="text-text-muted">Zorlayan:</span> {w.hard}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <Modal isOpen={!!open} onClose={() => setOpen(null)} title={open ? longDate(open) : ''}>
        {open && <DaySheet date={open} onGo={() => setOpen(null)} />}
      </Modal>
    </div>
  );
}

function DaySheet({ date, onGo }: { date: string; onGo: () => void }) {
  const { trackers, days, tasks, exams, courses, goToDate } = useStore();
  const { transactions } = useFinance();
  const ctx = useDoneCtx();
  const s = daySummary(date, { trackers, days, tasks, ctx });
  const day = days[date];
  const spent = transactions.filter((t) => isSpending(t) && t.date === date).reduce((a, t) => a + t.amount, 0);
  const dayExams = exams.filter((e) => e.date === date);
  const mood = trackers.find((t) => t.type === 'scale' && day?.entries?.[t.id]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {s.doneTasks.length > 0 && <Chip><Check size={13} /> {s.doneTasks.length} görev</Chip>}
        {s.doneRoutines.length > 0 && <Chip><Check size={13} /> {s.doneRoutines.length} rutin</Chip>}
        {s.durations.map((d) => <Chip key={d.t.id}><TrackerIcon name={d.t.icon} size={13} /> {fmtMinutes(d.minutes)}</Chip>)}
        {s.sleepMin !== undefined && <Chip><Moon size={13} /> {fmtMinutes(s.sleepMin)}</Chip>}
        {mood && <Chip>{SCALE_FACES[(day!.entries![mood.id] ?? 1) - 1]} {mood.name}</Chip>}
        {s.reduce.filter((r) => day?.entries?.[r.t.id] !== undefined).map((r) => <Chip key={r.t.id}><TrackerIcon name={r.t.icon} size={13} /> {r.count}</Chip>)}
        {spent > 0 && <Chip>{fmt(spent)} harcama</Chip>}
      </div>

      {dayExams.map((e) => (
        <p key={e.id} className="text-sm flex items-center gap-2"><GraduationCap size={15} className="text-[var(--cat-mind)]" /> <b>{courses.find((c) => c.id === e.courseId)?.name ?? e.title}</b> {EXAM_KIND[e.kind]}{e.grade ? ` · ${e.grade}` : ''}</p>
      ))}

      {(s.doneTasks.length > 0 || s.openTasks.length > 0) && (
        <ul className="space-y-1.5">
          {s.doneTasks.map((t) => <li key={t.id} className="text-sm flex gap-2"><Check size={15} className="text-accent shrink-0" /> {t.text}</li>)}
          {s.openTasks.map((t) => <li key={t.id} className="text-sm flex gap-2 text-text-muted"><span className="w-[15px] shrink-0 text-center">·</span> {t.text}</li>)}
        </ul>
      )}

      {day?.note && (
        <p className="text-sm leading-relaxed rounded-2xl bg-surface-el p-3 flex gap-2"><NotebookPen size={15} className="text-text-muted shrink-0 mt-0.5" /> {day.note}</p>
      )}

      {!s.doneTasks.length && !s.doneRoutines.length && !day?.note && !spent && !dayExams.length && (
        <p className="text-sm text-text-muted">Bu gün için kayıt yok.</p>
      )}

      <button onClick={() => { onGo(); goToDate(date); }} className="btn btn-ghost w-full">Bu güne git</button>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-el px-3 py-1.5 text-xs font-semibold">{children}</span>;
}
