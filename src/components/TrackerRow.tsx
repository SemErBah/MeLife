import { Bell, Check, Play, Plus } from 'lucide-react';
import { useState } from 'react';
import { CATEGORIES, SCALE_FACES } from '../constants';
import { TrackerIcon } from './TrackerIcon';
import type { TrackerView } from '../hooks/useDay';
import { useSheets } from '../store/useSheets';
import { useStore } from '../store/useStore';
import { useTimer } from '../store/useTimer';
import { run } from '../store/useUI';
import { fmtMinutes } from '../utils/date';

/** Satırın altındaki durum metni — bilgi verir, yargılamaz */
function trackerSubtitle(v: TrackerView, day?: { sleep?: { bed: string; wake: string } }): string {
  const { t, value } = v;
  const parts: string[] = [];
  switch (t.type) {
    case 'counter':
      parts.push(`${value.toLocaleString('tr-TR')}${t.target ? ` / ${t.target.toLocaleString('tr-TR')}` : ''} ${t.unit ?? ''}`.trim());
      break;
    case 'duration':
      if (value) parts.push(fmtMinutes(value));
      else if (t.hint) parts.push(t.hint);
      break;
    case 'sleep':
      if (day?.sleep) parts.push(`${day.sleep.bed} → ${day.sleep.wake} · ${fmtMinutes(value)}`);
      break;
    case 'number':
      if (value) parts.push(`${value.toLocaleString('tr-TR')} ${t.unit ?? ''}`.trim());
      break;
  }
  if (t.weeklyTimes) parts.push(`bu hafta ${v.weekly}/${t.weeklyTimes}`);
  if (!parts.length && t.hint) parts.push(t.hint);
  return parts.join(' · ');
}

export default function TrackerRow({ v, date, showTime = true }: { v: TrackerView; date: string; showTime?: boolean }) {
  const { t, value, done } = v;
  const day = useStore((s) => s.days[date]);
  const { setEntry, bumpEntry } = useStore();
  const openTracker = useSheets((s) => s.openTracker);
  const timer = useTimer();
  const [pop, setPop] = useState(0);
  const color = CATEGORIES[t.category].color;
  const running = timer.running?.trackerId === t.id;
  const pct = t.target ? Math.min(1, value / t.target) : 0;
  const hasReminder = t.reminders?.some((r) => r.on);

  let control: React.ReactNode = null;
  if (t.type === 'check') {
    control = (
      <button
        key={pop}
        onClick={() => { setPop((p) => p + 1); run(() => setEntry(t.id, done ? 0 : 1, date)); }}
        className={`check-btn ${done ? 'done animate-pop' : ''}`}
        aria-label={done ? `${t.name}: yapıldı, geri al` : `${t.name}: yaptım`}
        aria-pressed={done}
      >
        <Check size={20} strokeWidth={3} />
      </button>
    );
  } else if (t.type === 'counter') {
    control = (
      <button
        onClick={() => run(() => bumpEntry(t.id, t.step ?? 1, date))}
        className="step-btn tinted gap-1"
        aria-label={`${t.name}: ${t.step ?? 1} ${t.unit ?? ''} ekle`}
      >
        <Plus size={16} strokeWidth={3} />{t.step ?? 1}
      </button>
    );
  } else if (t.type === 'duration') {
    control = running ? (
      <button onClick={() => timer.setOpen(true)} className="step-btn tinted gap-1.5" aria-label="Sayacı aç">
        <span className="w-2 h-2 rounded-full bg-current animate-pulse" /> Sürüyor
      </button>
    ) : (
      <button
        onClick={() => timer.start(t.id)}
        disabled={!!timer.running}
        className={`check-btn ${done ? 'done' : ''}`}
        style={done ? undefined : { color }}
        aria-label={`${t.name}: sayacı başlat`}
      >
        {done ? <Check size={20} strokeWidth={3} /> : <Play size={18} className="ml-0.5" fill="currentColor" />}
      </button>
    );
  } else if (t.type === 'scale') {
    control = <span className="text-2xl w-11 text-center">{value ? SCALE_FACES[value - 1] : '–'}</span>;
  } else if (done) {
    control = <span className="check-btn done" aria-hidden="true"><Check size={20} strokeWidth={3} /></span>;
  }

  const subtitle = trackerSubtitle(v, day);

  return (
    <div className={`row-item ${done ? 'is-done' : ''}`} style={{ '--c': color } as React.CSSProperties}>
      <button onClick={() => openTracker(t.id, date)} className="flex items-center gap-3 flex-1 min-w-0 text-left min-h-0" aria-label={`${t.name} ayrıntıları`}>
        <span className="cat-bubble"><TrackerIcon name={t.icon} /></span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="row-title font-semibold text-[15px] truncate">{t.name}</span>
            {showTime && t.time && <span className="text-[11px] font-semibold text-text-muted num shrink-0">{t.time}</span>}
            {hasReminder && <Bell size={11} className="text-text-muted shrink-0" aria-label="Anımsatıcı açık" />}
          </span>
          {subtitle && <span className="block text-xs text-text-muted truncate mt-0.5">{subtitle}</span>}
          {(t.type === 'counter' || (t.type === 'duration' && t.target)) && (
            <span className="block h-1 rounded-full bg-surface-el mt-1.5 overflow-hidden max-w-[220px]">
              <span className="block h-full rounded-full transition-[width] duration-500" style={{ width: `${pct * 100}%`, background: color }} />
            </span>
          )}
        </span>
      </button>
      {control}
    </div>
  );
}
