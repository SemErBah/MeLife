import { Cake, MessageCircle, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { useLogContact } from '../hooks/useLogContact';
import { computeMilestones, freshMilestones, loadSeen, markSeen } from '../utils/milestones';
import { contactDue, nextBirthday, sinceLabel } from '../utils/people';

const dismissKey = (today: string) => `melife-dismiss-people-${today}`;
function readDismissed(today: string): string[] {
  try { return JSON.parse(localStorage.getItem(dismissKey(today)) ?? '[]'); } catch { return []; }
}

/** Bugün: yaklaşan doğum günleri ve "uzun zamandır konuşmadın" soruları. Kapatılabilir. */
export function PeopleNudges({ today }: { today: string }) {
  const people = useStore((s) => s.people);
  const openMore = useStore((s) => s.openMore);
  const logContact = useLogContact();
  const [dismissed, setDismissed] = useState(() => readDismissed(today));
  const hide = (id: string) => {
    const next = [...dismissed, id];
    setDismissed(next);
    try { localStorage.setItem(dismissKey(today), JSON.stringify(next)); } catch { /* */ }
  };

  const birthdays = people
    .map((p) => ({ p, b: nextBirthday(p.birthday, today) }))
    .filter((x) => x.b && x.b.inDays <= 3 && !dismissed.includes(`b-${x.p.id}`));
  const due = people
    .map((p) => ({ p, days: contactDue(p, today) }))
    .filter((x) => x.days !== null && !dismissed.includes(`c-${x.p.id}`))
    .sort((a, b) => b.days! - a.days!)
    .slice(0, 2);
  if (!birthdays.length && !due.length) return null;

  return (
    <div className="space-y-2 -mt-2">
      {birthdays.map(({ p, b }) => (
        <div key={p.id} className="card p-3.5 flex items-center gap-3">
          <Cake size={18} className="text-[var(--cat-social)] shrink-0" />
          <button onClick={() => openMore('people')} className="text-sm flex-1 text-left min-h-0">
            {b!.inDays === 0 ? <><b>{p.name}</b> bugün doğum günü 🎂 Bir mesaj atmak ister misin?</> : <><b>{p.name}</b> {b!.inDays === 1 ? 'yarın' : `${b!.inDays} gün sonra`} doğum günü.</>}
          </button>
          <button onClick={() => hide(`b-${p.id}`)} className="icon-btn text-text-muted shrink-0" aria-label="Kapat"><X size={16} /></button>
        </div>
      ))}
      {due.map(({ p, days }) => (
        <div key={p.id} className="card p-3.5 flex items-center gap-3">
          <MessageCircle size={18} className="text-[var(--cat-social)] shrink-0" />
          <p className="text-sm flex-1"><b>{p.name.split(' ')[0]}</b> ile en son {sinceLabel(days!)} konuştun. Bugün arasan mı?</p>
          <button onClick={() => logContact(p.id, 'talk')} className="btn btn-soft-accent btn-sm shrink-0">Konuştuk</button>
          <button onClick={() => hide(`c-${p.id}`)} className="icon-btn text-text-muted shrink-0" aria-label="Şimdi değil"><X size={16} /></button>
        </div>
      ))}
    </div>
  );
}

/** Tek seferlik kutlama kartı: görülünce bir daha çıkmaz */
export function MilestoneCard({ today }: { today: string }) {
  const { journal, library, sessions, trackers, days, people, dreams } = useStore();
  const [, bump] = useState(0);
  const all = computeMilestones({ journal, library, sessions, trackers, days, people, dreams, today });
  const { show, silent } = freshMilestones(all, loadSeen(), today);
  // Eski tarihli taşlar kutlanmadan görüldü sayılır
  const silentKeys = silent.map((x) => x.key).join(',');
  useEffect(() => { if (silent.length) markSeen(silent, today); }, [silentKeys]); // eslint-disable-line react-hooks/exhaustive-deps
  const m = show[0];
  if (!m) return null;
  return (
    <div className="now-card flex items-center gap-3 !py-4">
      <span className="text-[28px] leading-none">{m.emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="eyebrow">Kilometre taşı</p>
        <p className="font-display text-[17px] leading-snug">{m.title}</p>
      </div>
      <button onClick={() => { markSeen([m], today); bump((n) => n + 1); }} className="btn btn-ghost btn-sm shrink-0">Güzel 🌱</button>
    </div>
  );
}
