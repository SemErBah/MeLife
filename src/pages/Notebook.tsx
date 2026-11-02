import { BookHeart, Lightbulb, Search, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { JournalCard, JournalEditor } from '../components/Journal';
import Modal from '../components/Modal';
import PinLock from '../components/PinLock';
import { useNotebookLock } from '../utils/pin';
import ProfileButton from '../components/ProfileButton';
import { Segmented } from '../components/ui';
import { useStore } from '../store/useStore';
import type { JournalEntry } from '../types';
import { longDate } from '../utils/date';
import { memoriesFor } from '../utils/journal';
import Notes from './Notes';

/** Defter: günlük + aklımdakiler */
export default function Notebook() {
  const [tab, setTab] = useState<'journal' | 'notes'>(() => {
    try { return (sessionStorage.getItem('melife-notebook-tab') as 'journal' | 'notes') || 'journal'; } catch { return 'journal'; }
  });
  const choose = (t: 'journal' | 'notes') => { setTab(t); try { sessionStorage.setItem('melife-notebook-tab', t); } catch { /* */ } };
  const { locked, unlock } = useNotebookLock();

  return (
    <div className="page max-w-3xl lg:max-w-6xl">
      <header className="flex items-center justify-between gap-3">
        <h1 className="page-title">Defter</h1>
        <ProfileButton />
      </header>
      <div className="max-w-sm">
        <Segmented value={tab} onChange={choose} options={[
          { value: 'journal', label: <span className="inline-flex items-center gap-1.5"><BookHeart size={14} /> Günlük</span> },
          { value: 'notes', label: <span className="inline-flex items-center gap-1.5"><Lightbulb size={14} /> Aklımdakiler</span> },
        ]} />
      </div>
      {locked ? <PinLock onUnlock={unlock} /> : tab === 'journal' ? <JournalView /> : <Notes embedded />}
    </div>
  );
}

function JournalView() {
  const journal = useStore((s) => s.journal);
  const today = useStore((s) => s.today());
  const [q, setQ] = useState('');
  const [tag, setTag] = useState('');
  const [open, setOpen] = useState<JournalEntry | null>(null);

  const tags = useMemo(() => {
    const count: Record<string, number> = {};
    journal.forEach((e) => e.tags?.forEach((t) => { count[t] = (count[t] ?? 0) + 1; }));
    return Object.entries(count).sort((a, b) => b[1] - a[1]).slice(0, 14);
  }, [journal]);

  const query = q.trim().toLocaleLowerCase('tr-TR');
  const list = journal.filter((e) => (!tag || e.tags?.includes(tag))
    && (!query || `${e.title ?? ''} ${e.text}`.toLocaleLowerCase('tr-TR').includes(query)));
  const groups = list.reduce<{ date: string; items: JournalEntry[] }[]>((acc, e) => {
    const last = acc[acc.length - 1];
    if (last?.date === e.date) last.items.push(e); else acc.push({ date: e.date, items: [e] });
    return acc;
  }, []);
  const memories = memoriesFor(journal, today);
  const written = new Set(journal.map((e) => e.date)).size;

  return (
    <div className="grid lg:grid-cols-[1fr_400px] gap-[1.75rem] items-start">
      {/* Sağ sütun (telefonda üstte): yazma + hatıralar + etiketler */}
      <div className="space-y-[1.75rem] lg:order-2 lg:sticky lg:top-4 min-w-0">
        <section className="now-card">
          <p className="eyebrow mb-3">{longDate(today)}</p>
          <JournalEditor />
        </section>

        {memories.length > 0 && <MemoriesCard memories={memories} onOpen={setOpen} />}

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map(([t, n]) => (
              <button key={t} onClick={() => setTag(tag === t ? '' : t)} className={`pill ${tag === t ? 'active' : ''}`}>#{t} <span className="opacity-60 num">{n}</span></button>
            ))}
          </div>
        )}
      </div>

      {/* Sol sütun: akış */}
      <div className="space-y-4 lg:order-1 min-w-0">
        {journal.length > 4 && (
          <div className="relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
            <input type="search" className="input pl-11" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Günlükte ara…" />
          </div>
        )}
        {journal.length > 0 && <p className="text-xs text-text-muted px-1">{written} gün yazmışsın · {journal.length} kayıt</p>}

        {groups.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <Sparkles className="mx-auto text-text-muted" size={22} />
            <p className="text-sm text-text-muted max-w-xs mx-auto leading-relaxed">
              {journal.length ? 'Aramana uyan kayıt yok.' : 'Burası senin defterin. İlk satırı yaz; bir cümle bile yeter. Bir yıl sonra bugüne dönüp bakacaksın.'}
            </p>
          </div>
        ) : groups.map((g) => (
          <div key={g.date} className="space-y-2">
            <p className="slot-label px-1">{g.date === today ? 'Bugün' : longDate(g.date)}</p>
            {g.items.map((e) => <JournalCard key={e.id} e={e} onOpen={() => setOpen(e)} />)}
          </div>
        ))}
      </div>

      <Modal isOpen={!!open} onClose={() => setOpen(null)} title={open ? longDate(open.date) : ''}>
        {open && <JournalEditor key={open.id} entry={journal.find((x) => x.id === open.id) ?? open} onDone={() => setOpen(null)} />}
      </Modal>
    </div>
  );
}

export function MemoriesCard({ memories, onOpen }: { memories: ReturnType<typeof memoriesFor>; onOpen?: (e: JournalEntry) => void }) {
  return (
    <section className="widget">
      <div className="widget-header"><h3>Bu günün hatıraları</h3></div>
      <div className="widget-body space-y-3">
        {memories.map((m) => (
          <div key={m.label}>
            <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-1">{m.label}</p>
            {m.entries.slice(0, 2).map((e) => (
              <button key={e.id} onClick={() => onOpen?.(e)} className="block w-full text-left min-h-0 py-1">
                {e.title && <span className="block font-semibold text-sm">{e.title}</span>}
                <span className="journal-text text-[14px] line-clamp-2 text-text-muted">{e.text}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
