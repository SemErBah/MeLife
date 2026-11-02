import { Archive, CalendarPlus, Lightbulb, Search, Send, Sun, Sunrise, Trash2 } from 'lucide-react';
import { useState } from 'react';
import ProfileButton from '../components/ProfileButton';
import { EmptyHint, PageHeader } from '../components/ui';
import { useSheets } from '../store/useSheets';
import { useStore } from '../store/useStore';
import { run, undoToast } from '../store/useUI';
import type { InboxItem } from '../types';
import { addDays, shortDate, toKey, weekStart } from '../utils/date';

/** Aklımdakiler: kafandakini boşalt, sonra istediğin zaman göreve çevir */
export default function Notes({ embedded }: { embedded?: boolean }) {
  const { inbox, addInbox } = useStore();
  const [text, setText] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const [q, setQ] = useState('');
  const query = q.trim().toLocaleLowerCase('tr-TR');
  const match = (i: InboxItem) => !query || i.text.toLocaleLowerCase('tr-TR').includes(query);
  const now = useStore((s) => s.now);
  const monthAgo = now.getTime() - 30 * 86_400_000;
  const open = inbox.filter((i) => i.status !== 'archived' && match(i));
  const recent = open.filter((i) => i.createdAt >= monthAgo);
  const old = open.filter((i) => i.createdAt < monthAgo);
  const archived = inbox.filter((i) => i.status === 'archived' && match(i));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = text.trim();
    if (!v) return;
    setText('');
    await run(() => addInbox(v));
  };

  return (
    <div className={embedded ? 'space-y-[1.75rem]' : 'page max-w-3xl'}>
      {!embedded && <PageHeader title="Notlar" subtitle="Aklına geleni yaz, sonra karar verirsin." action={<ProfileButton />} />}

      <form onSubmit={submit} className="flex gap-2">
        <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Ör: inverter garanti belgesini bul" maxLength={240} enterKeyHint="send" />
        <button type="submit" disabled={!text.trim()} className="btn btn-primary shrink-0 px-4" aria-label="Kaydet"><Send size={18} /></button>
      </form>

      {inbox.length > 5 && (
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
          <input type="search" className="input pl-11" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Notlarda ara…" />
        </div>
      )}

      {open.length === 0 ? (
        <EmptyHint icon={<Lightbulb size={22} />} text={query ? 'Aramana uyan not yok.' : 'Boş. Aklına bir şey gelince buraya ya da + butonuyla yaz.'} />
      ) : (
        <>
          {recent.length > 0 && (
            <ul className="space-y-2">
              {recent.map((i) => <NoteItem key={i.id} item={i} />)}
            </ul>
          )}
          {old.length > 0 && (
            <div>
              <button onClick={() => setShowOld(!showOld)} className="text-xs font-semibold text-text-muted" style={{ minHeight: 32 }}>
                {showOld || query ? '30 günden eski notlar' : `30 günden eski notlar (${old.length}) · göster`}
              </button>
              {(showOld || query) && (
                <ul className="space-y-2 mt-1">
                  {old.map((i) => <NoteItem key={i.id} item={i} />)}
                </ul>
              )}
            </div>
          )}
        </>
      )}

      {archived.length > 0 && (
        <div>
          <button onClick={() => setShowArchived(!showArchived)} className="text-xs font-semibold text-text-muted" style={{ minHeight: 32 }}>
            {showArchived ? 'Arşivi gizle' : `Arşiv (${archived.length})`}
          </button>
          {showArchived && <ArchivedList items={archived} />}
        </div>
      )}
    </div>
  );
}

function NoteItem({ item }: { item: InboxItem }) {
  const { addTask, removeInbox, setInboxStatus, restoreItem } = useStore();
  const today = useStore((s) => s.today());
  const openTask = useSheets((s) => s.openTask);

  const toTask = (data: { forDate: string; weekOf?: string }, msg: string) =>
    run(async () => { await addTask({ text: item.text, ...data }); await removeInbox(item.id); }, msg);

  return (
    <li className="card p-4 space-y-3">
      <div className="flex items-start gap-3">
        <p className="flex-1 text-[15px] font-medium break-words leading-relaxed">{item.text}</p>
        <span className="text-[11px] text-text-muted shrink-0 num mt-0.5">{shortDate(toKey(new Date(item.createdAt)))}</span>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        <button onClick={() => toTask({ forDate: today }, 'Bugüne eklendi')} className="pill"><Sun size={13} /> Bugün</button>
        <button onClick={() => toTask({ forDate: addDays(today, 1) }, 'Yarına eklendi')} className="pill"><Sunrise size={13} /> Yarın</button>
        <button onClick={() => toTask({ forDate: '', weekOf: weekStart(today) }, 'Bu haftaya eklendi')} className="pill">Bu hafta bir ara</button>
        <button
          onClick={() => openTask(null, { text: item.text })}
          className="pill"
        ><CalendarPlus size={13} /> Gün seç…</button>
        <span className="flex-1" />
        <button onClick={() => run(() => setInboxStatus(item.id, 'archived'))} className="pill" aria-label="Arşivle"><Archive size={13} /></button>
        <button onClick={async () => {
          const snapshot = { ...item } as unknown as Record<string, unknown>;
          if (await run(() => removeInbox(item.id))) undoToast('Not silindi', () => restoreItem('inbox', item.id, snapshot));
        }} className="pill hover:!text-danger" aria-label="Sil"><Trash2 size={13} /></button>
      </div>
    </li>
  );
}

function ArchivedList({ items }: { items: InboxItem[] }) {
  const setInboxStatus = useStore((s) => s.setInboxStatus);
  return (
    <ul className="space-y-1 mt-1">
      {items.map((i) => (
        <li key={i.id} className="flex items-center gap-2 text-sm text-text-muted py-1">
          <span className="flex-1 break-words">{i.text}</span>
          <button onClick={() => run(() => setInboxStatus(i.id, 'open'))} className="pill">Geri al</button>
        </li>
      ))}
    </ul>
  );
}
