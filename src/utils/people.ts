import type { Person, Relation } from '../types';
import { daysBetween, fromKey, toKey } from './date';

export const RELATION: Record<Relation, string> = { family: 'Aile', friend: 'Arkadaş', work: 'İş', school: 'Okul', other: 'Diğer' };

/** Bir sonraki doğum günü. 29 Şubat artık yıl olmayan yıllarda 28 Şubat'ta kutlanır. */
export function nextBirthday(birthday: string | undefined, today: string): { date: string; inDays: number; age?: number } | null {
  if (!birthday) return null;
  const parts = birthday.split('-').map(Number);
  const [year, month, day] = parts.length === 3 ? parts : [undefined, parts[0], parts[1]];
  if (!month || !day) return null;
  const t = fromKey(today);
  const at = (y: number) => {
    const last = new Date(y, month, 0).getDate();
    return new Date(y, month - 1, Math.min(day, last));
  };
  let d = at(t.getFullYear());
  if (toKey(d) < today) d = at(t.getFullYear() + 1);
  const date = toKey(d);
  return { date, inDays: daysBetween(today, date), age: year ? d.getFullYear() - year : undefined };
}

/** "Şu kadar günde bir" hatırlatması zamanı geldiyse son görüşmeden bu yana geçen gün */
export function contactDue(p: Pick<Person, 'everyDays' | 'lastContact' | 'createdAt'>, today: string): number | null {
  if (!p.everyDays) return null;
  const since = p.lastContact ? daysBetween(p.lastContact, today) : daysBetween(toKey(new Date(p.createdAt)), today);
  return since >= p.everyDays ? since : null;
}

export function sinceLabel(days: number): string {
  if (days <= 0) return 'bugün';
  if (days === 1) return 'dün';
  if (days < 14) return `${days} gün önce`;
  if (days < 60) return `${Math.round(days / 7)} hafta önce`;
  return `${Math.round(days / 30)} ay önce`;
}
