import { create } from 'zustand';
import { onAuthStateChanged, signOut as fbSignOut } from 'firebase/auth';
import { auth, db, firebaseEnabled } from '../firebase';
import { firestoreBackend, getLocalBackend, clearLocalData, type Backend, type Unsub } from '../services/backend';
import { fromTemplate, type Template } from '../services/seed';
import { pendingInstances } from '../utils/recurring';
import { useFinance } from '../finance/store/useFinance';
import { logicalToday, sleepMinutes } from '../utils/date';
import type { AppUser, Course, DayLog, Dream, Exam, InboxItem, InboxStatus, JournalEntry, LibraryItem, Moment, Person, Settings, StudySession, TabId, Task, TaskRule, Theme, Tracker, WeekLog, YearGoal } from '../types';

export type MoreView = 'routines' | 'people' | 'dreams' | 'timeline' | 'library' | 'courses' | 'calendar' | 'stats' | 'reminders' | 'settings';
export type ItemCol = 'taskRules' | 'courses' | 'exams' | 'sessions' | 'library' | 'journal' | 'people' | 'dreams' | 'yearGoals' | 'moments';

/* ── Tema ─────────────────────────────────────────────── */

const THEME_KEY = 'melife-theme';

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#121211' : '#f5f2ec');
  try { localStorage.setItem(THEME_KEY, theme); } catch { /* gizli sekme */ }
}

function storedTheme(): Theme {
  try { return (localStorage.getItem(THEME_KEY) as Theme) || 'dark'; } catch { return 'dark'; }
}
applyTheme(storedTheme());

/* ── Durum ────────────────────────────────────────────── */

export const defaultSettings = (): Settings => {
  const today = logicalToday();
  return {
    onboarded: false, dayStartHour: 4, theme: storedTheme(), startDate: today, showStreak: false,
  };
};

interface AppState {
  authReady: boolean;
  dataReady: boolean;
  user: AppUser | null;
  activeTab: TabId;
  moreView: MoreView | null;
  /** Takvimden "Bu güne git": Bugün ekranı bu tarihi açar */
  jumpDate: string | null;
  now: Date;

  settings: Settings;
  trackers: Tracker[];
  days: Record<string, DayLog>;
  weeks: Record<string, WeekLog>;
  rules: TaskRule[];
  courses: Course[];
  exams: Exam[];
  sessions: StudySession[];
  library: LibraryItem[];
  journal: JournalEntry[];
  people: Person[];
  dreams: Dream[];
  yearGoals: YearGoal[];
  moments: Moment[];
  tasks: Task[];
  inbox: InboxItem[];

  init: () => Unsub;
  signOut: () => Promise<void>;
  setTab: (tab: TabId) => void;
  openMore: (view: MoreView | null) => void;
  goToDate: (date: string | null) => void;
  tick: () => void;
  today: () => string;

  // Ayarlar & kurulum
  saveSettings: (patch: Partial<Settings>) => Promise<void>;
  setTheme: (theme: Theme) => Promise<void>;
  addTemplates: (tpls: Template[]) => Promise<void>;
  finishOnboarding: () => Promise<void>;
  resetLocal: () => void;

  // Tracker
  saveTracker: (t: Tracker) => Promise<void>;
  removeTracker: (id: string) => Promise<void>;
  reorderTrackers: (ids: string[]) => Promise<void>;

  // Gün kayıtları
  setEntry: (trackerId: string, value: number, date?: string) => Promise<void>;
  bumpEntry: (trackerId: string, delta: number, date?: string) => Promise<void>;
  setTrackerNote: (trackerId: string, text: string, date?: string) => Promise<void>;
  setSleep: (trackerId: string, bed: string, wake: string, date?: string) => Promise<void>;
  setDayNote: (text: string, date?: string) => Promise<void>;
  closeDay: (date: string) => Promise<void>;
  saveWeek: (weekOf: string, patch: Partial<Omit<WeekLog, 'id'>>) => Promise<void>;

  // Azaltılan alışkanlık (sigara vb.)
  logReduce: (trackerId: string, tag?: string) => Promise<void>;
  undoReduce: (trackerId: string, date?: string) => Promise<void>;
  tagReduce: (trackerId: string, tag: string, date?: string) => Promise<void>;
  logUrge: (trackerId: string) => Promise<void>;

