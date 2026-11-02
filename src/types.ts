/* ── Rutinler (takip motoru) ──────────────────────────── */

/**
 * check    → tik (1/0)
 * counter  → artan sayı (su ml, sayfa)
 * duration → dakika (sayaç ya da elle)
 * sleep    → yatış/kalkış saati, değer = uyunan dakika
 * scale    → 1–5 ölçek (ruh hali, enerji)
 * number   → serbest sayı (kilo, ekran süresi)
 */
export type TrackerType = 'check' | 'counter' | 'duration' | 'sleep' | 'scale' | 'number';

export type Category = 'health' | 'mind' | 'order' | 'social' | 'work' | 'mood';

/** Bazı rutinlerin uygulamada özel davranışı var */
export type TrackerKey = 'study' | 'plan3' | 'sleep' | 'water' | 'sundayPlan' | 'money';

/** "Dişlerini fırçaladın mı?" — soru sorar, dayatmaz */
export interface Reminder {
  time: string;          // "07:00"
  days?: number[];       // boş = rutinin günleri
  message?: string;      // boşsa nazik varsayılan soru
  on: boolean;
}

/** Azaltmak istenen alışkanlık (ör. sigara): kademeli sınır, suçlama yok */
export interface ReducePlan {
  start: number;          // başlangıçta günde kaç (ör. 20)
  stepPerWeek: number;    // her hafta sınır kaç azalsın (0 = sabit)
  floor: number;          // nereye kadar (0 = tamamen bırakmak)
  startDate: string;      // plan başlangıcı
  unitPrice?: number;     // paket fiyatı (₺)
  perPack?: number;       // paketteki adet
  minGapMin?: number;     // iki tane arası en az kaç dakika (isteğe bağlı)
}

export type TrackerMode = 'build' | 'reduce';

export interface Tracker {
  id: string;
  name: string;
  icon: string;          // ICONS haritasındaki anahtar
  category: Category;
  type: TrackerType;
  order: number;
  active: boolean;       // false = silinmiş gibi gizli (eski kayıtlar)
  paused?: boolean;      // duraklatıldı: Bugün'de görünmez, geçmiş durur

  unit?: string;         // ml, sayfa, dk, kg
  target?: number;       // isteğe bağlı günlük hedef (bilgi amaçlı)
  step?: number;         // sayaç için tek dokunuş artışı
  doneAt?: number;       // "yapıldı" sayılma eşiği (ör. ders: 10 dk yeter)
  weeklyTimes?: number;  // isteğe bağlı haftalık niyet (ör. haftada 4 gün) — bilgi amaçlı
  days?: number[];       // 0=Pazar … 6=Cumartesi; boş = her gün
  time?: string;         // günün hangi saatinde (sıralama için)
  hint?: string;
  link?: string;
  key?: TrackerKey;
  reminders?: Reminder[];
  mode?: TrackerMode;    // varsayılan 'build'
  focus?: boolean;       // odak modunda da göster/anımsat
  reduce?: ReducePlan;   // mode === 'reduce' ise

  /** @deprecated v1 aşama sistemi — artık kullanılmıyor */
  phase?: number;
}

export interface SleepLog {
  bed: string;   // "00:10" — önceki gece
  wake: string;  // "07:05"
}

/** users/{uid}/days/{YYYY-MM-DD} — bir günün tüm kaydı tek belgede */
export interface DayLog {
  id: string;
  date: string;
  entries?: Record<string, number>;    // trackerId → değer
  notes?: Record<string, string>;      // trackerId → kısa not
  sleep?: SleepLog;
  times?: Record<string, number[]>;    // azaltılan alışkanlık: her birinin zamanı (ms)
  urges?: Record<string, number>;      // atlatılan istekler
  tags?: Record<string, Record<string, number>>; // tetikleyici sayıları
  note?: string;                       // "Bugün nasıldı?"
  closedAt?: number;                   // "Günü kapat" yapıldıysa
  updatedAt?: number;
}

/** users/{uid}/weeks/{pazartesi YYYY-MM-DD} */
export interface Intention { id: string; text: string; done: boolean }

export interface WeekLog {
  id: string;
  intentions?: Intention[];   // haftalık niyetler (serbest, sınırsız)
  good?: string;              // ne iyi gitti
  hard?: string;              // ne zorladı
  closedAt?: number;          // "Haftayı kapat" yapıldıysa
  updatedAt?: number;
}

/* ── Görevler & notlar ────────────────────────────────── */

export type Area = 'school' | 'work' | 'home' | 'personal';

export interface Task {
  id: string;
  text: string;
  forDate?: string;   // hangi gün; boşsa "bu hafta bir ara" (weekOf ile)
  weekOf?: string;    // haftanın pazartesisi
  time?: string;      // "14:00"
  star?: boolean;     // öncelikli
  area?: Area;
  note?: string;
  remindBefore?: number; // saatli görevden kaç dk önce Telegram'dan haber (boş = yok)
  ruleId?: string;       // tekrarlayan görev kuralından üretildiyse
  effort?: 'light' | 'deep'; // "Şimdi ne yapsam" için isteğe bağlı
  done: boolean;
  order: number;
  createdAt: number;
}

/** Tekrarlayan görev kuralı — önümüzdeki günlerin görevleri bundan üretilir */
export type Repeat = 'daily' | 'weekdays' | 'weekly' | 'monthly';
export interface TaskRule {
  id: string;
  text: string;
  repeat: Repeat;
  days?: number[];      // weekly: 0=Paz … 6=Cmt
  monthDay?: number;    // monthly
  time?: string;
  star?: boolean;
  area?: Area;
  note?: string;
  remindBefore?: number;
  startDate: string;
  skips?: string[];     // tek tek silinen günler (yeniden üretilmesin)
  active: boolean;
  createdAt: number;
}

