import { BookOpen, ExternalLink, Film, GraduationCap, Headphones, MonitorPlay, Newspaper, Plus, Quote as QuoteIcon, Search, Star, Trash2, Tv, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import Modal from '../../components/Modal';
import { Field, ProgressBar } from '../../components/ui';
import { LIB_KIND, LIB_STATUS } from '../../constants';
import { useStore } from '../../store/useStore';
import { run, undoToast } from '../../store/useUI';
import type { LibKind, LibraryItem, LibStatus, Quote } from '../../types';
import { shortDate } from '../../utils/date';

const LIB_ICON: Record<LibKind, React.ReactNode> = {
  book: <BookOpen size={16} />, film: <Film size={16} />, series: <Tv size={16} />, course: <GraduationCap size={16} />,
  video: <MonitorPlay size={16} />, podcast: <Headphones size={16} />, article: <Newspaper size={16} />,
};

const hasProgress = (k: LibKind) => !!LIB_KIND[k].unit;
const stamp = () => Date.now();
const newQuote = (text: string, page?: number): Quote => ({ id: Math.random().toString(36).slice(2, 9), text, page, createdAt: stamp() });

export default function Library() {
  const library = useStore((s) => s.library);
  const today = useStore((s) => s.today());
  const [kind, setKind] = useState<LibKind | ''>('');
  const [status, setStatus] = useState<LibStatus | ''>('');
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<{ id?: string } | null>(null);

  const year = today.slice(0, 4);
  const yearDone = library.filter((l) => l.status === 'done' && l.finishedAt?.startsWith(year));
  const yearSummary = (Object.keys(LIB_KIND) as LibKind[])
    .map((k) => [k, yearDone.filter((l) => l.kind === k).length] as const)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${n} ${LIB_KIND[k].plural}`).join(', ');

  const doing = library.filter((l) => l.status === 'doing');
  const query = q.trim().toLocaleLowerCase('tr-TR');
  const list = useMemo(() => library.filter((l) =>
    (!kind || l.kind === kind) && (!status || l.status === status)
    && (!query || `${l.title} ${l.creator ?? ''}`.toLocaleLowerCase('tr-TR').includes(query))), [library, kind, status, query]);

  return (
    <div className="space-y-5">
      <section className="now-card space-y-3">
        <p className="eyebrow">{year}</p>
        <p className="text-lg font-semibold">{yearSummary ? `Bu yıl ${yearSummary} bitirdin.` : 'Bu yıl bitirdiğin bir şey henüz yok.'}</p>
        <button onClick={() => setEdit({})} className="btn btn-primary btn-sm"><Plus size={15} /> Ekle</button>
      </section>

      {doing.length > 0 && (
        <section className="widget">
          <div className="widget-header"><h3>Şu an</h3></div>
          <div className="px-2 pb-3 sm:px-3">{doing.map((l) => <ItemRow key={l.id} item={l} onOpen={() => setEdit({ id: l.id })} />)}</div>
        </section>
      )}

      <div className="space-y-2">
        {library.length > 6 && (
          <div className="relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
            <input type="search" className="input pl-11" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Başlık ya da yazar ara…" />
          </div>
        )}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
          <button onClick={() => setKind('')} className={`pill shrink-0 ${kind === '' ? 'active' : ''}`}>Hepsi</button>
          {(Object.keys(LIB_KIND) as LibKind[]).map((k) => (
            <button key={k} onClick={() => setKind(kind === k ? '' : k)} className={`pill shrink-0 ${kind === k ? 'active' : ''}`}>{LIB_ICON[k]} {LIB_KIND[k].label}</button>
          ))}
        </div>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {(Object.keys(LIB_STATUS) as LibStatus[]).map((s) => (
            <button key={s} onClick={() => setStatus(status === s ? '' : s)} className={`pill shrink-0 ${status === s ? 'active' : ''}`}>{LIB_STATUS[s]}</button>
          ))}
        </div>
      </div>

      <section className="widget">
        <div className="px-2 py-3 sm:px-3">
          {list.length === 0
            ? <p className="text-sm text-text-muted px-3 py-4">{library.length ? 'Bu filtrede bir şey yok.' : 'Okuduğun kitapları, izlediğin dizileri, bitirmek istediğin kursları buraya ekle.'}</p>
            : list.map((l) => <ItemRow key={l.id} item={l} onOpen={() => setEdit({ id: l.id })} />)}
        </div>
      </section>

      <Modal isOpen={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Kütüphane' : 'Kütüphaneye ekle'}>
        {edit && <ItemForm key={edit.id ?? 'new'} id={edit.id} onDone={() => setEdit(null)} />}
      </Modal>
    </div>
  );
}

function Stars({ value, onChange, size = 14 }: { value?: number; onChange?: (v: number) => void; size?: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const on = (value ?? 0) >= n;
        const icon = <Star size={size} fill={on ? 'currentColor' : 'none'} className={on ? 'text-warning' : 'text-text-muted opacity-40'} />;
        return onChange
          ? <button key={n} type="button" onClick={() => onChange(value === n ? 0 : n)} className="min-h-0 min-w-0 p-1" aria-label={`${n} yıldız`}>{icon}</button>
          : <span key={n}>{icon}</span>;
      })}
    </span>
  );
}

function ItemRow({ item, onOpen }: { item: LibraryItem; onOpen: () => void }) {
  const k = LIB_KIND[item.kind];
  const pct = item.total ? Math.min(100, ((item.progress ?? 0) / item.total) * 100) : 0;
  return (
    <button onClick={onOpen} className="row-item w-full text-left min-h-0">
      <span className="cat-bubble" style={{ '--c': 'var(--cat-mind)' } as React.CSSProperties}>{LIB_ICON[item.kind]}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-[15px] font-semibold truncate">{item.title}</span>
        <span className="block text-xs text-text-muted truncate">
          {[item.creator, LIB_STATUS[item.status], item.status === 'doing' && item.total ? `${item.progress ?? 0}/${item.total} ${k.unit}` : null].filter(Boolean).join(' · ')}
        </span>
        {item.status === 'doing' && item.total ? (
          <span className="block h-1 rounded-full bg-surface-el mt-1.5 overflow-hidden max-w-[200px]">
            <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--cat-mind)' }} />
          </span>
        ) : null}
      </span>
      {item.rating ? <Stars value={item.rating} size={11} /> : null}
    </button>
  );
}

function ItemForm({ id, onDone }: { id?: string; onDone: () => void }) {
  const { library, trackers, saveItem, removeItem, restoreItem, bumpEntry } = useStore();
  const today = useStore((s) => s.today());
  const item = id ? library.find((l) => l.id === id) : undefined;
  const [kind, setKind] = useState<LibKind>(item?.kind ?? 'book');
  const [title, setTitle] = useState(item?.title ?? '');
  const [creator, setCreator] = useState(item?.creator ?? '');
  const [status, setStatus] = useState<LibStatus>(item?.status ?? 'want');
  const [progress, setProgress] = useState(item?.progress ? String(item.progress) : '');
  const [total, setTotal] = useState(item?.total ? String(item.total) : '');
  const [rating, setRating] = useState(item?.rating ?? 0);
  const [note, setNote] = useState(item?.note ?? '');
  const [url, setUrl] = useState(item?.url ?? '');
  const [quote, setQuote] = useState('');
  const [quotePage, setQuotePage] = useState('');
  const k = LIB_KIND[kind];
  // "Kitap oku" rutini: sayfa birimli sayaç (varsa)
  const readingTracker = trackers.find((t) => t.active && !t.paused && t.type === 'counter' && t.unit === 'sayfa');

  const build = (over: Partial<LibraryItem> = {}): Partial<LibraryItem> => {
    const st = over.status ?? status;
    const prog = over.progress ?? (Number(progress) || 0);
    const tot = Number(total) || undefined;
    return {
      kind, title: title.trim(), creator: creator.trim(), status: st,
      progress: prog, ...(tot ? { total: tot } : {}),
      rating: rating || 0, note: note.trim(), url: url.trim(),
      startedAt: item?.startedAt || (st !== 'want' ? today : ''),
      finishedAt: st === 'done' ? item?.finishedAt || today : '',
      updatedAt: stamp(),
      ...(item ? {} : { createdAt: stamp(), quotes: [] }),
      ...over,
    };
  };

  const save = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!title.trim()) return;
    if (await run(() => saveItem<LibraryItem>('library', build(), item?.id), item ? 'Kaydedildi' : 'Eklendi')) onDone();
  };

  /** Hızlı ilerleme: kitapta okuma rutinini de günceller */
  const bump = async (delta: number) => {
    if (!item) return;
    const next = Math.max(0, (Number(progress) || 0) + delta);
    const tot = Number(total) || 0;
    const done = tot > 0 && next >= tot;
    setProgress(String(tot ? Math.min(next, tot) : next));
    if (done) setStatus('done');
    await run(async () => {
      await saveItem<LibraryItem>('library', build({ progress: tot ? Math.min(next, tot) : next, status: done ? 'done' : status === 'want' ? 'doing' : status }), item.id);
      if (kind === 'book' && readingTracker && delta > 0) await bumpEntry(readingTracker.id, delta, today);
    }, done ? `"${title}" bitti 🎉` : undefined);
  };

  const addQuote = async () => {
    if (!item || !quote.trim()) return;
    const qs: Quote[] = [...(item.quotes ?? []), newQuote(quote.trim(), Number(quotePage) || undefined)];
    if (await run(() => saveItem<LibraryItem>('library', { quotes: qs, updatedAt: stamp() }, item.id), 'Alıntı eklendi')) { setQuote(''); setQuotePage(''); }
  };

  return (
    <form onSubmit={save} className="space-y-5">
      <div className="flex gap-1.5 flex-wrap">
        {(Object.keys(LIB_KIND) as LibKind[]).map((x) => (
          <button type="button" key={x} onClick={() => setKind(x)} className={`pill ${kind === x ? 'active' : ''}`}>{LIB_ICON[x]} {LIB_KIND[x].label}</button>
        ))}
      </div>
      <Field label="Başlık"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={kind === 'book' ? 'Ör: Atomik Alışkanlıklar' : 'Başlık'} autoFocus={!item} /></Field>
      <Field label={`${k.creator} (isteğe bağlı)`}><input className="input" value={creator} onChange={(e) => setCreator(e.target.value)} /></Field>
      <div className="flex gap-1.5 flex-wrap">
        {(Object.keys(LIB_STATUS) as LibStatus[]).map((s) => (
          <button type="button" key={s} onClick={() => setStatus(s)} className={`pill ${status === s ? 'active' : ''}`}>{LIB_STATUS[s]}</button>
        ))}
      </div>

      {hasProgress(kind) && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-3">
            <Field label={`Şu an (${k.unit})`}><input className="input num" inputMode="numeric" value={progress} onChange={(e) => setProgress(e.target.value.replace(/\D/g, ''))} placeholder="0" /></Field>
            <Field label={`Toplam (${k.unit})`}><input className="input num" inputMode="numeric" value={total} onChange={(e) => setTotal(e.target.value.replace(/\D/g, ''))} placeholder="—" /></Field>
          </div>
          {Number(total) > 0 && <ProgressBar pct={((Number(progress) || 0) / Number(total)) * 100} color="var(--cat-mind)" height={6} />}
          {item && (
            <div className="flex gap-1.5 flex-wrap">
              {(kind === 'book' ? [5, 10, 25] : [1]).map((n) => <button type="button" key={n} onClick={() => bump(n)} className="pill">+{n} {k.unit}</button>)}
              {kind === 'book' && readingTracker && <span className="text-[11px] text-text-muted self-center">"{readingTracker.name}" rutinine de eklenir</span>}
            </div>
          )}
        </div>
      )}

      <Field label="Puan"><Stars value={rating} onChange={setRating} size={22} /></Field>
      <Field label="Not (isteğe bağlı)"><textarea className="input min-h-[70px] resize-none" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ne düşündün, ne kaldı aklında?" /></Field>
      <Field label="Bağlantı (isteğe bağlı)">
        <div className="flex gap-2">
          <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" inputMode="url" />
          {url && /^https?:\/\//.test(url) && <a href={url} target="_blank" rel="noreferrer" className="btn btn-ghost shrink-0 px-3" aria-label="Aç"><ExternalLink size={16} /></a>}
        </div>
      </Field>

      {item && (
        <div>
          <p className="field-label flex items-center gap-1.5"><QuoteIcon size={12} /> Alıntılar</p>
          <ul className="space-y-2 mb-3">
            {(item.quotes ?? []).map((qt) => (
              <li key={qt.id} className="rounded-2xl bg-surface-el p-3 text-sm leading-relaxed flex gap-2">
                <span className="flex-1">“{qt.text}”{qt.page ? <span className="text-text-muted"> · s. {qt.page}</span> : null}</span>
                <button type="button" onClick={() => run(() => saveItem<LibraryItem>('library', { quotes: (item.quotes ?? []).filter((x) => x.id !== qt.id) }, item.id))} className="icon-btn text-text-muted shrink-0" style={{ width: 28, height: 28, minHeight: 28, minWidth: 28 }} aria-label="Alıntıyı sil"><X size={14} /></button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <textarea className="input min-h-[44px] resize-none flex-1" value={quote} onChange={(e) => setQuote(e.target.value)} placeholder="Alıntı…" />
            {kind === 'book' && <input className="input num w-20" inputMode="numeric" value={quotePage} onChange={(e) => setQuotePage(e.target.value.replace(/\D/g, ''))} placeholder="s." />}
          </div>
          <button type="button" onClick={addQuote} disabled={!quote.trim()} className="btn btn-ghost btn-sm mt-2"><Plus size={14} /> Alıntı ekle</button>
        </div>
      )}

      {item?.finishedAt && <p className="text-xs text-text-muted">Bitirdiğin tarih: {shortDate(item.finishedAt)}</p>}

      <div className="space-y-2">
        <button type="submit" disabled={!title.trim()} className="btn btn-primary w-full">{item ? 'Kaydet' : 'Ekle'}</button>
        {item && (
          <button type="button" onClick={async () => {
            const snap = { ...item } as unknown as Record<string, unknown>;
            if (await run(() => removeItem('library', item.id))) { onDone(); undoToast('Silindi', () => restoreItem('library', item.id, snap)); }
          }} className="btn btn-ghost w-full"><Trash2 size={16} /> Sil</button>
        )}
      </div>
    </form>
  );
}
