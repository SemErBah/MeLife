import type { DayLog, Dream, JournalEntry, LibraryItem, Person, StudySession, Tracker } from '../types';
import { addDays } from './date';
import { reduceStats } from './reduce';

/* Kilometre taşları: tek seferlik, baskısız kutlamalar. Kırılan seri için hiçbir şey söylenmez. */

export interface Milestone { key: string; emoji: string; title: string; date?: string }

export interface MilestoneInput {
  journal: JournalEntry[];
  library: LibraryItem[];
  sessions: StudySession[];
  trackers: Tracker[];
  days: Record<string, DayLog>;
  people: Person[];
  dreams: Dream[];
  today: string;
}

export function computeMilestones(x: MilestoneInput): Milestone[] {
  const out: Milestone[] = [];

  const jDays = [...new Set(x.journal.map((e) => e.date))].sort();
  if (jDays.length) out.push({ key: 'journal-1', emoji: '📓', title: 'İlk günlük kaydın', date: jDays[0] });
  for (const n of [10, 50, 100, 365]) {
    if (jDays.length >= n) out.push({ key: `journal-${n}`, emoji: '✍️', title: `${n} gün günlük yazdın`, date: jDays[n - 1] });
  }

  const books = x.library.filter((l) => l.kind === 'book' && l.status === 'done').sort((a, b) => (a.finishedAt ?? '').localeCompare(b.finishedAt ?? ''));
  if (books.length) out.push({ key: 'book-1', emoji: '📚', title: `İlk kitabını bitirdin: ${books[0].title}`, date: books[0].finishedAt });
  for (const n of [5, 10, 25]) if (books.length >= n) out.push({ key: `book-${n}`, emoji: '📚', title: `${n}. kitabını bitirdin`, date: books[n - 1].finishedAt });

  const sorted = [...x.sessions].sort((a, b) => a.date.localeCompare(b.date));
  let min = 0;
  const hours = [10, 50, 100, 250];
  for (const s of sorted) {
    const before = min;
    min += s.minutes;
    for (const h of hours) if (before < h * 60 && min >= h * 60) out.push({ key: `study-${h}`, emoji: '🎓', title: `${h} saat ders çalıştın`, date: s.date });
  }

  for (const t of x.trackers) {
    if (t.mode !== 'reduce' || !t.reduce || !t.active) continue;
    const st = reduceStats(t, x.days, x.today, 7);
    for (const n of [7, 30]) {
      if (st.bestStreakUnder >= n) out.push({ key: `reduce-${t.id}-${n}`, emoji: '🌱', title: `${t.name}: ${n} gün sınırın altında` });
    }
  }

  const month = x.today.slice(0, 7);
  for (const p of x.people) {
    const n = (p.contacts ?? []).filter((c) => c.date.startsWith(month)).length;
    if (n >= 4) out.push({ key: `people-${p.id}-${month}`, emoji: '💛', title: `${p.name.split(' ')[0]} ile bu ay ${n} kez görüştün` });
  }

  const dreams = x.dreams.filter((d) => d.status === 'done').sort((a, b) => (a.doneAt ?? '').localeCompare(b.doneAt ?? ''));
  if (dreams.length) out.push({ key: 'dream-1', emoji: '✨', title: `İlk hayalin gerçekleşti: ${dreams[0].title}`, date: dreams[0].doneAt });

  return out;
}

/** Görülmemiş taşlar. Eski tarihli (bir haftadan eski) taşlar kutlanmadan sessizce "görüldü" sayılır. */
export function freshMilestones(all: Milestone[], seen: Record<string, string>, today: string): { show: Milestone[]; silent: Milestone[] } {
  const unseen = all.filter((m) => !seen[m.key]);
  const weekAgo = addDays(today, -7);
  return {
    show: unseen.filter((m) => !m.date || m.date >= weekAgo),
    silent: unseen.filter((m) => m.date && m.date < weekAgo),
  };
}

const KEY = 'melife-milestones';
export function loadSeen(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}'); } catch { return {}; }
}
export function markSeen(items: Milestone[], today: string) {
  const seen = loadSeen();
  for (const m of items) seen[m.key] ??= m.date ?? today;
  try { localStorage.setItem(KEY, JSON.stringify(seen)); } catch { /* */ }
}
