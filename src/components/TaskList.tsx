import { Check, Plus, Repeat, Star, StickyNote } from 'lucide-react';
import { useState } from 'react';
import { AREAS } from '../constants';
import { useSheets } from '../store/useSheets';
import { useStore } from '../store/useStore';
import { run } from '../store/useUI';
import type { Task } from '../types';
import { taskSort } from '../utils/trackers';

/** Bir günün (ya da "bu hafta bir ara" kutusunun) görevleri. Sınır yok. */
export default function TaskList({ date, weekOf, placeholder = 'Görev ekle…', compact }: {
  date?: string; weekOf?: string; placeholder?: string; compact?: boolean;
}) {
  const all = useStore((s) => s.tasks);
  const dayStartHour = useStore((s) => s.settings.dayStartHour);
  const { addTask } = useStore();
  const [text, setText] = useState('');

  const tasks = all
    .filter((t) => (date ? t.forDate === date : !t.forDate && (t.weekOf || '') === (weekOf || '')))
    .sort(taskSort(dayStartHour));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = text.trim();
    if (!v) return;
    setText('');
    run(() => addTask(date ? { text: v, forDate: date } : { text: v, forDate: '', weekOf }));
  };

  return (
    <div className="space-y-0.5">
      {tasks.map((t) => <TaskRow key={t.id} t={t} compact={compact} />)}
      <form onSubmit={submit} className={`flex gap-2 ${tasks.length ? 'pt-2' : ''}`}>
        <input
          className="input py-2.5"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          maxLength={160}
          enterKeyHint="done"
        />
        <button type="submit" disabled={!text.trim()} className="btn btn-soft-accent shrink-0 px-4" aria-label="Ekle"><Plus size={18} /></button>
      </form>
    </div>
  );
}

export function TaskRow({ t, compact }: { t: Task; compact?: boolean }) {
  const { toggleTask, updateTask } = useStore();
  const openTask = useSheets((s) => s.openTask);
  const color = t.area ? AREAS[t.area].color : 'var(--accent-base)';

  return (
    <div className={`row-item ${t.done ? 'is-done' : ''} ${compact ? 'py-1.5' : ''}`} style={{ '--c': color } as React.CSSProperties}>
      <button
        onClick={() => run(() => toggleTask(t.id))}
        className={`check-btn ${t.done ? 'done animate-pop' : ''}`}
        style={{ width: 34, height: 34, minWidth: 34, minHeight: 34 }}
        aria-label={t.done ? 'Geri al' : 'Tamamlandı'}
        aria-pressed={t.done}
      >
        <Check size={15} strokeWidth={3} />
      </button>
      <button onClick={() => openTask(t.id)} className="flex-1 min-w-0 text-left min-h-0 py-1">
        <span className="flex items-center gap-2">
          {t.time && <span className="text-[11px] font-bold num shrink-0" style={{ color }}>{t.time}</span>}
          <span className="row-title text-[15px] font-medium break-words">{t.text}</span>
          {t.note && <StickyNote size={12} className="text-text-muted shrink-0" aria-label="Not var" />}
          {t.ruleId && <Repeat size={12} className="text-text-muted shrink-0" aria-label="Tekrarlayan" />}
        </span>
        {t.area && !compact && <span className="block text-[11px] text-text-muted mt-0.5">{AREAS[t.area].label}</span>}
      </button>
      <button
        onClick={() => run(() => updateTask(t.id, { star: !t.star }))}
        className={`icon-btn shrink-0 ${t.star ? 'text-warning' : 'text-text-muted opacity-40 hover:opacity-100'}`}
        aria-label={t.star ? 'Önceliği kaldır' : 'Öncelikli yap'}
        aria-pressed={!!t.star}
      >
        <Star size={16} fill={t.star ? 'currentColor' : 'none'} />
      </button>
    </div>
  );
}
