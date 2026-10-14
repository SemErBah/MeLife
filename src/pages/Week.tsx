import { CalendarCheck, Check, ChevronLeft, ChevronRight, GraduationCap, Inbox, Mail, Repeat, Sparkles } from 'lucide-react';
import { EXAM_KIND } from '../constants';
import { useMemo, useState } from 'react';
import { CATEGORIES } from '../constants';
import { TrackerIcon } from '../components/TrackerIcon';
import { IntentionList } from '../components/Review';
import ProfileButton from '../components/ProfileButton';
import TaskList from '../components/TaskList';
import { useWeeklyLetter } from '../hooks/useLetter';
import { useDoneCtx } from '../hooks/useDay';
import { useSheets } from '../store/useSheets';
import { useStore } from '../store/useStore';
import { addDays, shortDate, shortWeekday, weekday, weekStart } from '../utils/date';
import { isActive, isDone, isScheduled } from '../utils/trackers';

export default function Week() {
  const today = useStore((s) => s.today());
  const thisWeek = weekStart(today);
  const [weekOf, setWeekOf] = useState(thisWeek);
  const [seenWeek, setSeenWeek] = useState(thisWeek);
  if (seenWeek !== thisWeek) { setSeenWeek(thisWeek); setWeekOf(thisWeek); }

  const week = useStore((s) => s.weeks[weekOf]);
  const openReview = useSheets((s) => s.openReview);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekOf, i));
  const isThis = weekOf === thisWeek;
  const rel = isThis ? 'Bu hafta' : weekOf === addDays(thisWeek, 7) ? 'Gelecek hafta' : weekOf === addDays(thisWeek, -7) ? 'Geçen hafta' : null;
  // Haftanın son günlerinde (Cmt/Paz) ya da geçmiş kapatılmamış haftada öne çıkar
  const nudge = !week?.closedAt && ((isThis && [0, 6].includes(weekday(today))) || weekOf < thisWeek);

  return (
    <div className="page max-w-5xl">
      {/* Hafta gezintisi */}
      <div className="flex items-center justify-between -mx-2">
        <button onClick={() => setWeekOf(addDays(weekOf, -7))} className="icon-btn text-text-muted hover:bg-surface-hover" aria-label="Önceki hafta"><ChevronLeft size={20} /></button>
        <button onClick={() => setWeekOf(thisWeek)} disabled={isThis} className="eyebrow px-3 rounded-full hover:text-text-main" style={{ minHeight: 36 }}>
          {shortDate(weekOf)} – {shortDate(addDays(weekOf, 6))}{!isThis && ' · bu haftaya dön'}
        </button>
        <span className="flex items-center gap-1">
          <button onClick={() => setWeekOf(addDays(weekOf, 7))} className="icon-btn text-text-muted hover:bg-surface-hover" aria-label="Sonraki hafta"><ChevronRight size={20} /></button>
          <ProfileButton />
        </span>
      </div>

      <div className="flex items-end justify-between gap-3 -mt-2">
        <div>
          <h1 className="page-title">{rel ?? 'Hafta'}</h1>
          {week?.closedAt && <p className="text-sm text-text-muted mt-1 flex items-center gap-1.5"><Check size={14} className="text-accent" /> Hafta kapatıldı</p>}
        </div>
        {weekOf <= thisWeek && (
          <button onClick={() => openReview({ kind: 'week', weekOf })} className={`btn btn-sm shrink-0 ${nudge ? 'btn-primary' : 'btn-ghost'}`}>
            <CalendarCheck size={16} /> {week?.closedAt ? 'Tekrar bak' : 'Haftayı kapat'}
          </button>
        )}
      </div>

      {nudge && (
        <p className="text-sm text-text-muted -mt-3">
          {isThis ? 'Hafta bitiyor. İstersen 10 dakikada geçen haftaya bakıp yenisini planla.' : 'Bu hafta kapatılmamış. İstersen şimdi bakabilirsin.'}
        </p>
      )}

      {(nudge || weekOf < thisWeek || (isThis && [0, 6].includes(weekday(today)))) && <LetterCard weekOf={weekOf} />}

      {/* Telefonda: niyetler → bir ara → günler → rutinler. Masaüstünde günler solda, diğerleri sağda. */}
      <div className="grid lg:grid-cols-[1fr_340px] gap-5 items-start">
        <section className="widget lg:col-start-2 lg:row-start-1">
          <div className="widget-header"><h3><Sparkles size={18} className="text-[var(--cat-mind)]" /> Niyetler</h3></div>
          <div className="px-2 pb-3 sm:px-3"><IntentionList weekOf={weekOf} /></div>
        </section>

        <section className="widget lg:col-start-2 lg:row-start-2">
          <div className="widget-header"><h3><Inbox size={18} className="text-accent" /> Bu hafta bir ara</h3></div>
          <div className="px-2 pb-3 sm:px-3"><TaskList weekOf={weekOf} placeholder="Tarihi belli olmayan iş…" compact /></div>
        </section>

        <div className="space-y-5 min-w-0 lg:col-start-1 lg:row-start-1 lg:row-span-4">
          {days.map((d) => <DayCard key={d} date={d} today={today} />)}
        </div>

        <div className="lg:col-start-2 lg:row-start-3">
          <RoutineGrid days={days} today={today} />
        </div>
      </div>
    </div>
  );
}

