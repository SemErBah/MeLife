import {
  collection, doc, onSnapshot, setDoc, addDoc, deleteDoc, writeBatch, type Firestore,
} from 'firebase/firestore';

/* Veri katmanı: aynı arayüzün iki uygulaması var.
   - firestoreBackend: users/{uid}/{koleksiyon}/{belge}
   - localBackend:     localStorage (Firebase config yokken "Yerel mod")
   set(..., merge=true) iç içe nesneleri birleştirir (ör. { entries: { su: 500 } }). */

export type Unsub = () => void;
type Data = Record<string, unknown>;

export interface Backend {
  watchCol<T>(col: string, cb: (items: T[]) => void): Unsub;
  watchDoc<T>(col: string, id: string, cb: (item: T | null) => void): Unsub;
  set(col: string, id: string, data: Data, merge?: boolean): Promise<void>;
  add(col: string, data: Data): Promise<string>;
  remove(col: string, id: string): Promise<void>;
  setMany(items: { col: string; id: string; data: Data }[]): Promise<void>;
}

/* ── Firestore ────────────────────────────────────────── */

export function firestoreBackend(db: Firestore, uid: string): Backend {
  const col = (name: string) => collection(db, 'users', uid, name);
  const ref = (name: string, id: string) => doc(db, 'users', uid, name, id);

  return {
    watchCol: (name, cb) =>
      onSnapshot(col(name), (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as never)),
        (err) => console.error(`watch ${name}`, err)),
    watchDoc: (name, id, cb) =>
      onSnapshot(ref(name, id), (snap) => cb(snap.exists() ? ({ id: snap.id, ...snap.data() } as never) : null),
        (err) => console.error(`watch ${name}/${id}`, err)),
    set: (name, id, data, merge = true) => setDoc(ref(name, id), data, { merge }),
    add: async (name, data) => (await addDoc(col(name), data)).id,
    remove: (name, id) => deleteDoc(ref(name, id)),
    setMany: async (items) => {
      // Firestore batch limiti 500
      for (let i = 0; i < items.length; i += 450) {
        const batch = writeBatch(db);
        items.slice(i, i + 450).forEach((it) => batch.set(ref(it.col, it.id), it.data, { merge: true }));
        await batch.commit();
      }
    },
  };
}

/* ── localStorage ─────────────────────────────────────── */

const LOCAL_KEY = 'melife-local-v1';
type Store = Record<string, Record<string, Data>>;

const isObj = (v: unknown): v is Data => typeof v === 'object' && v !== null && !Array.isArray(v);

function deepMerge(a: Data, b: Data): Data {
  const out: Data = { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (v === undefined) continue;
    out[k] = isObj(v) && isObj(out[k]) ? deepMerge(out[k] as Data, v) : v;
  }
  return out;
}

export function localBackend(): Backend & { peek: (col: string, id: string) => Record<string, unknown> | null } {
  let store: Store = {};
  try { store = JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}'); } catch { store = {}; }

  const colListeners = new Map<string, Set<(items: unknown[]) => void>>();
  const docListeners = new Map<string, Set<(item: unknown) => void>>();

  const list = (name: string) => Object.entries(store[name] || {}).map(([id, d]) => ({ id, ...d }));
  const one = (name: string, id: string) => (store[name]?.[id] ? { id, ...store[name][id] } : null);

  function commit(touched: { col: string; id: string }[]) {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(store)); } catch (e) { console.error(e); }
    const cols = new Set(touched.map((t) => t.col));
    cols.forEach((c) => colListeners.get(c)?.forEach((cb) => cb(list(c))));
    touched.forEach((t) => docListeners.get(`${t.col}/${t.id}`)?.forEach((cb) => cb(one(t.col, t.id))));
  }

  function write(name: string, id: string, data: Data, merge: boolean) {
    store[name] ||= {};
    const clean = JSON.parse(JSON.stringify(data)) as Data; // undefined alanları at
    store[name][id] = merge && store[name][id] ? deepMerge(store[name][id], clean) : clean;
  }

  const sub = <T,>(map: Map<string, Set<T>>, key: string, cb: T): Unsub => {
    if (!map.has(key)) map.set(key, new Set());
    map.get(key)!.add(cb);
    return () => { map.get(key)?.delete(cb); };
  };

  return {
    peek: (name, id) => one(name, id),
    watchCol: (name, cb) => {
      const u = sub(colListeners, name, cb as (items: unknown[]) => void);
      queueMicrotask(() => cb(list(name) as never));
      return u;
    },
    watchDoc: (name, id, cb) => {
      const u = sub(docListeners, `${name}/${id}`, cb as (item: unknown) => void);
      queueMicrotask(() => cb(one(name, id) as never));
      return u;
    },
    set: async (name, id, data, merge = true) => { write(name, id, data, merge); commit([{ col: name, id }]); },
    add: async (name, data) => {
      const id = Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
      write(name, id, data, false);
      commit([{ col: name, id }]);
      return id;
    },
    remove: async (name, id) => { delete store[name]?.[id]; commit([{ col: name, id }]); },
    setMany: async (items) => { items.forEach((it) => write(it.col, it.id, it.data, true)); commit(items); },
  };
}

/** Yerel mod tek bir örnek kullanır: MeLife verisi ve Para verisi aynı localStorage anahtarını paylaşır. */
let localSingleton: (Backend & { peek: (col: string, id: string) => Record<string, unknown> | null }) | null = null;
export function getLocalBackend() {
  if (!localSingleton) localSingleton = localBackend();
  return localSingleton;
}

export function clearLocalData() {
  try { localStorage.removeItem(LOCAL_KEY); } catch { /* yok say */ }
}
