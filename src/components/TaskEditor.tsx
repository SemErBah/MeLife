import { Bell, Footprints, Repeat as RepeatIcon, Star, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { AREAS } from '../constants';
import { useSheets, type TaskDraft } from '../store/useSheets';
import { useStore } from '../store/useStore';
import { run, undoToast } from '../store/useUI';
import type { Area, Repeat, Task } from '../types';
import { REPEAT_LABEL } from '../utils/recurring';
import { addDays, shortWeekday, WEEKDAY_LETTERS, weekday, weekStart } from '../utils/date';
import Modal from './Modal';
import { Field } from './ui';

/** Görev ekle / düzenle — sadece metin gerekli */
export default function TaskEditor() {
  const sheet = useSheets((s) => s.task);
  const close = useSheets((s) => s.close);
  const task = useStore((s) => s.tasks.find((t) => t.id === sheet?.id));
  return (
    <Modal isOpen={!!sheet} onClose={close} title={sheet?.id ? 'Görevi düzenle' : 'Yeni görev'}>
      {sheet && <Body key={sheet.id ?? 'new'} initial={task} draft={sheet.draft} />}
    </Modal>
  );
}

function Body({ initial, draft }: { initial?: Task; draft?: TaskDraft }) {
  const { addTask, updateTask, removeTask, restoreItem, saveItem, rules, tasks } = useStore();
  const today = useStore((s) => s.today());
  const close = useSheets((s) => s.close);
  const openStart = useSheets((s) => s.openStart);
  const rule = initial?.ruleId ? rules.find((r) => r.id === initial.ruleId) : undefined;
  const [repeat, setRepeat] = useState<Repeat | ''>('');
  const [repeatDays, setRepeatDays] = useState<number[]>([]);
  const [t, setT] = useState<TaskDraft>(initial ?? { forDate: today, ...draft });
  const set = (patch: TaskDraft) => setT((cur) => ({ ...cur, ...patch }));

  const tomorrow = addDays(today, 1);
  const quickDates: { label: string; date: string }[] = [
    { label: 'Bugün', date: today },
    { label: 'Yarın', date: tomorrow },
    ...[2, 3, 4, 5, 6].map((n) => ({ label: shortWeekday(addDays(today, n)), date: addDays(today, n) })),
  ];
  const someday = !t.forDate;

  const save = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = (t.text ?? '').trim();
    if (!text) return;
    const data = {
      ...t, text,
      forDate: t.forDate || '',
      weekOf: t.forDate ? '' : (t.weekOf || weekStart(today)),
      time: t.forDate ? (t.time || '') : '',
    };
    // Yeni ve tekrarlayan: kural oluştur, görevleri kural üretir
    if (!initial && repeat && data.forDate) {
      const ok = await run(async () => {
        await saveItem('taskRules', {
          text, repeat, startDate: data.forDate, active: true, createdAt: Date.now(),
          ...(repeat === 'weekly' ? { days: repeatDays.length ? repeatDays : [weekday(data.forDate)] } : {}),
          ...(repeat === 'monthly' ? { monthDay: Number(data.forDate.slice(8)) } : {}),
          ...(data.time ? { time: data.time } : {}), ...(t.star ? { star: true } : {}), ...(t.area ? { area: t.area } : {}),
          ...(t.note ? { note: t.note } : {}), ...(t.remindBefore ? { remindBefore: t.remindBefore } : {}),
        });
      }, `${REPEAT_LABEL[repeat]} tekrarlanacak`);
      if (ok) close();
      return;
    }
    const ok = initial
      ? await run(() => updateTask(initial.id, data))
      : await run(() => addTask(data), 'Eklendi');
    if (ok) close();
  };

  /** Kuralı durdur: gelecekteki yapılmamış kopyalar silinir, geçmiş kalır */
  const stopRule = async () => {
    if (!rule) return;
    const future = tasks.filter((x) => x.ruleId === rule.id && !x.done && (x.forDate ?? '') > today);
    if (await run(async () => {
      await saveItem('taskRules', { active: false }, rule.id);
      await Promise.all(future.map((x) => removeTask(x.id)));
    }, 'Tekrar durduruldu')) close();
  };

  return (
    <form onSubmit={save} className="space-y-5">
      <div className="flex gap-2 items-start">
        <textarea
          className="input flex-1 min-h-[60px] resize-none text-[16px]"
          value={t.text ?? ''}
          onChange={(e) => set({ text: e.target.value })}
          placeholder="Ne yapacaksın?"
          autoFocus
          maxLength={160}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); } }}
        />
        <button type="button" onClick={() => set({ star: !t.star })} className={`icon-btn ${t.star ? 'text-warning' : 'text-text-muted'}`} style={{ width: 44, height: 44 }} aria-label="Öncelikli" aria-pressed={!!t.star}>
          <Star size={20} fill={t.star ? 'currentColor' : 'none'} />
        </button>
      </div>

      <Field label="Ne zaman?">
        <div className="flex flex-wrap gap-1.5">
          {quickDates.map((q) => (
            <button type="button" key={q.date} onClick={() => set({ forDate: q.date })} className={`pill ${t.forDate === q.date ? 'active' : ''}`}>{q.label}</button>
          ))}
          <button type="button" onClick={() => set({ forDate: '', time: '' })} className={`pill ${someday ? 'active' : ''}`}>Bu hafta bir ara</button>
        </div>
      </Field>

      {!someday && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tarih"><input type="date" className="input num" value={t.forDate ?? ''} onChange={(e) => set({ forDate: e.target.value })} /></Field>
          <Field label="Saat (isteğe bağlı)"><input type="time" className="input num" value={t.time ?? ''} onChange={(e) => set({ time: e.target.value })} /></Field>
        </div>
      )}

      {!someday && t.time && (
        <Field label="Telegram'dan haber (isteğe bağlı)">
          <div className="flex flex-wrap gap-1.5">
            {[0, 10, 15, 30, 60].map((m) => (
              <button type="button" key={m} onClick={() => set({ remindBefore: m || undefined })} className={`pill ${(t.remindBefore ?? 0) === m ? 'active' : ''}`}>
                {m === 0 ? 'Yok' : <><Bell size={12} /> {m} dk önce</>}
              </button>
            ))}
          </div>
        </Field>
      )}

      {!initial && !someday && (
        <Field label="Tekrarla (isteğe bağlı)">
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setRepeat('')} className={`pill ${repeat === '' ? 'active' : ''}`}>Hayır</button>
            {(Object.keys(REPEAT_LABEL) as Repeat[]).map((r) => (
              <button type="button" key={r} onClick={() => setRepeat(r)} className={`pill ${repeat === r ? 'active' : ''}`}><RepeatIcon size={12} /> {REPEAT_LABEL[r]}</button>
            ))}
          </div>
          {repeat === 'weekly' && (
            <div className="flex gap-1 mt-2">
              {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                const on = repeatDays.length ? repeatDays.includes(d) : t.forDate ? weekday(t.forDate) === d : false;
                return (
                  <button type="button" key={d} onClick={() => setRepeatDays((cur) => {
                    const base = cur.length ? cur : t.forDate ? [weekday(t.forDate)] : [];
                    return base.includes(d) ? base.filter((x) => x !== d) : [...base, d];
                  })} className={`flex-1 h-9 rounded-xl text-xs font-bold ${on ? 'bg-accent text-[var(--base)]' : 'bg-surface-el text-text-muted'}`} style={{ minHeight: 36 }}>
                    {WEEKDAY_LETTERS[d]}
                  </button>
                );
              })}
            </div>
          )}
        </Field>
      )}
      {rule && (
        <div className="rounded-2xl bg-surface-el p-3 flex items-center gap-3">
          <RepeatIcon size={16} className="text-text-muted shrink-0" />
          <p className="text-sm flex-1">{rule.active ? `${REPEAT_LABEL[rule.repeat]} tekrarlanıyor` : 'Tekrar durduruldu'}</p>
          {rule.active && <button type="button" onClick={stopRule} className="pill">Durdur</button>}
        </div>
      )}

      <Field label="Alan (isteğe bağlı)">
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(AREAS) as Area[]).map((a) => (
            <button type="button" key={a} onClick={() => set({ area: t.area === a ? undefined : a })} className={`pill ${t.area === a ? 'active' : ''}`}>
              <span className="w-2 h-2 rounded-full" style={{ background: AREAS[a].color }} /> {AREAS[a].label}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Not (isteğe bağlı)">
        <textarea className="input min-h-[64px] resize-none" value={t.note ?? ''} onChange={(e) => set({ note: e.target.value })} placeholder="Ayrıntı, adres, link…" />
      </Field>

      <div className="space-y-2">
        <button type="submit" disabled={!(t.text ?? '').trim()} className="btn btn-primary w-full">{initial ? 'Kaydet' : 'Ekle'}</button>
        {initial && !initial.done && (
          <button type="button" onClick={() => openStart(initial.id)} className="btn btn-soft-accent w-full"><Footprints size={16} /> Başlayamıyorum</button>
        )}
        {initial && (
          <button type="button" onClick={async () => {
            const snapshot = { ...initial } as unknown as Record<string, unknown>;
            // Tekrarlayan kopya silinirse o gün yeniden üretilmesin
            if (rule && initial.forDate) await run(() => saveItem('taskRules', { skips: [...(rule.skips ?? []), initial.forDate!] }, rule.id));
            if (await run(() => removeTask(initial.id))) {
              close();
              undoToast('Görev silindi', () => restoreItem('tasks', initial.id, snapshot));
            }
          }} className="btn btn-ghost w-full">
            <Trash2 size={16} /> Sil
          </button>
        )}
      </div>
    </form>
  );
}
