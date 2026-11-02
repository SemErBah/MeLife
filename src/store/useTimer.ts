import { create } from 'zustand';
import { useStore } from './useStore';
import { run, toast } from './useUI';

/* Tek sayaç: rutin (ders bloğu, spor…), ders oturumu ya da "Başlayamıyorum" görev sayacı.
   Sayfa yenilense de kaybolmasın diye localStorage'da tutulur. */

const KEY = 'melife-timer';

export interface RunningTimer {
  trackerId?: string;   // süre rutinine yazılır
  taskId?: string;      // "Başlayamıyorum": görev için küçük adım sayacı
  courseId?: string;    // hangi ders (isteğe bağlı)
  label?: string;
  study?: boolean;      // ders çalışma (rutin olmasa da oturum kaydı)
  warmupMin?: number;   // ilk hedef (rutinde doneAt, görevde 5 dk)
  date: string;         // sayacın başladığı mantıksal gün
  startedAt: number;
}

interface TimerState {
  running: RunningTimer | null;
  open: boolean;
  start: (trackerId: string) => void;
  startTask: (taskId: string, label: string, warmupMin?: number) => void;
  /** Ders çalışmaya başla: "Ders çalış" rutini varsa ona yazar, yoksa yalnızca oturum kaydeder */
  startStudy: (courseId?: string) => void;
  setCourse: (courseId: string | undefined) => void;
  /** Kaydeder ve dakika döner (kısa sürdüyse 0) */
  stop: (save: boolean) => Promise<number>;
  setOpen: (open: boolean) => void;
}

function load(): RunningTimer | null {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; }
}
function persist(t: RunningTimer | null) {
  try {
    if (t) localStorage.setItem(KEY, JSON.stringify(t));
    else localStorage.removeItem(KEY);
  } catch { /* yok say */ }
}

export const useTimer = create<TimerState>((set, get) => ({
  running: load(),
  open: false,

  start: (trackerId) => {
    const running: RunningTimer = { trackerId, date: useStore.getState().today(), startedAt: Date.now() };
    persist(running);
    set({ running, open: true });
  },

  startTask: (taskId, label, warmupMin = 5) => {
    const running: RunningTimer = { taskId, label, warmupMin, date: useStore.getState().today(), startedAt: Date.now() };
    persist(running);
    set({ running, open: true });
  },

  startStudy: (courseId) => {
    const s = useStore.getState();
    const tracker = s.trackers.find((t) => t.key === 'study' && !t.paused);
    const running: RunningTimer = {
      ...(tracker ? { trackerId: tracker.id } : { label: 'Ders çalışma', warmupMin: 10 }),
      ...(courseId ? { courseId } : {}),
      study: true, date: s.today(), startedAt: Date.now(),
    };
    persist(running);
    set({ running, open: true });
  },

  setCourse: (courseId) => {
    const r = get().running;
    if (!r) return;
    const running = { ...r, courseId };
    persist(running);
    set({ running });
  },

  stop: async (save) => {
    const r = get().running;
    persist(null);
    set({ running: null, open: false });
    if (!r || !save) return 0;
    const minutes = Math.round((Date.now() - r.startedAt) / 60_000);
    if (minutes < 1) {
      if (r.trackerId || r.study) toast('1 dakikadan kısa sürdüğü için kaydedilmedi', 'info');
      return 0;
    }
    const s = useStore.getState();
    if (r.trackerId) {
      const tracker = s.trackers.find((t) => t.id === r.trackerId);
      await run(async () => {
        await s.bumpEntry(r.trackerId!, minutes, r.date);
        // Ders çalışması: ders bazında süre için oturum kaydı
        if (r.courseId || tracker?.key === 'study') {
          await s.saveItem('sessions', { trackerId: r.trackerId, minutes, date: r.date, createdAt: Date.now(), ...(r.courseId ? { courseId: r.courseId } : {}) });
        }
      }, `${minutes} dk kaydedildi`);
    } else if (r.study) {
      await run(() => s.saveItem('sessions', { minutes, date: r.date, createdAt: Date.now(), ...(r.courseId ? { courseId: r.courseId } : {}) }), `${minutes} dk ders çalışması kaydedildi`);
    }
    return minutes;
  },

  setOpen: (open) => set({ open }),
}));