  // Görevler
  /** forDate/time/… boş string ("") = alan temizlendi */
  addTask: (data: Partial<Omit<Task, 'id'>> & { text: string }) => Promise<void>;
  updateTask: (id: string, patch: Partial<Omit<Task, 'id'>>) => Promise<void>;
  toggleTask: (id: string) => Promise<void>;
  removeTask: (id: string) => Promise<void>;

  // Aklımdakiler
  addInbox: (text: string) => Promise<void>;
  setInboxStatus: (id: string, status: InboxStatus) => Promise<void>;
  removeInbox: (id: string) => Promise<void>;

  // Genel kayıt (tekrarlayan görev kuralları, ders, sınav, oturum, kütüphane)
  saveItem: <T extends { id: string }>(col: ItemCol, data: Omit<T, 'id'> | Partial<T>, id?: string) => Promise<string>;
  removeItem: (col: ItemCol, id: string) => Promise<void>;
  /** Silineni geri koy (aynı kimlikle) */
  restoreItem: (col: string, id: string, data: Record<string, unknown>) => Promise<void>;
  /** Tekrarlayan görevlerin önümüzdeki 7 gününü üret (çoğaltmaz) */
  ensureRecurring: () => Promise<void>;
}

let backend: Backend | null = null;
let dataSubs: Unsub[] = [];

const need = () => {
  if (!backend) throw new Error('Veri katmanı hazır değil');
  return backend;
};

