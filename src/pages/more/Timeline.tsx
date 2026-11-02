import { Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import Modal from '../../components/Modal';
import { Field } from '../../components/ui';
import { useStore } from '../../store/useStore';
import { run, undoToast } from '../../store/useUI';
import type { Moment } from '../../types';
import { longDate } from '../../utils/date';
import { computeMilestones, loadSeen } from '../../utils/milestones';

interface Item { key: string; date: string; emoji: string; title: string; sub?: string; momentId?: string }
const EMOJIS = ['⭐', '🎉', '🏠', '💼', '🎓', '❤️', '✈️', '🌱', '☀️', '👶'];
const stamp = () => Date.now();

/** Hayat çizelgesi: önemli anlar, yıllara göre */
export default function Timeline() {
  const { journal, dreams, library, courses, moments, sessions, trackers, days, people } = useStore();
  const today = useStore((s) => s.today());
  const [edit, setEdit] = useState<{ id?: string } | null>(null);

  const items = useMemo(() => {
    const out: Item[] = [];
    for (const m of moments) out.push({ key: `m-${m.id}`, date: m.date, emoji: m.emoji ?? '⭐', title: m.title, sub: m.note, momentId: m.id });
    for (const e of journal) if (e.important) out.push({ key: `j-${e.id}`, date: e.date, emoji: '⭐', title: e.title || e.text.split('\n')[0].slice(0, 80), sub: e.title ? e.text.slice(0, 120) : undefined });
    for (const d of dreams) if (d.status === 'done' && d.doneAt) out.push({ key: `d-${d.id}`, date: d.doneAt, emoji: '✨', title: `Hayal gerçekleşti: ${d.title}` });
    for (const l of library) if (l.status === 'done' && l.finishedAt && (l.kind === 'book' || l.kind === 'course')) out.push({ key: `l-${l.id}`, date: l.finishedAt, emoji: l.kind === 'book' ? '📚' : '🎓', title: `${l.title} bitti`, sub: l.creator });
    for (const c of courses) if (c.status === 'passed' && c.passedAt) out.push({ key: `c-${c.id}`, date: c.passedAt, emoji: '✅', title: `${c.name} dersini geçtin` });
    const seen = loadSeen();
    for (const m of computeMilestones({ journal, library, sessions, trackers, days, people, dreams, today })) {
      const date = m.date ?? seen[m.key];
      if (date && !m.key.startsWith('book-1') && !m.key.startsWith('dream-1')) out.push({ key: `ms-${m.key}`, date, emoji: m.emoji, title: m.title });
    }
    return out.sort((a, b) => b.date.localeCompare(a.date));
  }, [journal, dreams, library, courses, moments, sessions, trackers, days, people, today]);

  const years = items.reduce<{ year: string; items: Item[] }[]>((acc, it) => {
    const y = it.date.slice(0, 4);
    const last = acc[acc.length - 1];
    if (last?.year === y) last.items.push(it); else acc.push({ year: y, items: [it] });
    return acc;
  }, []);

  return (
    <div className="space-y-[1.75rem]">
      <section className="now-card space-y-3">
        <p className="text-[15px] leading-relaxed">Hayatının önemli anları tek yerde: ⭐ işaretlediğin günlük kayıtları, gerçekleşen hayaller, bitirdiğin kitaplar, kilometre taşları ve elle eklediğin günler.</p>
        <button onClick={() => setEdit({})} className="btn btn-primary btn-sm"><Plus size={15} /> Önemli bir gün ekle</button>
      </section>

      {years.length === 0 ? (
        <p className="text-sm text-text-muted text-center py-8 max-w-xs mx-auto leading-relaxed">Henüz boş. "Şirketi kurduk", "İlk saha işi", "Mezun oldum"… geçmişten de ekleyebilirsin.</p>
      ) : years.map((g) => (
        <section key={g.year}>
          <h2 className="font-display text-[28px] font-semibold mb-3 num">{g.year}</h2>
          <ol className="relative border-l-2 border-border ml-3 space-y-4">
            {g.items.map((it) => (
              <li key={it.key} className="pl-6 relative">
                <span className="absolute -left-[15px] top-0 w-7 h-7 rounded-full bg-surface flex items-center justify-center text-[15px] shadow-sm">{it.emoji}</span>
                <button onClick={() => it.momentId && setEdit({ id: it.momentId })} className={`block text-left min-h-0 ${it.momentId ? '' : 'cursor-default'}`}>
                  <span className="block text-[11px] text-text-muted">{longDate(it.date)}</span>
                  <span className="block font-semibold text-[15px] leading-snug">{it.title}</span>
                  {it.sub && <span className="block text-sm text-text-muted line-clamp-2 journal-text">{it.sub}</span>}
                </button>
              </li>
            ))}
          </ol>
        </section>
      ))}

      <Modal isOpen={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Önemli gün' : 'Önemli bir gün'}>
        {edit && <MomentForm key={edit.id ?? 'new'} id={edit.id} onDone={() => setEdit(null)} />}
      </Modal>
    </div>
  );
}

function MomentForm({ id, onDone }: { id?: string; onDone: () => void }) {
  const { moments, saveItem, removeItem, restoreItem } = useStore();
  const today = useStore((s) => s.today());
  const m = id ? moments.find((x) => x.id === id) : undefined;
  const [title, setTitle] = useState(m?.title ?? '');
  const [date, setDate] = useState(m?.date ?? today);
  const [note, setNote] = useState(m?.note ?? '');
  const [emoji, setEmoji] = useState(m?.emoji ?? '⭐');

  const save = async () => {
    if (!title.trim() || !date) return;
    const data: Partial<Moment> = { title: title.trim(), date, note: note.trim(), emoji, ...(m ? {} : { createdAt: stamp() }) };
    if (await run(() => saveItem<Moment>('moments', data, m?.id), 'Çizelgeye eklendi')) onDone();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1.5">
        {EMOJIS.map((e) => <button key={e} type="button" onClick={() => setEmoji(e)} className={`pill text-lg ${emoji === e ? 'active' : ''}`}>{e}</button>)}
      </div>
      <Field label="Ne oldu?"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ör: Şirketi kurduk" autoFocus={!m} /></Field>
      <Field label="Tarih"><input type="date" className="input" value={date} max={today} onChange={(e) => setDate(e.target.value)} /></Field>
      <Field label="Not (isteğe bağlı)"><textarea className="input min-h-[80px] resize-none" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      <div className="space-y-2">
        <button onClick={save} disabled={!title.trim() || !date} className="btn btn-primary w-full">{m ? 'Kaydet' : 'Ekle'}</button>
        {m && <button onClick={async () => {
          const snap = { ...m } as unknown as Record<string, unknown>;
          if (await run(() => removeItem('moments', m.id))) { onDone(); undoToast('Silindi', () => restoreItem('moments', m.id, snap)); }
        }} className="btn btn-ghost w-full"><Trash2 size={16} /> Sil</button>}
      </div>
    </div>
  );
}
