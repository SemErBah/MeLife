import { AnimatePresence, motion } from 'framer-motion';
import { Check, Footprints, Minimize2, Square, X } from 'lucide-react';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { CATEGORIES } from '../constants';
import { TrackerIcon } from './TrackerIcon';
import { useStore } from '../store/useStore';
import { useTimer } from '../store/useTimer';
import { confirmAction, run, toast } from '../store/useUI';
import { fmtClock } from '../utils/date';
import { Ring } from './ui';
import { currentNoise, onNoiseChange, playNoise, type Noise } from '../utils/noise';

function useElapsed(startedAt: number | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  return startedAt ? Math.max(0, (now - startedAt) / 1000) : 0;
}

/** Tam ekran odak sayacı. İlk hedef küçük: "sadece başla, sonra istersen bırak". */
export default function TimerOverlay() {
  const { running, open, setOpen, stop, setCourse } = useTimer();
  const tracker = useStore((s) => s.trackers.find((t) => t.id === running?.trackerId));
  const task = useStore((s) => s.tasks.find((t) => t.id === running?.taskId));
  const courses = useStore((s) => s.courses).filter((c) => c.status === 'taking' || c.status === 'planned');
  const toggleTask = useStore((s) => s.toggleTask);
  const elapsed = useElapsed(running?.startedAt);
  // Sayaç bitince ses de susar
  useEffect(() => { if (!running) playNoise(null); }, [running]);

  if (!running) return null;

  const isTask = !!running.taskId;
  const label = tracker?.name ?? task?.text ?? running.label ?? 'Sayaç';
  const color = tracker ? CATEGORIES[tracker.category].color : 'var(--accent-base)';
  const warmupMin = tracker?.doneAt ?? running.warmupMin ?? 10;
  const first = warmupMin * 60;
  const goal = (tracker?.target ?? 60) * 60;
  const inWarmup = elapsed < first;
  const pct = inWarmup ? elapsed / first : isTask ? 1 : Math.min(1, elapsed / goal);
  const showCourses = (running.study || (!!tracker && (tracker.key === 'study' || tracker.category === 'mind'))) && courses.length > 0;

  const cancel = async () => {
    if (elapsed < 60 || await confirmAction({ title: 'Sayaç kapatılsın mı?', message: isTask ? 'Sorun değil, başlamak bile bir adımdı.' : 'Bu süre kaydedilmeyecek.', confirmLabel: 'Kapat', danger: !isTask })) {
      stop(false);
    }
  };

  const taskDone = async () => {
    await stop(true);
    if (task && !task.done) await run(() => toggleTask(task.id));
    toast('Bitti. Gördün mü, başladın. 🎉');
  };
  const taskLeave = async () => {
    const m = await stop(true);
    toast(m >= 1 ? `${m} dk çalıştın. Burada bırakmak da olur.` : 'Başlamak bile bir adımdı.', 'info');
  };

  return (
    <>
      {/* Küçültülmüş hali: alt menünün üstünde hap */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed z-[60] left-1/2 -translate-x-1/2 lg:left-auto lg:right-8 lg:translate-x-0 flex items-center gap-2.5 pl-3 pr-4 py-2 rounded-full font-semibold text-sm max-w-[80vw]"
          style={{ bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))', background: 'var(--modal-bg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-elevated)', color }}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-current animate-pulse shrink-0" />
          <span className="text-text-main truncate">{label}</span>
          <span className="num">{fmtClock(elapsed)}</span>
        </button>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] flex flex-col items-center justify-between bg-base px-6"
            style={{ paddingTop: 'calc(24px + env(safe-area-inset-top))', paddingBottom: 'calc(32px + env(safe-area-inset-bottom))' }}
            role="dialog" aria-modal="true" aria-label="Odak sayacı"
          >
            <div className="w-full max-w-md flex items-center justify-between">
              <button onClick={cancel} className="icon-btn text-text-muted hover:bg-surface-hover" aria-label="Kapat"><X size={20} /></button>
              <span className="eyebrow">{isTask ? 'Küçük adım' : 'Odak'}</span>
              <button onClick={() => setOpen(false)} className="icon-btn text-text-muted hover:bg-surface-hover" aria-label="Küçült"><Minimize2 size={18} /></button>
            </div>

            <div className="flex flex-col items-center gap-7 w-full max-w-md" style={{ '--c': color } as React.CSSProperties}>
              <div className="flex items-center gap-3 max-w-full">
                <span className="cat-bubble shrink-0">{tracker ? <TrackerIcon name={tracker.icon} /> : <Footprints size={20} />}</span>
                <p className="text-xl font-bold truncate">{label}</p>
              </div>
              {isTask && running.label && running.label !== task?.text && (
                <p className="text-sm text-text-muted -mt-4 text-center">İlk adım: <b className="text-text-main">{running.label}</b></p>
              )}

              {showCourses && (
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {courses.map((c) => (
                    <button key={c.id} onClick={() => setCourse(running.courseId === c.id ? undefined : c.id)} className={`pill ${running.courseId === c.id ? 'active' : ''}`}>{c.name}</button>
                  ))}
                </div>
              )}

              <Ring pct={pct} size={240} stroke={14} color={color}>
                <div className="text-center">
                  <p className="text-6xl font-extrabold num tracking-tight">{fmtClock(elapsed)}</p>
                  <p className="text-xs text-text-muted mt-2 font-semibold">
                    {inWarmup ? `ilk ${warmupMin} dakika` : isTask ? 'devam ediyorsun' : `hedef ${Math.round(goal / 60)} dk`}
                  </p>
                </div>
              </Ring>

              <FocusSound />

              <p className="text-center text-text-muted max-w-xs leading-relaxed">
                {inWarmup
                  ? `Sadece ${warmupMin} dakika. Sonra istersen bırakabilirsin.`
                  : isTask ? `${warmupMin} dakika tamam ✓ Devam edebilir ya da burada bırakabilirsin.`
                  : elapsed < goal ? `${warmupMin} dakika tamam ✓ Bugün sayıldı. Devam edebilirsin.` : 'Hedef süre tamam! Harika iş. 🎉'}
              </p>
            </div>

            {isTask ? (
              <div className="w-full max-w-md grid grid-cols-2 gap-3">
                <button onClick={taskLeave} className="btn btn-ghost py-4">Burada bırak</button>
                <button onClick={taskDone} className="btn btn-primary py-4"><Check size={18} /> Bitti</button>
              </div>
            ) : (
              <button onClick={() => stop(true)} className="btn btn-primary w-full max-w-md py-4 text-base">
                <Square size={16} fill="currentColor" /> Bitir ve kaydet
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

const SOUNDS: { id: Noise | null; label: string }[] = [
  { id: null, label: 'Sessiz' }, { id: 'brown', label: 'Kahverengi' }, { id: 'white', label: 'Beyaz' }, { id: 'cafe', label: 'Kafe' },
];

/** Odak sesi seçimi (kulaklıkla daha iyi) */
function FocusSound() {
  const noise = useSyncExternalStore(onNoiseChange, currentNoise);
  return (
    <div className="flex flex-wrap gap-1.5 justify-center -mt-2" role="group" aria-label="Odak sesi">
      {SOUNDS.map((s) => (
        <button key={s.label} onClick={() => playNoise(s.id)} className={`pill text-xs ${noise === s.id ? 'active' : ''}`} style={{ minHeight: 30 }}>{s.id === null ? '🔇' : '🎧'} {s.label}</button>
      ))}
    </div>
  );
}
