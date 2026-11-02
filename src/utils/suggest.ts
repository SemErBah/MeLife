import type { Task } from '../types';
import { timeToMin, weekStart } from './date';

export type Energy = 'low' | 'ok' | 'high';

/**
 * "Şimdi ne yapsam?": açık işler arasından enerjiye ve saate göre sıralı öneri.
 * Bugünün işleri, gecikenler ve bu haftanın tarihsiz işleri adaydır.
 */
export function suggestTasks(tasks: Task[], energy: Energy, today: string, nowMin: number, dayStartHour = 4): Task[] {
  const week = weekStart(today);
  const pool = tasks.filter((t) => !t.done && (
    (t.forDate && t.forDate <= today) || (!t.forDate && t.weekOf === week)
  ));
  const score = (t: Task) => {
    let s = 0;
    if (t.forDate === today) s += 2;
    else if (t.forDate && t.forDate < today) s += 1;
    if (t.star) s += energy === 'low' ? 1 : 2;
    if (energy === 'low') s += t.effort === 'light' ? 3 : t.effort === 'deep' ? -3 : 0;
    if (energy === 'high') s += t.effort === 'deep' ? 3 : t.effort === 'light' ? -1 : 0;
    if (t.time) {
      const diff = timeToMin(t.time, dayStartHour) - nowMin;
      if (diff >= 0 && diff <= 90) s += 3;       // yaklaşan saatli iş
      else if (diff > 90) s -= 2;                // daha vakti var
    }
    if (energy === 'low' && t.text.length <= 30) s += 0.5;
    return s;
  };
  return pool
    .map((t, i) => ({ t, s: score(t), i }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.t);
}