/* ── Ders & sınavlar ──────────────────────────────────── */

export type CourseStatus = 'planned' | 'taking' | 'passed' | 'failed';
export interface Course {
  id: string;
  name: string;
  code?: string;
  semester?: number;    // 1–4 (kalan dönemler), boş = belirsiz
  status: CourseStatus;
  credits?: number;
  note?: string;
  passedAt?: string;
  order: number;
  createdAt: number;
}

export type ExamKind = 'vize' | 'final' | 'but' | 'quiz' | 'odev' | 'proje';
export interface Exam {
  id: string;
  courseId?: string;
  title?: string;       // ders yoksa serbest başlık
  kind: ExamKind;
  date: string;
  time?: string;
  place?: string;
  note?: string;
  grade?: string;
  createdAt: number;
}

export interface StudySession {
  id: string;
  courseId?: string;
  trackerId?: string;
  minutes: number;
  date: string;
  createdAt: number;
}

/* ── Kütüphane ────────────────────────────────────────── */

export type LibKind = 'book' | 'film' | 'series' | 'course' | 'video' | 'podcast' | 'article';
export type LibStatus = 'want' | 'doing' | 'done' | 'dropped';
export interface Quote { id: string; text: string; page?: number; createdAt: number }
export interface LibraryItem {
  id: string;
  kind: LibKind;
  title: string;
  creator?: string;     // yazar / yönetmen / eğitmen / kanal
  status: LibStatus;
  progress?: number;    // sayfa / bölüm / %
  total?: number;
  rating?: number;      // 1–5
  startedAt?: string;
  finishedAt?: string;
  note?: string;
  quotes?: Quote[];
  url?: string;
  createdAt: number;
  updatedAt?: number;
}

/* ── Hayat defteri ────────────────────────────────────── */

export interface JournalEntry {
  id: string;
  date: string;          // mantıksal gün
  time?: string;         // "21:40"
  title?: string;
  text: string;
  mood?: number;         // 1–5
  tags?: string[];       // #saha → "saha"
  people?: string[];     // @Ali → kişi kimlikleri
  photo?: string;        // küçültülmüş JPEG (data URL, ~150 KB)
  important?: boolean;   // ⭐ hayat çizelgesine düşer
  prompt?: string;       // yazarken görünen günün sorusu
  source?: 'app' | 'telegram';
  createdAt: number;
  updatedAt?: number;
}

export type Relation = 'family' | 'friend' | 'work' | 'school' | 'other';
export interface Contact { date: string; kind: 'talk' | 'meet'; note?: string }
export interface Person {
  id: string;
  name: string;
  relation: Relation;
  birthday?: string;     // "MM-DD" ya da "YYYY-MM-DD"
  notes?: string;        // hediye fikirleri, sevdiği şeyler
  everyDays?: number;    // "şu kadar günde bir hatırlat" (boş = hatırlatma yok)
  lastContact?: string;
  contacts?: Contact[];
  createdAt: number;
}

export type DreamStatus = 'dream' | 'doing' | 'done';
export interface Dream {
  id: string;
  title: string;
  note?: string;
  area?: 'travel' | 'learn' | 'do' | 'have' | 'be';
  status: DreamStatus;
  doneAt?: string;
  createdAt: number;
}

export interface GoalStep { id: string; text: string; done: boolean; taskId?: string }
export interface YearGoal {
  id: string;
  year: number;
  title: string;
  why?: string;
  steps?: GoalStep[];
  trackerId?: string;    // bağlı rutin / azaltılan alışkanlık
  done?: boolean;
  createdAt: number;
}

export interface Moment {
  id: string;
  date: string;
  title: string;
  note?: string;
  emoji?: string;
  createdAt: number;
}

export type InboxStatus = 'open' | 'planned' | 'archived';

export interface InboxItem {
  id: string;
  text: string;
  status: InboxStatus;
  createdAt: number;
}

/* ── Ayarlar ──────────────────────────────────────────── */

export type Theme = 'dark' | 'light';

export interface Settings {
  onboarded: boolean;
  dayStartHour: number;   // gün sınırı (varsayılan 04:00)
  theme: Theme;
  startDate: string;
  showStreak: boolean;    // zincir göstergesi — varsayılan kapalı
  migratedV2?: boolean;
  displayName?: string;   // selamda ve Telegram'da kullanılan ad
  haptics?: boolean;      // tik atınca titreşim (varsayılan açık)
  location?: { name: string; lat: number; lon: number } | null; // güneş kartı için
  focusUntil?: string;    // odak modu bu güne kadar (dahil) açık
  quietStart?: string;    // sessiz saatler (Telegram), ör. "00:30"
  quietEnd?: string;      // ör. "07:00"
  pauseDate?: string;     // "bugün bana dokunma" — bu gün hiç anımsatma
  planning?: { morning?: string; evening?: string; sunday?: string; letter?: boolean; money?: boolean; people?: boolean }; // planlama anımsatıcı saatleri ("" = kapalı)
  telegramChatId?: number;
  telegramLinkCode?: string;
  telegramTest?: number;  // "deneme mesajı gönder" isteği (zaman damgası)
}

export type TabId = 'today' | 'week' | 'notes' | 'money' | 'more';

export interface AppUser {
  uid: string;
  name: string;
  email: string;
  photo?: string;
  local?: boolean;
}