export const useStore = create<AppState>((set, get) => {
  /** Bir günün belgesine birleştirerek yaz */
  const writeDay = (date: string, patch: Record<string, unknown>) =>
    need().set('days', date, { date, updatedAt: Date.now(), ...patch });

  /** v1 → v2: aşama sistemi kalktı. Henüz açılmamış aşamaların rutinleri birden belirmesin diye duraklatılır. */
  async function migrateV2(rawPhase: number | undefined) {
    const { settings, trackers } = get();
    if (!settings.onboarded || settings.migratedV2) return;
    const phase = rawPhase ?? 1;
    const toPause = trackers.filter((t) => (t.phase ?? 0) > phase || t.key === 'plan3');
    if (toPause.length) await need().setMany(toPause.map((t) => ({ col: 'trackers', id: t.id, data: { paused: true } })));
    await get().saveSettings({ migratedV2: true });
  }

  function attach(user: AppUser, b: Backend) {
    dataSubs.forEach((u) => u());
    backend = b;
    let pending = 16;
    let rawPhase: number | undefined;
    const ready = () => {
      if (--pending === 0) {
        set({ dataReady: true });
        migrateV2(rawPhase).catch((e) => console.error('migrateV2', e));
      }
    };
    const once = <T,>(fn: (v: T) => void) => { let first = true; return (v: T) => { fn(v); if (first) { first = false; ready(); } }; };

    set({ user, dataReady: false });
    dataSubs = [
      b.watchDoc<Settings & { phase?: number }>('settings', 'main', once((s) => {
        rawPhase = s?.phase;
        const merged = { ...defaultSettings(), ...(s || {}) };
        if (s?.theme && s.theme !== storedTheme()) applyTheme(s.theme);
        set({ settings: merged });
      })),
      b.watchCol<Tracker>('trackers', once((items) => set({ trackers: items.sort((a, c) => a.order - c.order) }))),
      b.watchCol<DayLog>('days', once((items) => set({ days: Object.fromEntries(items.map((d) => [d.id, d])) }))),
      b.watchCol<Task>('tasks', once((items) => set({ tasks: items.sort((a, c) => a.order - c.order || a.createdAt - c.createdAt) }))),
      b.watchCol<WeekLog>('weeks', once((items) => set({ weeks: Object.fromEntries(items.map((w) => [w.id, w])) }))),
      b.watchCol<TaskRule>('taskRules', once((rules) => set({ rules }))),
      b.watchCol<Course>('courses', once((items) => set({ courses: items.sort((a, c) => (a.semester || 9) - (c.semester || 9) || a.order - c.order) }))),
      b.watchCol<Exam>('exams', once((items) => set({ exams: items.sort((a, c) => a.date.localeCompare(c.date) || (a.time ?? '').localeCompare(c.time ?? '')) }))),
      b.watchCol<StudySession>('sessions', once((sessions) => set({ sessions }))),
      b.watchCol<LibraryItem>('library', once((items) => set({ library: items.sort((a, c) => (c.updatedAt ?? c.createdAt) - (a.updatedAt ?? a.createdAt)) }))),
      b.watchCol<JournalEntry>('journal', once((items) => set({ journal: items.sort((a, c) => c.date.localeCompare(a.date) || (c.time ?? '').localeCompare(a.time ?? '') || c.createdAt - a.createdAt) }))),
      b.watchCol<Person>('people', once((items) => set({ people: items.sort((a, c) => a.name.localeCompare(c.name, 'tr')) }))),
      b.watchCol<Dream>('dreams', once((dreams) => set({ dreams: dreams.sort((a, c) => a.createdAt - c.createdAt) }))),
      b.watchCol<YearGoal>('yearGoals', once((yearGoals) => set({ yearGoals: yearGoals.sort((a, c) => a.createdAt - c.createdAt) }))),
      b.watchCol<Moment>('moments', once((moments) => set({ moments }))),
      b.watchCol<InboxItem>('inbox', once((items) => set({ inbox: items.sort((a, c) => c.createdAt - a.createdAt) }))),
    ];
  }

  function detach() {
    dataSubs.forEach((u) => u());
    dataSubs = [];
    backend = null;
    set({ user: null, dataReady: false, trackers: [], days: {}, weeks: {}, rules: [], courses: [], exams: [], sessions: [], library: [], journal: [], people: [], dreams: [], yearGoals: [], moments: [], tasks: [], inbox: [], settings: defaultSettings() });
  }

  return {
    authReady: false,
    dataReady: false,
    user: null,
    activeTab: 'today',
    moreView: null,
    jumpDate: null,
    now: new Date(),

    settings: defaultSettings(),
    trackers: [],
    days: {},
    weeks: {},
    rules: [],
    courses: [],
    exams: [],
    sessions: [],
    library: [],
    journal: [],
    people: [],
    dreams: [],
    yearGoals: [],
    moments: [],
    tasks: [],
    inbox: [],

    init: () => {
      if (!firebaseEnabled || !auth || !db) {
        attach({ uid: 'local', name: '', email: '', local: true }, getLocalBackend());
        const disconnectFinance = useFinance.getState().connect();
        set({ authReady: true });
        return () => { disconnectFinance(); detach(); };
      }
      const firestore = db;
      let disconnectFinance: (() => void) | null = null;
      const unsub = onAuthStateChanged(auth, (u) => {
        disconnectFinance?.();
        disconnectFinance = null;
        if (u) {
          attach({ uid: u.uid, name: u.displayName || '', email: u.email || '', photo: u.photoURL || undefined }, firestoreBackend(firestore, u.uid));
          // Para verileri (MeDebit) de girişte yüklenir; düzenli ödemeler açılışta işlenir
          disconnectFinance = useFinance.getState().connect();
        } else {
          detach();
        }
        set({ authReady: true });
      });
      return () => { unsub(); disconnectFinance?.(); detach(); };
    },

    signOut: async () => { if (auth) await fbSignOut(auth); },

    setTab: (tab) => set({ activeTab: tab }),
    openMore: (view) => set({ activeTab: 'more', moreView: view }),
    goToDate: (date) => set(date ? { jumpDate: date, activeTab: 'today' } : { jumpDate: null }),
    tick: () => set({ now: new Date() }),
    today: () => logicalToday(get().now, get().settings.dayStartHour),

    /* ── Ayarlar ── */
    saveSettings: async (patch) => {
      const next = { ...get().settings, ...patch };
      set({ settings: next });
      await need().set('settings', 'main', patch as Record<string, unknown>);
    },

    setTheme: async (theme) => {
      applyTheme(theme);
      await get().saveSettings({ theme });
    },

    addTemplates: async (tpls) => {
      const ids = new Set(get().trackers.map((t) => t.id));
      const offset = get().trackers.length;
      const today = get().today();
      const items = tpls.map((tpl, i) => {
        const t = fromTemplate(tpl, ids, offset + i);
        if (t.reduce && !t.reduce.startDate) t.reduce = { ...t.reduce, startDate: today };
        ids.add(t.id);
        const { id, ...data } = t;
        return { col: 'trackers', id, data: data as unknown as Record<string, unknown> };
      });
      if (items.length) await need().setMany(items);
    },

    finishOnboarding: async () => {
      await get().saveSettings({ onboarded: true, migratedV2: true, startDate: get().today() });
    },

    resetLocal: () => {
      clearLocalData();
      location.reload();
    },

    /* ── Tracker ── */
    saveTracker: async (t) => {
      const { id, ...data } = t;
      await need().set('trackers', id, data as unknown as Record<string, unknown>, false);
    },
    removeTracker: (id) => need().remove('trackers', id),
    reorderTrackers: (ids) => need().setMany(ids.map((id, order) => ({ col: 'trackers', id, data: { order } }))),

    /* ── Gün kayıtları ── */
    setEntry: (trackerId, value, date) =>
      writeDay(date ?? get().today(), { entries: { [trackerId]: Math.max(0, value) } }),

    bumpEntry: (trackerId, delta, date) => {
      const d = date ?? get().today();
      const cur = get().days[d]?.entries?.[trackerId] ?? 0;
      return writeDay(d, { entries: { [trackerId]: Math.max(0, cur + delta) } });
    },

    setTrackerNote: (trackerId, text, date) =>
      writeDay(date ?? get().today(), { notes: { [trackerId]: text } }),

    setSleep: (trackerId, bed, wake, date) =>
      writeDay(date ?? get().today(), { sleep: { bed, wake }, entries: { [trackerId]: sleepMinutes(bed, wake) } }),

    setDayNote: (text, date) => writeDay(date ?? get().today(), { note: text }),
    closeDay: (date) => writeDay(date, { closedAt: Date.now() }),
    saveWeek: (weekOf, patch) => need().set('weeks', weekOf, { ...patch, updatedAt: Date.now() } as Record<string, unknown>),

    /* ── Azaltılan alışkanlık ── */
    logReduce: (trackerId, tag) => {
      const d = get().today();
      const day = get().days[d];
      const patch: Record<string, unknown> = {
        entries: { [trackerId]: (day?.entries?.[trackerId] ?? 0) + 1 },
        times: { [trackerId]: [...(day?.times?.[trackerId] ?? []), Date.now()] },
      };
      if (tag) patch.tags = { [trackerId]: { [tag]: (day?.tags?.[trackerId]?.[tag] ?? 0) + 1 } };
      return writeDay(d, patch);
    },
    undoReduce: (trackerId, date) => {
      const d = date ?? get().today();
      const day = get().days[d];
      const count = day?.entries?.[trackerId] ?? 0;
      if (count <= 0) return Promise.resolve();
      return writeDay(d, {
        entries: { [trackerId]: count - 1 },
        times: { [trackerId]: (day?.times?.[trackerId] ?? []).slice(0, -1) },
      });
    },
    tagReduce: (trackerId, tag, date) => {
      const d = date ?? get().today();
      const cur = get().days[d]?.tags?.[trackerId]?.[tag] ?? 0;
      return writeDay(d, { tags: { [trackerId]: { [tag]: cur + 1 } } });
    },
    logUrge: (trackerId) => {
      const d = get().today();
      return writeDay(d, { urges: { [trackerId]: (get().days[d]?.urges?.[trackerId] ?? 0) + 1 } });
    },

    /* ── Görevler ── */
    addTask: async (data) => {
      const order = get().tasks.filter((t) => (t.forDate || '') === (data.forDate || '')).length;
      await need().add('tasks', { done: false, star: false, order, createdAt: Date.now(), ...data });
    },
    updateTask: (id, patch) => need().set('tasks', id, patch as Record<string, unknown>),
    toggleTask: async (id) => {
      const t = get().tasks.find((x) => x.id === id);
      if (t) await need().set('tasks', id, { done: !t.done });
    },
    removeTask: (id) => need().remove('tasks', id),

    /* ── Aklımdakiler ── */
    addInbox: async (text) => { await need().add('inbox', { text, status: 'open', createdAt: Date.now() }); },
    setInboxStatus: (id, status) => need().set('inbox', id, { status }),
    removeInbox: (id) => need().remove('inbox', id),

    saveItem: async (col, data, id) => {
      if (id) { await need().set(col, id, data as Record<string, unknown>); return id; }
      return need().add(col, data as Record<string, unknown>);
    },
    removeItem: (col, id) => need().remove(col, id),
    ensureRecurring: async () => {
      const { rules, tasks } = get();
      const pending = pendingInstances(rules, tasks, get().today());
      if (pending.length) await need().setMany(pending.map((p) => ({ col: 'tasks', id: p.id, data: p.data as unknown as Record<string, unknown> })));
    },
    restoreItem: (col, id, data) => {
      const { id: _drop, ...rest } = data;
      return need().set(col, id, rest, false);
    },
  };
});
