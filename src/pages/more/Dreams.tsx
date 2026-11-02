import { Check, CircleDashed, Flag, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import Modal from '../../components/Modal';
import { Field, ProgressBar } from '../../components/ui';
import { useStore } from '../../store/useStore';
import { confirmAction, run, undoToast } from '../../store/useUI';
import type { DayLog, Dream, GoalStep, Tracker, YearGoal } from '../../types';
import { longDate, weekStart } from '../../utils/date';
import { haptic } from '../../utils/haptic';
import { reduceStats } from '../../utils/reduce';

const AREA: Record<NonNullable<Dream['area']>, string> = { travel: '🧭 Gezmek', learn: '📖 Öğrenmek', do: '🛠 Yapmak', have: '🏡 Sahip olmak', be: '🌿 Olmak' };
const stamp = () => Date.now();
const sid = () => Math.random().toString(36).slice(2, 9);

export default function Dreams() {
  const today = useStore((s) => s.today());
  const year = Number(today.slice(0, 4));
  const showYearEnd = today.slice(5, 7) === '12';
  return (
    <div className="space-y-[1.75rem]">
      <section className="now-card">
        <p className="font-display text-[19px] leading-snug">Yapılacaklar listesi değil; ileride bakıp "iyi ki" diyeceğin şeyler.</p>
        <p className="text-sm text-text-muted mt-2">Takvimi yok, acelesi yok. İstediğin zaman ekle, istediğin zaman bırak.</p>
      </section>
      <div className="grid lg:grid-cols-2 gap-[1.75rem] items-start">
        <YearGoals year={year} />
        <DreamList />
      </div>
      <YearEnd year={year} open={showYearEnd} />
    </div>
  );
}

/* ── Bu yılın niyetleri ───────────────────────────────── */

function YearGoals({ year }: { year: number }) {
  const goals = useStore((s) => s.yearGoals).filter((g) => g.year === year);
  const [edit, setEdit] = useState<{ id?: string } | null>(null);
  return (
    <section className="widget">
      <div className="widget-header">
        <h3><Flag size={16} /> {year} niyetlerim</h3>
        {goals.length < 7 && <button className="widget-link" onClick={() => setEdit({})}><Plus size={13} className="inline -mt-0.5" /> Ekle</button>}
      </div>
      <div className="widget-body pt-0 space-y-4">
        {goals.length === 0 && <p className="text-sm text-text-muted leading-relaxed">3–5 büyük niyet yeter. Ör: "Okulu bitirmek", "Sigarayı 10'a indirmek", "Şirkette 2 yeni müşteri".</p>}
        {goals.map((g) => <GoalCard key={g.id} g={g} onEdit={() => setEdit({ id: g.id })} />)}
      </div>
      <Modal isOpen={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Niyeti düzenle' : 'Yeni niyet'}>
        {edit && <GoalForm key={edit.id ?? 'new'} id={edit.id} year={year} onDone={() => setEdit(null)} />}
      </Modal>
    </section>
  );
}

/** Bağlı rutinin bu yılki durumu: yapılan gün sayısı ya da azaltmada son 7 gün */
function trackerProgress(t: Tracker, days: Record<string, DayLog>, today: string, year: number): string {
  if (t.mode === 'reduce' && t.reduce) {
    const st = reduceStats(t, days, today, 7);
    return `Son 7 gün ort. ${st.avg7.toFixed(1)} (başta ${t.reduce.start}) · ${st.bestStreakUnder} gündür sınırda`;
  }
  const n = Object.entries(days).filter(([d, log]) => d.startsWith(String(year)) && ((log.entries?.[t.id] ?? 0) > 0 || (t.type === 'sleep' && !!log.sleep))).length;
  return `Bu yıl ${n} gün`;
}

function GoalCard({ g, onEdit }: { g: YearGoal; onEdit: () => void }) {
  const { trackers, days, saveItem, addTask } = useStore();
  const today = useStore((s) => s.today());
  const steps = g.steps ?? [];
  const done = steps.filter((s) => s.done).length;
  const tracker = trackers.find((t) => t.id === g.trackerId);
  const setSteps = (next: GoalStep[]) => run(() => saveItem<YearGoal>('yearGoals', { steps: next }, g.id));

  return (
    <div className={`rounded-2xl bg-surface-el p-4 space-y-3 ${g.done ? 'opacity-70' : ''}`}>
      <button onClick={onEdit} className="block w-full text-left min-h-0">
        <span className="block font-display text-[17px] font-semibold leading-snug">{g.done ? '🎉 ' : ''}{g.title}</span>
        {g.why && <span className="block text-sm text-text-muted mt-0.5">{g.why}</span>}
      </button>
      {steps.length > 0 && (
        <>
          <ProgressBar pct={(done / steps.length) * 100} color="var(--accent-base)" height={6} />
          <ul className="space-y-1">
            {steps.map((s) => (
              <li key={s.id} className="flex items-center gap-2 text-sm">
                <button onClick={() => { haptic(); setSteps(steps.map((x) => x.id === s.id ? { ...x, done: !x.done } : x)); }}
                  className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 min-h-0 ${s.done ? 'bg-accent border-accent text-white' : 'border-border'}`} aria-label="Tamam">
                  {s.done && <Check size={12} />}
                </button>
                <span className={`flex-1 ${s.done ? 'line-through text-text-muted' : ''}`}>{s.text}</span>
                {!s.done && !s.taskId && (
                  <button className="pill text-[11px]" onClick={() => run(async () => {
                    await addTask({ text: s.text, forDate: '', weekOf: weekStart(today) });
                    await saveItem<YearGoal>('yearGoals', { steps: steps.map((x) => x.id === s.id ? { ...x, taskId: 'week' } : x) }, g.id);
                  }, 'Bu haftaya eklendi')}>Bu hafta</button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      {tracker && <p className="text-xs text-text-muted">↻ {tracker.name}: {trackerProgress(tracker, days, today, g.year)}</p>}
    </div>
  );
}

function GoalForm({ id, year, onDone }: { id?: string; year: number; onDone: () => void }) {
  const { yearGoals, trackers, saveItem, removeItem, restoreItem } = useStore();
  const g = id ? yearGoals.find((x) => x.id === id) : undefined;
  const [title, setTitle] = useState(g?.title ?? '');
  const [why, setWhy] = useState(g?.why ?? '');
  const [steps, setSteps] = useState<GoalStep[]>(g?.steps ?? []);
  const [step, setStep] = useState('');
  const [trackerId, setTrackerId] = useState(g?.trackerId ?? '');
  const active = trackers.filter((t) => t.active);

  const addStep = () => { if (step.trim()) { setSteps([...steps, { id: sid(), text: step.trim(), done: false }]); setStep(''); } };
  const save = async () => {
    if (!title.trim()) return;
    const data: Partial<YearGoal> = { title: title.trim(), why: why.trim(), steps, trackerId, ...(g ? {} : { year, createdAt: stamp(), done: false }) };
    if (await run(() => saveItem<YearGoal>('yearGoals', data, g?.id), g ? 'Kaydedildi' : 'Niyet eklendi')) onDone();
  };

  return (
    <div className="space-y-5">
      <Field label="Niyet"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ör: Okulu bitirmek" autoFocus={!g} /></Field>
      <Field label="Neden önemli? (isteğe bağlı)"><input className="input" value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Zor günde hatırlamak için" /></Field>
      <Field label="Küçük adımlar">
        <ul className="space-y-1 mb-2">
          {steps.map((s) => (
            <li key={s.id} className="flex items-center gap-2 text-sm">
              <CircleDashed size={14} className="text-text-muted shrink-0" />
              <span className="flex-1">{s.text}</span>
              <button onClick={() => setSteps(steps.filter((x) => x.id !== s.id))} className="icon-btn text-text-muted" aria-label="Kaldır"><X size={14} /></button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <input className="input" value={step} onChange={(e) => setStep(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addStep(); } }} placeholder="Ör: Danışmanla görüş" />
          <button onClick={addStep} disabled={!step.trim()} className="btn btn-ghost shrink-0" aria-label="Adım ekle"><Plus size={16} /></button>
        </div>
      </Field>
      {active.length > 0 && (
        <Field label="Bir rutinle bağla (isteğe bağlı)">
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setTrackerId('')} className={`pill ${!trackerId ? 'active' : ''}`}>Yok</button>
            {active.map((t) => <button key={t.id} type="button" onClick={() => setTrackerId(t.id)} className={`pill ${trackerId === t.id ? 'active' : ''}`}>{t.name}</button>)}
          </div>
        </Field>
      )}
      <div className="space-y-2">
        <button onClick={save} disabled={!title.trim()} className="btn btn-primary w-full">{g ? 'Kaydet' : 'Ekle'}</button>
        {g && (
          <>
            <button onClick={async () => { if (await run(() => saveItem<YearGoal>('yearGoals', { done: !g.done }, g.id), g.done ? 'Geri alındı' : 'Tebrikler 🎉')) onDone(); }} className="btn btn-soft-accent w-full">
              <Sparkles size={16} /> {g.done ? 'Henüz değil' : 'Bu niyeti gerçekleştirdim'}
            </button>
            <button onClick={async () => {
              const snap = { ...g } as unknown as Record<string, unknown>;
              if (await run(() => removeItem('yearGoals', g.id))) { onDone(); undoToast('Niyet silindi', () => restoreItem('yearGoals', g.id, snap)); }
            }} className="btn btn-ghost w-full"><Trash2 size={16} /> Sil</button>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Hayal listesi ────────────────────────────────────── */

function DreamList() {
  const { dreams, saveItem } = useStore();
  const today = useStore((s) => s.today());
  const [text, setText] = useState('');
  const [area, setArea] = useState<Dream['area']>('do');
  const [edit, setEdit] = useState<string | null>(null);
  const open = dreams.filter((d) => d.status !== 'done');
  const done = dreams.filter((d) => d.status === 'done').sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''));

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    const title = text.trim();
    setText('');
    await run(() => saveItem<Dream>('dreams', { title, area, status: 'dream', createdAt: stamp() }));
  };
  const complete = (d: Dream) => {
    haptic(30);
    return run(() => saveItem<Dream>('dreams', { status: 'done', doneAt: today }, d.id), 'Gerçekleşti 🎉 Hayat çizelgene eklendi');
  };

  return (
    <section className="widget">
      <div className="widget-header"><h3><Sparkles size={16} /> Bir gün…</h3></div>
      <div className="widget-body pt-0 space-y-4">
        <form onSubmit={add} className="space-y-2">
          <div className="flex gap-2">
            <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Ör: Kapadokya'da balona binmek" maxLength={120} />
            <button type="submit" disabled={!text.trim()} className="btn btn-primary shrink-0 px-4" aria-label="Ekle"><Plus size={18} /></button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(AREA) as NonNullable<Dream['area']>[]).map((a) => <button key={a} type="button" onClick={() => setArea(a)} className={`pill ${area === a ? 'active' : ''}`}>{AREA[a]}</button>)}
          </div>
        </form>

        {open.length === 0 && done.length === 0 && <p className="text-sm text-text-muted">Gitmek istediğin yerler, öğrenmek istediğin şeyler, bir gün yapmak istediklerin…</p>}
        <ul className="space-y-1">
          {open.map((d) => (
            <li key={d.id} className="flex items-center gap-2">
              <button onClick={() => setEdit(d.id)} className="flex-1 text-left min-h-0 py-2">
                <span className="text-[15px] font-medium">{d.title}</span>
                {d.area && <span className="text-xs text-text-muted ml-2">{AREA[d.area].split(' ')[0]}</span>}
                {d.note && <span className="block text-xs text-text-muted truncate">{d.note}</span>}
              </button>
              <button onClick={() => complete(d)} className="pill text-[11px]">Gerçekleşti</button>
            </li>
          ))}
        </ul>
        {done.length > 0 && (
          <div>
            <p className="field-label">Gerçekleşenler</p>
            <ul className="space-y-1">
              {done.map((d) => (
                <li key={d.id}><button onClick={() => setEdit(d.id)} className="text-left min-h-0 py-1 text-sm">🎉 {d.title} <span className="text-text-muted text-xs">· {d.doneAt ? longDate(d.doneAt) : ''}</span></button></li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <Modal isOpen={!!edit} onClose={() => setEdit(null)} title="Hayal">
        {edit && <DreamForm key={edit} id={edit} onDone={() => setEdit(null)} />}
      </Modal>
    </section>
  );
}

function DreamForm({ id, onDone }: { id: string; onDone: () => void }) {
  const { dreams, saveItem, removeItem, restoreItem } = useStore();
  const d = dreams.find((x) => x.id === id);
  const [title, setTitle] = useState(d?.title ?? '');
  const [note, setNote] = useState(d?.note ?? '');
  if (!d) return null;
  return (
    <div className="space-y-5">
      <Field label="Hayal"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
      <Field label="Not"><textarea className="input min-h-[80px] resize-none" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Neden istiyorsun, kiminle, ne zaman olabilir…" /></Field>
      <div className="space-y-2">
        <button onClick={async () => { if (await run(() => saveItem<Dream>('dreams', { title: title.trim() || d.title, note: note.trim() }, d.id), 'Kaydedildi')) onDone(); }} className="btn btn-primary w-full">Kaydet</button>
        {d.status === 'done' && <button onClick={async () => { if (await run(() => saveItem<Dream>('dreams', { status: 'dream', doneAt: '' }, d.id))) onDone(); }} className="btn btn-ghost w-full">Henüz gerçekleşmedi</button>}
        <button onClick={async () => {
          if (!(await confirmAction({ title: 'Bu hayal silinsin mi?', message: 'Geri alabilirsin.', confirmLabel: 'Sil', danger: true }))) return;
          const snap = { ...d } as unknown as Record<string, unknown>;
          if (await run(() => removeItem('dreams', d.id))) { onDone(); undoToast('Silindi', () => restoreItem('dreams', d.id, snap)); }
        }} className="btn btn-ghost w-full"><Trash2 size={16} /> Sil</button>
      </div>
    </div>
  );
}

/* ── Yıl sonu ─────────────────────────────────────────── */

function YearEnd({ year, open }: { year: number; open: boolean }) {
  const [show, setShow] = useState(open);
  const { yearGoals, library, journal, dreams, moments, sessions } = useStore();
  const y = String(year);
  const goals = yearGoals.filter((g) => g.year === year);
  const books = library.filter((l) => l.status === 'done' && l.finishedAt?.startsWith(y));
  const important = journal.filter((e) => e.important && e.date.startsWith(y));
  const jDays = new Set(journal.filter((e) => e.date.startsWith(y)).map((e) => e.date)).size;
  const dreamsDone = dreams.filter((d) => d.status === 'done' && d.doneAt?.startsWith(y));
  const yMoments = moments.filter((m) => m.date.startsWith(y));
  const studyH = Math.round(sessions.filter((s) => s.date.startsWith(y)).reduce((a, s) => a + s.minutes, 0) / 60);

  if (!show) return <button onClick={() => setShow(true)} className="btn btn-ghost w-full">{year} yılına bir bak</button>;
  return (
    <section className="now-card space-y-4">
      <p className="eyebrow">{year} · yıl sonu</p>
      <h2 className="font-display text-[24px] leading-tight">Bu yıl neler oldu?</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[[jDays, 'gün günlük'], [books.length, 'kitap'], [studyH, 'saat ders'], [dreamsDone.length, 'hayal gerçekleşti']].map(([n, l]) => (
          <div key={l as string} className="rounded-2xl bg-surface-el p-3"><p className="font-display text-[26px] num leading-none">{n}</p><p className="text-xs text-text-muted mt-1">{l}</p></div>
        ))}
      </div>
      {goals.length > 0 && (
        <div><p className="field-label">Niyetlerin</p>
          <ul className="text-sm space-y-0.5">{goals.map((g) => <li key={g.id}>{g.done ? '🎉' : '·'} {g.title}</li>)}</ul></div>
      )}
      {(important.length > 0 || yMoments.length > 0) && (
        <div><p className="field-label">Önemli anlar</p>
          <ul className="text-sm space-y-0.5">
            {[...yMoments.map((m) => ({ d: m.date, t: `${m.emoji ?? '⭐'} ${m.title}` })), ...important.map((e) => ({ d: e.date, t: `⭐ ${e.title || e.text.slice(0, 60)}` }))]
              .sort((a, b) => a.d.localeCompare(b.d)).map((x, i) => <li key={i}><span className="text-text-muted">{longDate(x.d)}</span> — {x.t}</li>)}
          </ul></div>
      )}
      {books.length > 0 && <p className="text-sm"><span className="text-text-muted">Bitirdiğin kitaplar:</span> {books.map((b) => b.title).join(', ')}</p>}
    </section>
  );
}
