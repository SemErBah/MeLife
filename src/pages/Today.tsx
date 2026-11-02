import { motion } from 'framer-motion';
import { BookHeart, Check, ChevronLeft, ChevronRight, Flame, Footprints, GraduationCap, ListTodo, Moon, MoonStar, Plus, Repeat, Target, TrendingDown, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { SCALE_FACES } from '../constants';
import ProfileButton from '../components/ProfileButton';
import { JournalEditor } from '../components/Journal';
import Modal from '../components/Modal';
import { MemoriesCard } from './Notebook';
import { memoriesFor } from '../utils/journal';
import { promptFor } from '../utils/prompts';
import TaskList from '../components/TaskList';
import SunCard from '../components/SunCard';
import { MilestoneCard, PeopleNudges } from '../components/LifeNudges';
import { PICK } from '../components/StartSmall';
import TrackerRow from '../components/TrackerRow';
import { ReduceCard } from '../components/Reduce';
import { useDay, useDoneCtx, type TrackerView } from '../hooks/useDay';
import { useSheets } from '../store/useSheets';
import { useStore } from '../store/useStore';
import { run } from '../store/useUI';
import { addDays, dayMonth, daysBetween, fmtMinutes, greeting, longDate, nowToMin, sleepMinutes, timeToMin, weekdayName } from '../utils/date';
import { byTime, streak } from '../utils/trackers';
import type { JournalEntry, Tracker } from '../types';

type Slot = 'morning' | 'noon' | 'evening' | 'night' | 'any';
const SLOTS: { id: Slot; label: string }[] = [
  { id: 'morning', label: 'Sabah' },
  { id: 'noon', label: 'Gün içi' },
  { id: 'evening', label: 'Akşam' },
  { id: 'night', label: 'Gece' },
  { id: 'any', label: 'Gün boyu' },
];
function slotOf(t: Tracker): Slot {
  if (!t.time) return 'any';
  const h = Number(t.time.split(':')[0]);
  if (h >= 4 && h < 11) return 'morning';
  if (h >= 11 && h < 17) return 'noon';
  if (h >= 17 && h < 22) return 'evening';
  return 'night';
}

const PLAN_TITLES: Record<string, string> = { Bugün: 'Bugünün planı', Dün: 'Dünün planı', Yarın: 'Yarının planı' };

export default function Today() {
  const today = useStore((s) => s.today());
  const jumpDate = useStore((s) => s.jumpDate);
  const goToDate = useStore((s) => s.goToDate);
  const [date, setDate] = useState(jumpDate ?? today);
  // Gün değişince (gece 04:00) bugüne kay — render sırasında karşılaştırma (effect yok)
  const [seenToday, setSeenToday] = useState(today);
  if (seenToday !== today) { setSeenToday(today); setDate(today); }
  // Takvimden gelen "bu güne git" bir kez kullanılır
  useEffect(() => { if (jumpDate) goToDate(null); }, [jumpDate, goToDate]);
  return <DayView key={date} date={date} today={today} onDate={setDate} />;
}

function DayView({ date, today, onDate }: { date: string; today: string; onDate: (d: string) => void }) {
  const { items, day, done, focus } = useDay(date);
  const { user, settings, trackers, days, tasks, now } = useStore();
  const openRoutine = useSheets((s) => s.openRoutine);
  const openReview = useSheets((s) => s.openReview);
  const openStart = useSheets((s) => s.openStart);
  const ctx = useDoneCtx();
  const isToday = date === today;
  const nowMin = nowToMin(now, settings.dayStartHour);
  const firstName = (settings.displayName || user?.name || '').split(' ')[0];

  const chain = useMemo(
    () => (settings.showStreak ? streak(trackers, days, today, tasks, ctx) : 0),
    [settings.showStreak, trackers, days, today, tasks, ctx],
  );

  const sleepView = items.find((v) => v.t.type === 'sleep');
  const reduceItems = items.filter((v) => v.t.mode === 'reduce' && v.t.reduce);
  const buildItems = items.filter((v) => v.t.mode !== 'reduce');
  const rel = date === today ? 'Bugün' : date === addDays(today, -1) ? 'Dün' : date === addDays(today, 1) ? 'Yarın' : null;

  const summary = done > 0
    ? `${rel ?? 'O gün'} ${done} şey yaptın.`
    : date > today ? 'Henüz gelmedi. İstersen şimdiden bir şeyler planla.'
    : isToday ? 'Yavaştan başla. Bir şey yeter.' : 'Bu gün için kayıt yok.';

  return (
    <div className="page max-w-3xl lg:max-w-6xl relative">
      {/* Günün saatine göre başlık ışığı (şafak / öğlen / akşam / gece) */}
      {isToday && <div className="ambient" data-tod={timeOfDay(now)} aria-hidden="true" />}

      {/* Başlık: gün adı büyük, tarih ve selam küçük */}
      <header className="space-y-3 relative">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-text-muted">
            {isToday ? `${greeting(now)}${firstName ? `, ${firstName}` : ''}` : rel ?? ''}
          </p>
          <div className="flex items-center gap-1">
            <button onClick={() => onDate(addDays(date, -1))} className="icon-btn text-text-muted hover:bg-surface-el rounded-full" aria-label="Önceki gün"><ChevronLeft size={18} /></button>
            {!isToday && <button onClick={() => onDate(today)} className="pill" style={{ minHeight: 30, padding: '4px 12px' }}>Bugün</button>}
            <button onClick={() => onDate(addDays(date, 1))} className="icon-btn text-text-muted hover:bg-surface-el rounded-full" aria-label="Sonraki gün"><ChevronRight size={18} /></button>
            <ProfileButton />
          </div>
        </div>
        <h1 className="page-title">
          {weekdayName(date)}<span className="text-text-muted">, {dayMonth(date)}</span>
        </h1>
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[15px] text-text-muted">{summary}</p>
          {chain > 1 && <span className="pill" style={{ color: 'var(--warning-base)', minHeight: 26, padding: '2px 10px' }}><Flame size={12} fill="currentColor" /> {chain} gün</span>}
        </div>
      </header>

      {/* Yaklaşan sınavlar (14 gün) ve odak modu önerisi */}
      {isToday && <SunCard />}
      {isToday && <ExamStrip today={today} />}
      {isToday && <PeopleNudges today={today} />}
      {isToday && <MilestoneCard today={today} />}
      {focus && (
        <p className="text-xs text-text-muted -mt-3 flex items-center gap-1.5"><Target size={13} /> Odak modundasın · yalnızca seçtiğin rutinler görünüyor</p>
      )}

      {/* Sabah: uyku sorusu (isteğe bağlı, kapatılabilir) */}
      {isToday && sleepView && !day?.sleep && now.getHours() < 14 && <SleepPrompt trackerId={sleepView.t.id} date={date} />}

      {/* Akşam: günü kapatalım mı? */}
      {isToday && !day?.closedAt && nowMin >= timeToMin('20:00') && <CloseDayNudge date={date} />}

      {/* Geniş ekranda iki sütun: solda plan, sağda rutinler */}
      <div className="grid lg:grid-cols-2 gap-[1.75rem] items-start">
      <div className="space-y-[1.75rem] min-w-0">
      {/* Plan */}
      <section className="widget">
        <div className="widget-header">
          <h3><ListTodo size={18} className="text-accent" /> {rel ? PLAN_TITLES[rel] : 'Plan'}</h3>
          {isToday && <button className="widget-link" onClick={() => openStart(PICK)}><Footprints size={13} className="inline -mt-0.5" /> Şimdi ne yapsam?</button>}
        </div>
        <div className="px-2 pb-3 sm:px-3">
          <TaskList date={date} placeholder={date > today ? 'Bu güne bir şey ekle…' : 'Görev ekle…'} />
        </div>
      </section>

      {/* Azaltıyorum (sigara vb.) — bugün canlı kart, diğer günlerde düzeltilebilir satır */}
      {reduceItems.length > 0 && (
        <section className="space-y-3">
          <h3 className="section-title px-1"><TrendingDown size={18} className="text-[var(--cat-health)]" /> Azaltıyorum</h3>
          {isToday
            ? reduceItems.map((v) => <ReduceCard key={v.t.id} t={v.t} />)
            : <div className="widget px-2 py-2">{reduceItems.map((v) => <TrackerRow key={v.t.id} v={v} date={date} showTime={false} />)}</div>}
        </section>
      )}

      </div>

      <div className="space-y-[1.75rem] min-w-0">
      {/* Rutinler */}
      <Routines items={buildItems} date={date} onAdd={() => openRoutine(null)} />

      {/* Gün notu */}
      {date <= today && <JournalToday date={date} legacyNote={day?.note} />}

      {/* Günü kapat — istediğin an */}
      {date <= today && (
        <button onClick={() => openReview({ kind: 'day', date })} className="btn btn-ghost w-full">
          {day?.closedAt ? <><Check size={16} className="text-accent" /> Gün kapatıldı · tekrar bak</> : <><MoonStar size={16} /> Günü kapat</>}
        </button>
      )}
      </div>
      </div>
    </div>
  );
}

/** Günün saati → başlık ışığının tonu */
function timeOfDay(now: Date): 'dawn' | 'day' | 'evening' | 'night' {
  const h = now.getHours();
  if (h >= 5 && h < 10) return 'dawn';
  if (h >= 10 && h < 17) return 'day';
  if (h >= 17 && h < 21) return 'evening';
  return 'night';
}

/* ── Rutinler ─────────────────────────────────────────── */

function Routines({ items, date, onAdd }: { items: TrackerView[]; date: string; onAdd: () => void }) {
  const dayStartHour = useStore((s) => s.settings.dayStartHour);
  const setEntry = useStore((s) => s.setEntry);
  const scales = items.filter((v) => v.t.type === 'scale');
  const rest = [...items.filter((v) => v.t.type !== 'scale')].sort((a, b) => byTime(dayStartHour)(a.t, b.t));
  const groups = SLOTS.map((s) => ({ ...s, items: rest.filter((v) => slotOf(v.t) === s.id) })).filter((g) => g.items.length);

  return (
    <section className="widget">
      <div className="widget-header">
        <h3><Repeat size={18} className="text-[var(--cat-order)]" /> Rutinlerim</h3>
        <button className="widget-link" onClick={onAdd}><Plus size={13} className="inline -mt-0.5" /> Ekle</button>
      </div>

      {items.length === 0 ? (
        <div className="widget-body pt-0">
          <p className="text-sm text-text-muted">
            Bugün için rutin yok. Diş fırçalamak, su, ders gibi şeyleri takip etmek istersen ekleyebilirsin. Hiçbiri zorunlu değil.
          </p>
        </div>
      ) : (
        <div className="px-2 pb-3 sm:px-3 space-y-4">
          {groups.map((g) => (
            <div key={g.id}>
              <p className="slot-label">{g.label}</p>
              <div className="space-y-0.5">
                {g.items.map((v) => <TrackerRow key={v.t.id} v={v} date={date} />)}
              </div>
            </div>
          ))}
          {scales.map(({ t, value }) => (
            <div key={t.id} className="px-3">
              <p className="slot-label px-0">{t.name}</p>
              <div className="grid grid-cols-5 gap-2">
                {SCALE_FACES.map((f, i) => (
                  <button
                    key={f}
                    onClick={() => run(() => setEntry(t.id, value === i + 1 ? 0 : i + 1, date))}
                    className={`chip-tile text-2xl py-2 ${value === i + 1 ? 'active' : ''}`}
                    aria-label={`${t.name}: ${i + 1} / 5`}
                    aria-pressed={value === i + 1}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ── Uyku sorusu ──────────────────────────────────────── */

function SleepPrompt({ trackerId, date }: { trackerId: string; date: string }) {
  const setSleep = useStore((s) => s.setSleep);
  const [bed, setBed] = useState('00:00');
  const [wake, setWake] = useState('07:00');
  const [hidden, setHidden] = useDismiss(`sleep-${date}`);
  if (hidden) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="card p-5 space-y-4" style={{ '--c': 'var(--cat-health)' } as React.CSSProperties}>
      <div className="flex items-center gap-3">
        <span className="cat-bubble"><Moon size={20} /></span>
        <div className="flex-1">
          <p className="font-bold">Nasıl uyudun?</p>
          <p className="text-xs text-text-muted">İstersen kaydet, istemezsen geç.</p>
        </div>
        <button onClick={setHidden} className="icon-btn text-text-muted hover:bg-surface-hover" aria-label="Geç"><X size={18} /></button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block"><span className="field-label">Yattım</span><input type="time" className="input num" value={bed} onChange={(e) => setBed(e.target.value)} /></label>
        <label className="block"><span className="field-label">Kalktım</span><input type="time" className="input num" value={wake} onChange={(e) => setWake(e.target.value)} /></label>
      </div>
      <button onClick={() => run(() => setSleep(trackerId, bed, wake, date), 'Uyku kaydedildi')} className="btn btn-primary w-full">
        Kaydet · {fmtMinutes(sleepMinutes(bed, wake))}
      </button>
    </motion.div>
  );
}

/* ── Akşam önerisi ────────────────────────────────────── */

function CloseDayNudge({ date }: { date: string }) {
  const tomorrowCount = useStore((s) => s.tasks.filter((t) => t.forDate === addDays(date, 1)).length);
  const openReview = useSheets((s) => s.openReview);
  const [hidden, setHidden] = useDismiss(`close-${date}`);
  if (hidden) return null;

  return (
    <div className="card p-4 flex items-center gap-3" style={{ '--c': 'var(--cat-mind)' } as React.CSSProperties}>
      <span className="cat-bubble"><MoonStar size={20} /></span>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-[15px]">Günü kapatalım mı?</p>
        <p className="text-xs text-text-muted">Bugüne bak, yarını yaz.{tomorrowCount ? ` Yarın için ${tomorrowCount} şey var.` : ''}</p>
      </div>
      <button onClick={() => openReview({ kind: 'day', date })} className="btn btn-soft-accent btn-sm shrink-0">Başla</button>
      <button onClick={setHidden} className="icon-btn text-text-muted hover:bg-surface-hover shrink-0" aria-label="Şimdi değil"><X size={16} /></button>
    </div>
  );
}

/* ── Sınavlar ─────────────────────────────────────────── */

const EXAM_LABEL: Record<string, string> = { vize: 'vizesi', final: 'finali', but: 'bütünlemesi', quiz: 'quizi', odev: 'ödevi', proje: 'projesi' };

function ExamStrip({ today }: { today: string }) {
  const { exams, courses, settings, saveSettings, openMore } = useStore();
  const [hidden, hide] = useDismiss(`focus-offer-${today}`);
  const soon = exams.filter((e) => e.date >= today && daysBetween(today, e.date) <= 14).slice(0, 3);
  if (!soon.length) return null;
  const nearest = daysBetween(today, soon[0].date);
  const focusOn = !!settings.focusUntil && settings.focusUntil >= today;
  const name = (e: (typeof exams)[number]) => courses.find((c) => c.id === e.courseId)?.name ?? e.title ?? 'Sınav';

  return (
    <div className="space-y-2 -mt-2">
      {soon.map((e) => {
        const d = daysBetween(today, e.date);
        return (
          <button key={e.id} onClick={() => openMore('courses')} className="w-full flex items-center gap-2.5 text-left text-sm min-h-0 py-1">
            <GraduationCap size={15} className="text-[var(--cat-mind)] shrink-0" />
            <span className="flex-1 truncate"><b>{name(e)}</b> {EXAM_LABEL[e.kind] ?? ''}</span>
            <span className="text-text-muted num shrink-0">{d === 0 ? 'bugün' : d === 1 ? 'yarın' : `${d} gün`}</span>
          </button>
        );
      })}
      {!focusOn && !hidden && nearest <= 7 && (
        <div className="card p-3.5 flex items-center gap-3">
          <Target size={18} className="text-accent shrink-0" />
          <p className="text-sm flex-1">Sınava {nearest === 0 ? 'bugün' : `${nearest} gün`} var. Odak modunu açmak ister misin?</p>
          <button onClick={() => run(() => saveSettings({ focusUntil: soon[soon.length - 1].date }), 'Odak modu açıldı')} className="btn btn-soft-accent btn-sm shrink-0">Aç</button>
          <button onClick={hide} className="icon-btn text-text-muted shrink-0" aria-label="Şimdi değil"><X size={16} /></button>
        </div>
      )}
    </div>
  );
}

/** Gün içinde bir kez kapatılabilen kartlar için */
function useDismiss(key: string): [boolean, () => void] {
  const full = `melife-dismiss-${key}`;
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(full) === '1'; } catch { return false; } });
  return [hidden, () => { setHidden(true); try { localStorage.setItem(full, '1'); } catch { /* yok say */ } }];
}

/* ── Gün notu ─────────────────────────────────────────── */

function JournalToday({ date, legacyNote }: { date: string; legacyNote?: string }) {
  const entries = useStore((s) => s.journal).filter((e) => e.date === date);
  const journal = useStore((s) => s.journal);
  const today = useStore((s) => s.today());
  const setTab = useStore((s) => s.setTab);
  const [writing, setWriting] = useState(false);
  const [open, setOpen] = useState<JournalEntry | null>(null);
  const memories = date === today ? memoriesFor(journal, today) : [];

  return (
    <>
      <section className="widget">
        <div className="widget-header">
          <h3><BookHeart size={18} className="text-text-muted" /> Günlük</h3>
          {entries.length > 0 && <button className="widget-link" onClick={() => setTab('notes')}>Defter <ChevronRight size={13} className="inline -mt-0.5" /></button>}
        </div>
        <div className="widget-body pt-0 space-y-3">
          {legacyNote && <p className="journal-text text-[15px] text-text-muted">{legacyNote}</p>}
          {entries.map((e) => (
            <button key={e.id} onClick={() => setOpen(e)} className="block w-full text-left min-h-0">
              <span className="text-[11px] text-text-muted num">{e.time}</span>
              {e.title && <span className="block font-semibold">{e.title}</span>}
              <span className="journal-text text-[15px] line-clamp-3">{e.text}</span>
            </button>
          ))}
          <button onClick={() => setWriting(true)} className="w-full text-left rounded-2xl bg-surface-el px-4 py-3 min-h-0 hover:bg-surface-hover transition-colors">
            <span className="font-display text-[16px] leading-snug block">{promptFor(date)}</span>
            <span className="text-xs text-text-muted">{entries.length ? 'Bir şey daha yaz…' : 'Bir satır bile yeter'}</span>
          </button>
        </div>
      </section>
      {memories.length > 0 && <MemoriesCard memories={memories} onOpen={setOpen} />}

      <Modal isOpen={writing} onClose={() => setWriting(false)} title="Günlük">
        {writing && <JournalEditor date={date} autoFocus onDone={() => setWriting(false)} />}
      </Modal>
      <Modal isOpen={!!open} onClose={() => setOpen(null)} title={open ? longDate(open.date) : ''}>
        {open && <JournalEditor key={open.id} entry={journal.find((x) => x.id === open.id) ?? open} onDone={() => setOpen(null)} />}
      </Modal>
    </>
  );
}
