import { AnimatePresence, motion } from 'framer-motion';
import { Archive, ArrowRight, Check, ChevronLeft, Moon, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { SCALE_FACES } from '../constants';
import { TrackerIcon } from './TrackerIcon';
import { useDoneCtx } from '../hooks/useDay';
import { useSheets } from '../store/useSheets';
import { useStore } from '../store/useStore';
import { run, toast } from '../store/useUI';
import type { Intention, JournalEntry, Task } from '../types';
import { promptFor } from '../utils/prompts';
import { extractPeople, extractTags } from '../utils/journal';
import { addDays, fmtMinutes, longDate, nowHHMM, shortDate, shortWeekday, weekStart } from '../utils/date';
import { daySummary, weekSummary } from '../utils/review';
import TaskList from './TaskList';
import { useFinance } from '../finance/store/useFinance';
import { isSpending } from '../finance/utils/effects';
import { dueBills } from '../finance/utils/period';
import { fmt } from '../finance/utils/format';

/* Gün sonu ve hafta sonu akışları. Her adım atlanabilir; hiçbir şey zorunlu değil. */

export default function Review() {
  const review = useSheets((s) => s.review);
  const close = useSheets((s) => s.close);
  return (
    <AnimatePresence>
      {review && (
        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }}
          transition={{ type: 'spring', stiffness: 380, damping: 34 }}
          className="fixed inset-0 z-[950] bg-base overflow-y-auto"
          style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
          role="dialog" aria-modal="true" aria-label={review.kind === 'day' ? 'Günü kapat' : 'Haftayı kapat'}
        >
          {review.kind === 'day'
            ? <DayFlow key={review.date} date={review.date} onClose={close} />
            : <WeekFlow key={review.weekOf} weekOf={review.weekOf} onClose={close} />}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── Ortak iskelet ────────────────────────────────────── */

function Shell({ eyebrow, steps, step, setStep, onClose, onFinish, finishLabel, children }: {
  eyebrow: string; steps: string[]; step: number; setStep: (n: number) => void;
  onClose: () => void; onFinish: () => void; finishLabel: string; children: React.ReactNode;
}) {
  const last = step === steps.length - 1;
  return (
    <div className="max-w-xl mx-auto px-5 pt-4 pb-10 min-h-full flex flex-col">
      <div className="flex items-center justify-between gap-2">
        {step > 0
          ? <button onClick={() => setStep(step - 1)} className="icon-btn text-text-muted hover:bg-surface-hover -ml-2" aria-label="Geri"><ChevronLeft size={20} /></button>
          : <span className="w-9" />}
        <div className="flex gap-1.5" aria-label={`Adım ${step + 1} / ${steps.length}`}>
          {steps.map((s, i) => (
            <span key={s} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-accent' : i < step ? 'w-1.5 bg-accent/60' : 'w-1.5 bg-surface-hover'}`} />
          ))}
        </div>
        <button onClick={onClose} className="icon-btn text-text-muted hover:bg-surface-hover -mr-2" aria-label="Kapat"><X size={20} /></button>
      </div>

      <p className="eyebrow mt-6">{eyebrow}</p>
      <h1 className="page-title mt-1">{steps[step]}</h1>

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.18 }} className="flex-1 mt-6 space-y-6">
          {children}
        </motion.div>
      </AnimatePresence>

      <div className="grid grid-cols-[auto_1fr] gap-3 mt-8">
        {!last && <button onClick={() => setStep(step + 1)} className="btn btn-ghost">Atla</button>}
        <button onClick={() => (last ? onFinish() : setStep(step + 1))} className={`btn btn-primary ${last ? 'col-span-2' : ''}`}>
          {last ? finishLabel : <>Devam <ArrowRight size={16} /></>}
        </button>
      </div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-el px-3 py-1.5 text-xs font-semibold">{children}</span>;
}

/** Bitmemiş görev: taşı ya da bırak */
function OpenTaskRow({ t, actions }: { t: Task; actions: { label: string; icon?: React.ReactNode; onClick: () => void; danger?: boolean }[] }) {
  return (
    <li className="rounded-2xl border border-border p-3 space-y-2">
      <p className="text-[15px] font-medium break-words">{t.text}</p>
      <div className="flex flex-wrap gap-1.5">
        {actions.map((a) => (
          <button key={a.label} onClick={a.onClick} className={`pill ${a.danger ? 'hover:!text-danger' : ''}`}>{a.icon}{a.label}</button>
        ))}
      </div>
    </li>
  );
}

/* ═══ Günü kapat ═══════════════════════════════════════ */

function DayFlow({ date, onClose }: { date: string; onClose: () => void }) {
  const { trackers, days, tasks, updateTask, removeTask, setEntry, closeDay, saveItem, people } = useStore();
  const ctx = useDoneCtx();
  const [step, setStep] = useState(0);
  const [note, setNote] = useState('');
  const s = useMemo(() => daySummary(date, { trackers, days, tasks, ctx }), [date, trackers, days, tasks, ctx]);
  const tomorrow = addDays(date, 1);
  const mood = trackers.find((t) => t.active && !t.paused && t.type === 'scale');
  const moodVal = mood ? days[date]?.entries?.[mood.id] ?? 0 : 0;
  const nothing = !s.doneTasks.length && !s.doneRoutines.length && !s.durations.length;

  const finish = async () => {
    if (await run(async () => {
      // Bugünü günlüğe yaz (isteğe bağlı)
      if (note.trim()) {
        await saveItem<JournalEntry>('journal', {
          date, time: nowHHMM(), text: note.trim(), prompt: promptFor(date),
          tags: extractTags(note), people: extractPeople(note, people),
          mood: mood ? moodVal || 0 : 0, createdAt: Date.now(), source: 'app',
        });
      }
      await closeDay(date);
    })) {
      toast('İyi geceler 🌙');
      onClose();
    }
  };

  return (
    <Shell eyebrow={`Günü kapat · ${longDate(date)}`} steps={['Bugün ne yaptın?', 'Yarın ne yapacaksın?']}
      step={step} setStep={setStep} onClose={onClose} onFinish={finish} finishLabel="Günü kapat">
      {step === 0 ? (
        <>
          {/* Özet */}
          {nothing ? (
            <p className="text-text-muted">Bugün kayıtlı bir şey yok. Olur böyle günler; bir satır not bile yeter.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {s.doneTasks.length > 0 && <Chip><Check size={13} className="text-accent" /> {s.doneTasks.length} görev</Chip>}
              {s.doneRoutines.length > 0 && <Chip><Check size={13} className="text-accent" /> {s.doneRoutines.length} rutin</Chip>}
              {s.durations.map((d) => <Chip key={d.t.id}><TrackerIcon name={d.t.icon} size={13} /> {d.t.name} {fmtMinutes(d.minutes)}</Chip>)}
              {s.sleepMin !== undefined && <Chip><Moon size={13} /> {fmtMinutes(s.sleepMin)} uyku</Chip>}
              {s.reduce.map((r) => <Chip key={r.t.id}><TrackerIcon name={r.t.icon} size={13} /> {r.t.name} {r.count}/{r.limit}</Chip>)}
            </div>
          )}

          {(s.doneTasks.length > 0 || s.doneRoutines.length > 0) && (
            <ul className="space-y-1.5">
              {s.doneTasks.map((t) => <li key={t.id} className="flex items-center gap-2 text-[15px]"><Check size={15} className="text-accent shrink-0" /> {t.text}</li>)}
              {s.doneRoutines.map((t) => <li key={t.id} className="flex items-center gap-2 text-[15px] text-text-muted"><TrackerIcon name={t.icon} size={15} /> {t.name}</li>)}
            </ul>
          )}

          {/* Bitmeyenler */}
          {s.openTasks.length > 0 && (
            <div>
              <p className="field-label">Kalanlar: ne yapalım?</p>
              <ul className="space-y-2">
                {s.openTasks.map((t) => (
                  <OpenTaskRow key={t.id} t={t} actions={[
                    { label: 'Yarına', icon: <ArrowRight size={13} />, onClick: () => run(() => updateTask(t.id, { forDate: tomorrow, time: '' })) },
                    { label: 'Bu hafta bir ara', onClick: () => run(() => updateTask(t.id, { forDate: '', time: '', weekOf: weekStart(date) })) },
                    { label: 'Bırak', icon: <Trash2 size={13} />, danger: true, onClick: () => run(() => removeTask(t.id)) },
                  ]} />
                ))}
              </ul>
            </div>
          )}

          {mood && (
            <div>
              <p className="field-label">{mood.name}</p>
              <div className="grid grid-cols-5 gap-2">
                {SCALE_FACES.map((f, i) => (
                  <button key={f} onClick={() => run(() => setEntry(mood.id, moodVal === i + 1 ? 0 : i + 1, date))}
                    className={`chip-tile text-2xl py-2 ${moodVal === i + 1 ? 'active' : ''}`} aria-pressed={moodVal === i + 1}>{f}</button>
                ))}
              </div>
            </div>
          )}

          <label className="block">
            <span className="field-label">Bugünü günlüğe yaz (isteğe bağlı)</span>
            <span className="block font-display text-[16px] mb-2">{promptFor(date)}</span>
            <textarea className="input journal-text min-h-[110px] resize-none" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Bir satır bile yeter…" />
          </label>
        </>
      ) : (
        <>
          <p className="text-text-muted">{longDate(tomorrow)} için aklındakileri yaz. En önemlisini ★ ile işaretleyebilirsin.</p>
          <TaskList date={tomorrow} placeholder="Yarın…" />
        </>
      )}
    </Shell>
  );
}

/* ═══ Haftayı kapat ════════════════════════════════════ */

function WeekFlow({ weekOf, onClose }: { weekOf: string; onClose: () => void }) {
  const { trackers, days, tasks, weeks, inbox, updateTask, removeTask, saveWeek, addTask, removeInbox, setInboxStatus } = useStore();
  const today = useStore((s) => s.today());
  const ctx = useDoneCtx();
  const [step, setStep] = useState(0);
  const week = weeks[weekOf];
  const [good, setGood] = useState(week?.good ?? '');
  const [hard, setHard] = useState(week?.hard ?? '');
  const s = useMemo(() => weekSummary(weekOf, { trackers, days, tasks, ctx }, today), [weekOf, trackers, days, tasks, ctx, today]);
  const money = useWeekMoney(weekOf, today);
  const next = addDays(weekOf, 7);
  const openNotes = inbox.filter((i) => i.status === 'open');
  const steps = ['Bu hafta ne yaptın?', ...(openNotes.length ? ['Notları ayıkla'] : []), 'Haftaya ne yapacaksın?'];
  const current = steps[step];

  const finish = async () => {
    if (await run(() => saveWeek(weekOf, { good: good.trim(), hard: hard.trim(), closedAt: Date.now() }))) {
      toast('Hafta kapandı. İyi bir hafta dilerim. ✨');
      onClose();
    }
  };

  return (
    <Shell eyebrow={`Haftayı kapat · ${shortDate(weekOf)} – ${shortDate(addDays(weekOf, 6))}`} steps={steps}
      step={step} setStep={setStep} onClose={onClose} onFinish={finish} finishLabel="Haftayı kapat">
      {current === 'Bu hafta ne yaptın?' && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Biten görev" value={String(s.doneTasks.length)} />
            {money.spent > 0 && <Stat label="Harcanan" value={fmt(money.spent)} sub={money.top ? `en çok ${money.top}` : undefined} />}
            {money.billsDue > 0 && <Stat label="Bekleyen ödeme" value={String(money.billsDue)} sub="Para'da 'ödendi mi?'" />}
            {s.durations.map((d) => <Stat key={d.t.id} label={d.t.name} value={fmtMinutes(d.minutes)} />)}
            {s.sleepAvg !== null && <Stat label="Ortalama uyku" value={fmtMinutes(s.sleepAvg)} />}
            {s.moodAvg !== null && <Stat label="Ortalama ruh hali" value={`${SCALE_FACES[Math.round(s.moodAvg) - 1]} ${s.moodAvg.toFixed(1)}`} />}
            {s.reduce.map((r) => (
              <Stat key={r.t.id} label={`${r.t.name} · günlük ort.`} value={r.avg.toFixed(1)}
                sub={r.prevAvg !== null ? `${r.avg <= r.prevAvg ? '↓' : '↑'} geçen hafta ${r.prevAvg.toFixed(1)}` : undefined} />
            ))}
          </div>

          {s.routines.length > 0 && (
            <div>
              <p className="field-label">Rutinler</p>
              <ul className="space-y-2">
                {s.routines.map((r) => (
                  <li key={r.t.id} className="flex items-center gap-3">
                    <span className="w-5 text-text-muted"><TrackerIcon name={r.t.icon} size={15} /></span>
                    <span className="text-sm flex-1 min-w-0 truncate">{r.t.name}</span>
                    <span className="text-xs text-text-muted num">{r.done}/{r.planned} gün</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {s.openTasks.length > 0 && (
            <div>
              <p className="field-label">Bitmeyenler: haftaya mı?</p>
              <ul className="space-y-2">
                {s.openTasks.map((t) => (
                  <OpenTaskRow key={t.id} t={t} actions={[
                    { label: 'Haftaya', icon: <ArrowRight size={13} />, onClick: () => run(() => updateTask(t.id, { forDate: '', time: '', weekOf: next })) },
                    { label: 'Bırak', icon: <Trash2 size={13} />, danger: true, onClick: () => run(() => removeTask(t.id)) },
                  ]} />
                ))}
              </ul>
            </div>
          )}

          <label className="block"><span className="field-label">Ne iyi gitti?</span>
            <textarea className="input min-h-[70px] resize-none" value={good} onChange={(e) => setGood(e.target.value)} placeholder="Küçük şeyler de sayılır." />
          </label>
          <label className="block"><span className="field-label">Ne zorladı?</span>
            <textarea className="input min-h-[70px] resize-none" value={hard} onChange={(e) => setHard(e.target.value)} placeholder="Yargılamadan, sadece fark et." />
          </label>
        </>
      )}

      {current === 'Notları ayıkla' && (
        <>
          <p className="text-text-muted">Notlar'da {openNotes.length} şey bekliyor. Haftaya alabilir, arşivleyebilir ya da olduğu gibi bırakabilirsin.</p>
          <ul className="space-y-2">
            {openNotes.map((i) => (
              <li key={i.id} className="rounded-2xl border border-border p-3 space-y-2">
                <p className="text-[15px] font-medium break-words">{i.text}</p>
                <div className="flex flex-wrap gap-1.5">
                  <button onClick={() => run(async () => { await addTask({ text: i.text, forDate: '', weekOf: next }); await removeInbox(i.id); })} className="pill"><ArrowRight size={13} /> Haftaya</button>
                  <button onClick={() => run(() => setInboxStatus(i.id, 'archived'))} className="pill"><Archive size={13} /> Arşiv</button>
                  <button onClick={() => run(() => removeInbox(i.id))} className="pill hover:!text-danger"><Trash2 size={13} /></button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {current === 'Haftaya ne yapacaksın?' && <PlanNextWeek weekOf={next} />}
    </Shell>
  );
}

/** Haftanın para özeti: harcanan, en büyük kategori, bekleyen faturalar */
function useWeekMoney(weekOf: string, today: string) {
  const { transactions, cashflows } = useFinance();
  const end = addDays(weekOf, 6);
  const week = transactions.filter((t) => isSpending(t) && t.date >= weekOf && t.date <= end);
  const byCat: Record<string, number> = {};
  week.forEach((t) => { byCat[t.category] = (byCat[t.category] ?? 0) + t.amount; });
  const top = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0]?.[0];
  return { spent: week.reduce((a, t) => a + t.amount, 0), top, billsDue: dueBills(cashflows, today).length };
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-surface-el p-3">
      <p className="text-[11px] text-text-muted font-semibold truncate">{label}</p>
      <p className="text-xl font-extrabold num mt-1">{value}</p>
      {sub && <p className="text-[10px] text-text-muted mt-0.5">{sub}</p>}
    </div>
  );
}

/** Haftalık niyetler + günlere dağıtılmış görevler */
function PlanNextWeek({ weekOf }: { weekOf: string }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekOf, i));
  const [day, setDay] = useState<string>('someday');
  const counts = useStore((s) => s.tasks);

  return (
    <>
      <div>
        <p className="field-label">Bu haftanın niyetleri</p>
        <p className="text-xs text-text-muted -mt-1 mb-3">Ör: "3 akşam ders", "Pazar oda". İstediğin kadar, istersen hiç.</p>
        <IntentionList weekOf={weekOf} />
      </div>

      <div>
        <p className="field-label">Görevler</p>
        <div className="flex gap-1 overflow-x-auto no-scrollbar pb-1">
          <DayTab active={day === 'someday'} onClick={() => setDay('someday')} label="Bir ara" n={counts.filter((t) => !t.forDate && t.weekOf === weekOf).length} />
          {days.map((d) => (
            <DayTab key={d} active={day === d} onClick={() => setDay(d)} label={`${shortWeekday(d)} ${Number(d.slice(8))}`} n={counts.filter((t) => t.forDate === d).length} />
          ))}
        </div>
        <div className="mt-3">
          {day === 'someday'
            ? <TaskList weekOf={weekOf} placeholder="Bu hafta bir ara…" />
            : <TaskList key={day} date={day} placeholder={`${longDate(day)}…`} />}
        </div>
      </div>
    </>
  );
}

function DayTab({ active, onClick, label, n }: { active: boolean; onClick: () => void; label: string; n: number }) {
  return (
    <button onClick={onClick} className={`pill shrink-0 ${active ? 'active' : ''}`}>
      {label}{n > 0 && <span className="num opacity-70">· {n}</span>}
    </button>
  );
}

/* ═══ Haftalık niyetler ════════════════════════════════ */

export function IntentionList({ weekOf }: { weekOf: string }) {
  const intentions = useStore((s) => s.weeks[weekOf]?.intentions) ?? [];
  const saveWeek = useStore((s) => s.saveWeek);
  const [text, setText] = useState('');
  const save = (list: Intention[]) => run(() => saveWeek(weekOf, { intentions: list }));

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const v = text.trim();
    if (!v) return;
    setText('');
    save([...intentions, { id: Math.random().toString(36).slice(2, 10), text: v, done: false }]);
  };

  return (
    <div className="space-y-1">
      {intentions.map((it) => (
        <div key={it.id} className={`row-item group ${it.done ? 'is-done' : ''}`} style={{ '--c': 'var(--cat-mind)' } as React.CSSProperties}>
          <button onClick={() => save(intentions.map((x) => (x.id === it.id ? { ...x, done: !x.done } : x)))}
            className={`check-btn ${it.done ? 'done animate-pop' : ''}`} style={{ width: 32, height: 32, minWidth: 32, minHeight: 32 }}
            aria-label={it.done ? 'Geri al' : 'Tamamlandı'} aria-pressed={it.done}>
            <Sparkles size={14} />
          </button>
          <span className="row-title flex-1 text-[15px] font-medium break-words">{it.text}</span>
          <button onClick={() => save(intentions.filter((x) => x.id !== it.id))} className="icon-btn text-text-muted opacity-50 hover:opacity-100 hover:text-danger" aria-label="Sil"><X size={15} /></button>
        </div>
      ))}
      <form onSubmit={add} className="flex gap-2 pt-1">
        <input className="input py-2.5" value={text} onChange={(e) => setText(e.target.value)} placeholder="Niyet ekle…" maxLength={100} enterKeyHint="done" />
        <button type="submit" disabled={!text.trim()} className="btn btn-soft-accent shrink-0 px-4" aria-label="Ekle"><Plus size={18} /></button>
      </form>
    </div>
  );
}
