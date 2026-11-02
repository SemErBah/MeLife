import type { DayLog, JournalEntry, Tracker } from '../types';
import { sleepMinutes } from './date';
import { entryOf } from './trackers';

/* Kişisel keşifler: verindeki yargısız bağlantılar. Her iki grupta da en az MIN gün yoksa susar. */

export interface Insight { key: string; text: string; strength: number }

const MIN = 5;
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const fmt1 = (n: number) => n.toLocaleString('tr-TR', { maximumFractionDigits: 1, minimumFractionDigits: 1 });

interface Condition { key: string; label: string; test: (date: string, day: DayLog | undefined) => boolean | null }
interface Outcome { key: string; tracker: Tracker; value: (day: DayLog | undefined) => number | null }

export function findInsights(trackers: Tracker[], days: Record<string, DayLog>, journal: JournalEntry[], dates: string[]): Insight[] {
  const live = trackers.filter((t) => t.active);
  const jDays = new Set(journal.map((e) => e.date));
  const firstJournal = journal.length ? journal.reduce((m, e) => (e.date < m ? e.date : m), journal[0].date) : null;

  const conditions: Condition[] = [];
  const sleepT = live.find((t) => t.type === 'sleep');
  if (sleepT) conditions.push({
    key: 'sleep7', label: '7+ saat uyuduğun günlerde',
    test: (_, day) => (day?.sleep ? sleepMinutes(day.sleep.bed, day.sleep.wake) >= 420 : null),
  });
  for (const t of live) {
    if (t.mode === 'reduce' || t.type === 'scale' || t.type === 'sleep' || t.key === 'plan3') continue;
    conditions.push({
      key: `t-${t.id}`, label: `“${t.name}” yaptığın günlerde`,
      // Kayıt hiç girilmemiş gün bilinmiyor sayılır (yapmadı değil)
      test: (_, day) => (day ? entryOf(t, day) > 0 : null),
    });
  }
  if (firstJournal) conditions.push({ key: 'journal', label: 'Günlük yazdığın günlerde', test: (d) => (d >= firstJournal ? jDays.has(d) : null) });

  const outcomes: Outcome[] = live.flatMap((t): Outcome[] => {
    if (t.type === 'scale') return [{ key: t.id, tracker: t, value: (day) => (day?.entries?.[t.id] ? day.entries[t.id] : null) }];
    if (t.mode === 'reduce') return [{ key: t.id, tracker: t, value: (day) => (day?.entries?.[t.id] !== undefined ? day.entries[t.id] : null) }];
    return [];
  });

  const out: Insight[] = [];
  for (const c of conditions) {
    for (const o of outcomes) {
      if (c.key === `t-${o.tracker.id}`) continue;
      const yes: number[] = [];
      const no: number[] = [];
      for (const d of dates) {
        const day = days[d];
        const v = o.value(day);
        const cond = c.test(d, day);
        if (v === null || cond === null) continue;
        (cond ? yes : no).push(v);
      }
      if (yes.length < MIN || no.length < MIN) continue;
      const a = mean(yes);
      const b = mean(no);
      const diff = a - b;
      const name = o.tracker.name.toLocaleLowerCase('tr-TR');
      if (o.tracker.type === 'scale') {
        if (Math.abs(diff) < 0.4) continue;
        out.push({ key: `${c.key}|${o.key}`, strength: Math.abs(diff) / 4, text: `${c.label} ${name} ortalaman ${fmt1(a)}, diğer günlerde ${fmt1(b)}.` });
      } else {
        const rel = b ? Math.abs(diff) / b : 0;
        if (Math.abs(diff) < 1 || rel < 0.1) continue;
        const unit = o.tracker.unit ?? 'tane';
        out.push({ key: `${c.key}|${o.key}`, strength: Math.min(1, rel), text: `${c.label} ${name} ${fmt1(Math.abs(diff)).replace(/,0$/, '')} ${unit} daha ${diff < 0 ? 'az' : 'fazla'}.` });
      }
    }
  }
  return out.sort((x, y) => y.strength - x.strength).slice(0, 4);
}
