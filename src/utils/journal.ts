import type { JournalEntry, Person } from '../types';
import { fromKey, toKey } from './date';

/* Günlük yardımcıları: #etiket ve @kişi ayıklama, "bu günün hatıraları" */

const fold = (s: string) => s.toLocaleLowerCase('tr-TR');

/** "#saha işleri #okul" → ["saha", "okul"] */
export function extractTags(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/#([\p{L}\p{N}_-]{2,30})/gu)) out.add(fold(m[1]));
  return [...out];
}

/** "@Ali ile konuştuk" → Ali'nin kimliği (ad ya da ilk ad eşleşmesi) */
export function extractPeople(text: string, people: Pick<Person, 'id' | 'name'>[]): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/@([\p{L}\p{N}_]{2,30})/gu)) {
    const key = fold(m[1]);
    const hit = people.find((p) => fold(p.name).replace(/\s+/g, '') === key)
      ?? people.find((p) => fold(p.name).split(/\s+/)[0] === key);
    if (hit) out.add(hit.id);
  }
  return [...out];
}

/** n ay önceki aynı gün (ayın günü yoksa null: 31 Mart → 31 Şubat yok) */
export function monthsAgo(date: string, n: number): string | null {
  const d = fromKey(date);
  const t = new Date(d.getFullYear(), d.getMonth() - n, d.getDate());
  return t.getDate() === d.getDate() ? toKey(t) : null;
}

export interface Memory { label: string; date: string; entries: JournalEntry[] }

/** "Bu günün hatıraları": 1 ay, 6 ay, 1 yıl, 2 yıl önce */
export function memoriesFor(entries: JournalEntry[], today: string): Memory[] {
  const spans: [string, number][] = [['1 ay önce', 1], ['6 ay önce', 6], ['1 yıl önce', 12], ['2 yıl önce', 24]];
  const out: Memory[] = [];
  for (const [label, n] of spans) {
    const date = monthsAgo(today, n);
    if (!date) continue;
    const list = entries.filter((e) => e.date === date);
    if (list.length) out.push({ label, date, entries: list });
  }
  return out;
}

export const MOOD_COLOR = ['', 'var(--cat-health)', 'var(--cat-mind)', 'var(--text-muted)', 'var(--cat-order)', 'var(--cat-work)'];
