import type { Repeat, Task, TaskRule } from '../types';
import { addDays, fromKey, weekday } from './date';

/* Tekrarlayan görevler: kural → önümüzdeki günlerin görevleri.
   Görev kimliği belirlidir (kural_gün), bu yüzden tekrar üretmek çoğaltmaz. */

export const instanceId = (ruleId: string, date: string) => `${ruleId}_${date}`;

export function ruleMatches(rule: Pick<TaskRule, 'repeat' | 'days' | 'monthDay' | 'startDate' | 'skips'>, date: string): boolean {
  if (date < rule.startDate || rule.skips?.includes(date)) return false;
  const wd = weekday(date);
  switch (rule.repeat) {
    case 'daily': return true;
    case 'weekdays': return wd >= 1 && wd <= 5;
    case 'weekly': return (rule.days?.length ? rule.days : [weekday(rule.startDate)]).includes(wd);
    case 'monthly': {
      const d = fromKey(date);
      const want = rule.monthDay ?? fromKey(rule.startDate).getDate();
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      return d.getDate() === Math.min(want, last);
    }
  }
}

/** Üretilmesi gereken görevler: aktif kurallar × [bugün, bugün+horizon) — zaten olanlar hariç */
export function pendingInstances(rules: TaskRule[], tasks: Task[], today: string, horizon = 7) {
  const have = new Set(tasks.map((t) => t.id));
  const out: { id: string; data: Omit<Task, 'id'> }[] = [];
  for (const r of rules) {
    if (!r.active) continue;
    for (let i = 0; i < horizon; i++) {
      const date = addDays(today, i);
      const id = instanceId(r.id, date);
      if (have.has(id) || !ruleMatches(r, date)) continue;
      out.push({
        id,
        data: {
          text: r.text, forDate: date, ruleId: r.id, done: false, order: 0, createdAt: Date.now(),
          ...(r.time ? { time: r.time } : {}), ...(r.star ? { star: true } : {}), ...(r.area ? { area: r.area } : {}),
          ...(r.note ? { note: r.note } : {}), ...(r.remindBefore ? { remindBefore: r.remindBefore } : {}),
        },
      });
    }
  }
  return out;
}

export const REPEAT_LABEL: Record<Repeat, string> = {
  daily: 'Her gün', weekdays: 'Hafta içi', weekly: 'Her hafta', monthly: 'Her ay',
};
