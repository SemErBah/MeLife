import { Cake, Coffee, MessageCircle, Plus, Trash2, UserRound } from 'lucide-react';
import { useState } from 'react';
import Modal from '../../components/Modal';
import { Field } from '../../components/ui';
import { useStore } from '../../store/useStore';
import { confirmAction, run } from '../../store/useUI';
import type { Person, Relation } from '../../types';
import { daysBetween, longDate, shortDate } from '../../utils/date';
import { useLogContact } from '../../hooks/useLogContact';
import { contactDue, nextBirthday, RELATION, sinceLabel } from '../../utils/people';

const stamp = () => Date.now();

export default function People() {
  const people = useStore((s) => s.people);
  const today = useStore((s) => s.today());
  const [edit, setEdit] = useState<{ id?: string } | null>(null);
  const groups = (Object.keys(RELATION) as Relation[]).map((r) => ({ r, list: people.filter((p) => p.relation === r) })).filter((g) => g.list.length);
  const birthdays = people.map((p) => ({ p, b: nextBirthday(p.birthday, today) })).filter((x) => x.b && x.b.inDays <= 30).sort((a, b) => a.b!.inDays - b.b!.inDays);

  return (
    <div className="space-y-5">
      <section className="now-card space-y-3">
        <p className="text-[15px] leading-relaxed">Sevdiklerinle bağını hatırlatan küçük bir defter. Doğum günlerini ve en son ne zaman konuştuğunu tutar; istersen arada nazikçe hatırlatır.</p>
        <button onClick={() => setEdit({})} className="btn btn-primary btn-sm"><Plus size={15} /> Kişi ekle</button>
      </section>

      {birthdays.length > 0 && (
        <section className="widget">
          <div className="widget-header"><h3><Cake size={16} /> Yaklaşan doğum günleri</h3></div>
          <div className="px-2 pb-3 sm:px-3">
            {birthdays.map(({ p, b }) => (
              <button key={p.id} onClick={() => setEdit({ id: p.id })} className="row-item w-full text-left min-h-0">
                <Avatar name={p.name} />
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold text-[15px] truncate">{p.name}</span>
                  <span className="block text-xs text-text-muted">{shortDate(b!.date)}{b!.age ? ` · ${b!.age} yaşına giriyor` : ''}</span>
                </span>
                <span className="text-sm font-semibold num">{b!.inDays === 0 ? 'Bugün 🎂' : b!.inDays === 1 ? 'Yarın' : `${b!.inDays} gün`}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {people.length === 0 ? (
        <p className="text-sm text-text-muted text-center py-8">Annen, kardeşin, ortağın, yakın arkadaşların… İstediğin kadar kişi ekle.</p>
      ) : groups.map(({ r, list }) => (
        <section key={r} className="widget">
          <div className="widget-header"><h3>{RELATION[r]}</h3></div>
          <div className="px-2 pb-3 sm:px-3">{list.map((p) => <PersonRow key={p.id} p={p} today={today} onOpen={() => setEdit({ id: p.id })} />)}</div>
        </section>
      ))}

      <Modal isOpen={!!edit} onClose={() => setEdit(null)} title={edit?.id ? people.find((p) => p.id === edit.id)?.name ?? 'Kişi' : 'Yeni kişi'}>
        {edit && <PersonForm key={edit.id ?? 'new'} id={edit.id} onDone={() => setEdit(null)} />}
      </Modal>
    </div>
  );
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toLocaleUpperCase('tr-TR');
  return (
    <span className="cat-bubble font-bold text-sm" style={{ '--c': 'var(--cat-social)', width: size, height: size, borderRadius: 999 } as React.CSSProperties}>{initials}</span>
  );
}

function PersonRow({ p, today, onOpen }: { p: Person; today: string; onOpen: () => void }) {
  const due = contactDue(p, today);
  const since = p.lastContact ? daysBetween(p.lastContact, today) : null;
  return (
    <button onClick={onOpen} className="row-item w-full text-left min-h-0">
      <Avatar name={p.name} />
      <span className="flex-1 min-w-0">
        <span className="block font-semibold text-[15px] truncate">{p.name}</span>
        <span className="block text-xs text-text-muted truncate">
          {since !== null ? `Son görüşme ${sinceLabel(since)}` : 'Henüz kayıt yok'}
          {due !== null ? ' · arasan iyi olur' : ''}
        </span>
      </span>
      {due !== null && <span className="w-2 h-2 rounded-full bg-accent shrink-0" />}
    </button>
  );
}

function PersonForm({ id, onDone }: { id?: string; onDone: () => void }) {
  const { people, journal, saveItem, removeItem } = useStore();
  const today = useStore((s) => s.today());
  const logContact = useLogContact();
  const p = id ? people.find((x) => x.id === id) : undefined;
  const [name, setName] = useState(p?.name ?? '');
  const [relation, setRelation] = useState<Relation>(p?.relation ?? 'family');
  const [birthday, setBirthday] = useState(p?.birthday && p.birthday.length === 10 ? p.birthday : '');
  const [every, setEvery] = useState(p?.everyDays ?? 0);
  const [notes, setNotes] = useState(p?.notes ?? '');
  const memories = p ? journal.filter((e) => e.people?.includes(p.id)) : [];
  const b = nextBirthday(p?.birthday, today);

  const save = async () => {
    if (!name.trim()) return;
    const data: Partial<Person> = { name: name.trim(), relation, birthday, everyDays: every || 0, notes: notes.trim(), ...(p ? {} : { createdAt: stamp(), contacts: [] }) };
    if (await run(() => saveItem<Person>('people', data, p?.id), p ? 'Kaydedildi' : 'Kişi eklendi')) onDone();
  };

  return (
    <div className="space-y-5">
      {p && (
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => logContact(p.id, 'talk')} className="btn btn-soft-accent"><MessageCircle size={16} /> Konuştuk</button>
          <button onClick={() => logContact(p.id, 'meet')} className="btn btn-ghost"><Coffee size={16} /> Görüştük</button>
        </div>
      )}
      {p && (
        <p className="text-sm text-text-muted">
          {p.lastContact ? `Son görüşme: ${longDate(p.lastContact)}` : 'Henüz görüşme kaydı yok.'}
          {b ? ` · Doğum günü ${b.inDays === 0 ? 'bugün 🎂' : `${b.inDays} gün sonra`}` : ''}
        </p>
      )}

      <Field label="Ad"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ör: Annem, Ali Yılmaz" autoFocus={!p} /></Field>
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(RELATION) as Relation[]).map((r) => <button key={r} type="button" onClick={() => setRelation(r)} className={`pill ${relation === r ? 'active' : ''}`}>{RELATION[r]}</button>)}
      </div>
      <Field label="Doğum günü (isteğe bağlı)" hint="Yılını bilmiyorsan herhangi bir yıl seç; yaşı yanlış görünür, tarih doğru olur.">
        <input type="date" className="input" value={birthday} onChange={(e) => setBirthday(e.target.value)} />
      </Field>
      <Field label="Ara sıra hatırlat (isteğe bağlı)">
        <div className="flex flex-wrap gap-1.5">
          {[0, 7, 14, 30, 60].map((n) => <button key={n} type="button" onClick={() => setEvery(n)} className={`pill ${every === n ? 'active' : ''}`}>{n === 0 ? 'Hatırlatma' : n === 7 ? 'Haftada bir' : n === 14 ? '2 haftada bir' : n === 30 ? 'Ayda bir' : '2 ayda bir'}</button>)}
        </div>
      </Field>
      <Field label="Notlar"><textarea className="input min-h-[80px] resize-none" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Hediye fikirleri, sevdiği şeyler, son konuştuğunuz konu…" /></Field>

      {p && (p.contacts?.length ?? 0) > 0 && (
        <div>
          <p className="field-label">Görüşmeler</p>
          <ul className="space-y-1">
            {p.contacts!.slice(0, 8).map((c, i) => (
              <li key={i} className="text-sm flex gap-2"><span className="text-text-muted num w-16 shrink-0">{shortDate(c.date)}</span> {c.kind === 'talk' ? '💬 Konuştunuz' : '☕ Görüştünüz'}{c.note ? ` · ${c.note}` : ''}</li>
            ))}
          </ul>
        </div>
      )}

      {memories.length > 0 && (
        <div>
          <p className="field-label">Birlikte anılar</p>
          <ul className="space-y-2">
            {memories.slice(0, 6).map((e) => (
              <li key={e.id} className="rounded-2xl bg-surface-el p-3">
                <p className="text-[11px] text-text-muted">{longDate(e.date)}</p>
                <p className="journal-text text-[14px] line-clamp-3">{e.title ? `${e.title} — ` : ''}{e.text}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-2">
        <button onClick={save} disabled={!name.trim()} className="btn btn-primary w-full">{p ? 'Kaydet' : 'Ekle'}</button>
        {p && (
          <button onClick={async () => {
            if (await confirmAction({ title: `${p.name} silinsin mi?`, message: 'Günlükteki anılar silinmez.', confirmLabel: 'Sil', danger: true })
              && await run(() => removeItem('people', p.id), 'Silindi')) onDone();
          }} className="btn btn-ghost w-full"><Trash2 size={16} /> Sil</button>
        )}
      </div>
      {!p && <p className="text-[11px] text-text-muted text-center flex items-center justify-center gap-1"><UserRound size={12} /> Günlükte @{name.split(' ')[0] || 'Ad'} yazınca bu kişiye bağlanır.</p>}
    </div>
  );
}