function DayCard({ date, today }: { date: string; today: string }) {
  const count = useStore((s) => s.tasks.filter((t) => t.forDate === date).length);
  const exams = useStore((s) => s.exams.filter((e) => e.date === date));
  const courses = useStore((s) => s.courses);
  const openMore = useStore((s) => s.openMore);
  const closed = useStore((s) => !!s.days[date]?.closedAt);
  const isToday = date === today;
  const past = date < today;
  const [open, setOpen] = useState(!past || count > 0);

  return (
    <section className={`widget ${isToday ? 'ring-1 ring-accent/40' : ''} ${past ? 'opacity-80' : ''}`}>
      <button onClick={() => setOpen(!open)} className="widget-header w-full text-left min-h-0" aria-expanded={open}>
        <h3>
          <span className={`w-9 h-9 rounded-xl flex flex-col items-center justify-center leading-none ${isToday ? 'bg-accent text-[var(--base)]' : 'bg-surface-el'}`}>
            <span className="text-[9px] font-bold uppercase">{shortWeekday(date)}</span>
            <span className="text-sm font-extrabold num">{Number(date.slice(8))}</span>
          </span>
          {isToday ? 'Bugün' : shortDate(date)}
          {closed && <Check size={14} className="text-accent" aria-label="Gün kapatıldı" />}
        </h3>
        <span className="text-xs font-semibold text-text-muted">{count ? `${count} görev` : ''}</span>
      </button>
      {exams.map((e) => (
        <button key={e.id} onClick={() => openMore('courses')} className="mx-4 mb-2 flex items-center gap-2 text-sm min-h-0 text-left">
          <GraduationCap size={14} className="text-[var(--cat-mind)] shrink-0" />
          <b className="truncate">{courses.find((c) => c.id === e.courseId)?.name ?? e.title}</b>
          <span className="text-text-muted shrink-0">{EXAM_KIND[e.kind]}{e.time ? ` · ${e.time}` : ''}</span>
        </button>
      ))}
      {open && <div className="px-2 pb-3 sm:px-3 -mt-1"><TaskList date={date} placeholder="Ekle…" compact /></div>}
    </section>
  );
}

/** Hangi rutini hangi gün yaptın — bilgi amaçlı, boş günler nötr */
function RoutineGrid({ days, today }: { days: string[]; today: string }) {
  const trackers = useStore((s) => s.trackers);
  const dayLogs = useStore((s) => s.days);
  const ctx = useDoneCtx();
  const list = useMemo(() => trackers.filter((t) => isActive(t) && t.mode !== 'reduce' && t.type !== 'scale'), [trackers]);
  if (!list.length) return null;

  return (
    <section className="widget">
      <div className="widget-header"><h3><Repeat size={18} className="text-[var(--cat-order)]" /> Rutinler</h3></div>
      <div className="widget-body pt-0 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th />
              {days.map((d) => <th key={d} className={`font-semibold pb-2 ${d === today ? 'text-accent' : 'text-text-muted'}`}>{shortWeekday(d).slice(0, 2)}</th>)}
            </tr>
          </thead>
          <tbody>
            {list.map((t) => (
              <tr key={t.id}>
                <td className="py-1 pr-2 max-w-[120px]">
                  <span className="flex items-center gap-1.5 truncate" style={{ color: CATEGORIES[t.category].color }}>
                    <TrackerIcon name={t.icon} size={13} /><span className="text-text-main truncate">{t.name}</span>
                  </span>
                </td>
                {days.map((d) => {
                  const done = d <= today && isDone(t, dayLogs[d], d, ctx);
                  const planned = isScheduled(t, d);
                  return (
                    <td key={d} className="text-center py-1">
                      <span
                        className="inline-block w-4 h-4 rounded-md align-middle"
                        style={{ background: done ? CATEGORIES[t.category].color : 'var(--surface-el)', opacity: done ? 1 : planned ? 1 : 0.35 }}
                        title={done ? 'yapıldı' : ''}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Haftanın mektubu: kısa, yargısız özet */
function LetterCard({ weekOf }: { weekOf: string }) {
  const text = useWeeklyLetter(weekOf);
  const [open, setOpen] = useState(false);
  return (
    <section className="now-card">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between text-left min-h-0" aria-expanded={open}>
        <span className="font-display text-lg font-semibold flex items-center gap-2"><Mail size={18} className="text-accent" /> Haftanın mektubu</span>
        <span className="text-xs text-text-muted">{open ? 'Gizle' : 'Oku'}</span>
      </button>
      {open && <p className="mt-3 text-[15px] leading-relaxed whitespace-pre-line">{text}</p>}
    </section>
  );
}
