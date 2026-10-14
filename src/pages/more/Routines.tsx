import { ChevronDown, ChevronUp, Pause, Plus, Target, TrendingDown } from 'lucide-react';
import { CATEGORIES } from '../../constants';
import { TrackerIcon } from '../../components/TrackerIcon';
import { useSheets } from '../../store/useSheets';
import { useStore } from '../../store/useStore';
import { run } from '../../store/useUI';
import { WEEKDAY_LETTERS } from '../../utils/date';
import { limitFor } from '../../utils/reduce';
import type { Tracker } from '../../types';

/* ── Rutinlerim ───────────────────────────────────────── */

function describe(t: Tracker, today: string): string {
  if (t.mode === 'reduce' && t.reduce) return `Azaltıyorum · bugün en fazla ${limitFor(t.reduce, today)} ${t.unit ?? ''}`.trim();
  const parts: string[] = [];
  parts.push(!t.days?.length || t.days.length === 7 ? 'Her gün' : [1, 2, 3, 4, 5, 6, 0].filter((d) => t.days!.includes(d)).map((d) => WEEKDAY_LETTERS[d]).join(' '));
  if (t.time) parts.push(t.time);
  const rem = t.reminders?.filter((r) => r.on).length;
  if (rem) parts.push(`${rem} anımsatıcı`);
  return parts.join(' · ');
}

export default function Routines() {
  const { trackers, reorderTrackers } = useStore();
  const openRoutine = useSheets((s) => s.openRoutine);
  const today = useStore((s) => s.today());
  const list = trackers.filter((t) => t.active);

  const move = (i: number, dir: -1 | 1) => {
    const ids = list.map((t) => t.id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    run(() => reorderTrackers(ids));
  };

  return (
    <section className="settings-group">
      <h3 className="flex items-center justify-between">
        <span>{list.length} rutin</span>
        <span className="flex gap-1.5">
          <button onClick={() => openRoutine(null, 'reduce')} className="widget-link normal-case tracking-normal"><TrendingDown size={13} className="inline -mt-0.5" /> Azalt</button>
          <button onClick={() => openRoutine(null)} className="widget-link normal-case tracking-normal"><Plus size={13} className="inline -mt-0.5" /> Yeni</button>
        </span>
      </h3>
      {list.length === 0 ? (
        <p className="p-5 text-sm text-text-muted">Henüz rutin yok. "Yeni" ile yapmak istediğin, "Azalt" ile bırakmak/azaltmak istediğin bir şeyi ekleyebilirsin.</p>
      ) : (
        <ul className="p-2">
          {list.map((t, i) => (
            <li key={t.id} className={`row-item ${t.paused ? 'opacity-55' : ''}`} style={{ '--c': CATEGORIES[t.category].color } as React.CSSProperties}>
              <button onClick={() => openRoutine(t.id)} className="flex items-center gap-3 flex-1 min-w-0 text-left min-h-0">
                <span className="cat-bubble sm"><TrackerIcon name={t.icon} size={16} /></span>
                <span className="min-w-0">
                  <span className="block font-semibold text-[15px] truncate">{t.name}</span>
                  <span className="block text-xs text-text-muted truncate">
                    {t.paused ? <><Pause size={10} className="inline -mt-0.5" /> Duraklatıldı</> : describe(t, today)}
                    {t.focus && <> · <Target size={10} className="inline -mt-0.5" /> odakta</>}
                  </span>
                </span>
              </button>
              <div className="flex flex-col">
                <button onClick={() => move(i, -1)} disabled={i === 0} className="icon-btn text-text-muted disabled:opacity-20" style={{ height: 22, minHeight: 22 }} aria-label="Yukarı"><ChevronUp size={16} /></button>
                <button onClick={() => move(i, 1)} disabled={i === list.length - 1} className="icon-btn text-text-muted disabled:opacity-20" style={{ height: 22, minHeight: 22 }} aria-label="Aşağı"><ChevronDown size={16} /></button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

