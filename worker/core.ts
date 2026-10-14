/* Anımsatıcı çekirdeği — Firebase ve Telegram'dan bağımsız, saf fonksiyonlar.
   Uygulamanın kendi kurallarını kullanır: rutin yapıldıysa sorma, fatura/maaş soruları, mektup. */

import type { DayLog, Settings, Task, Tracker } from '../src/types';
import type { Cashflow, Transaction } from '../src/finance/types';
import { isDone, isScheduled } from '../src/utils/trackers';
import { dueBills, shouldAskSalary } from '../src/finance/utils/period';

export const TZ = 'Europe/Istanbul';

export interface Clock {
  ms: number;
  realDate: string;   // takvim günü (İstanbul)
  date: string;       // mantıksal gün (04:00 sınırı)
  minutes: number;    // gece yarısından beri dakika (İstanbul)
  weekday: number;    // mantıksal günün haftası günü (0=Paz)
}

const pad = (n: number) => String(n).padStart(2, '0');

export function istanbulClock(d: Date, dayStartHour = 4): Clock {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(d).map((p) => [p.type, p.value]));
  const realDate = `${parts.year}-${parts.month}-${parts.day}`;
  const hour = Number(parts.hour);
  const minutes = hour * 60 + Number(parts.minute);
  const logical = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
  if (hour < dayStartHour) logical.setUTCDate(logical.getUTCDate() - 1);
  const date = `${logical.getUTCFullYear()}-${pad(logical.getUTCMonth() + 1)}-${pad(logical.getUTCDate())}`;
  return { ms: d.getTime(), realDate, date, minutes, weekday: logical.getUTCDay() };
}

export const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
};

/** (from, to] aralığı — gece yarısını geçebilir */
export function inWindow(minute: number, from: number, to: number): boolean {
  if (from === to) return false;
  return from < to ? minute > from && minute <= to : minute > from || minute <= to;
}

export function isQuiet(s: Pick<Settings, 'quietStart' | 'quietEnd'>, minute: number): boolean {
  if (!s.quietStart || !s.quietEnd) return false;
  const a = toMin(s.quietStart);
  const b = toMin(s.quietEnd);
  return a < b ? minute >= a && minute < b : minute >= a || minute < b;
}

export interface Button { text: string; data?: string; url?: string }
export interface Outgoing { key: string; text: string; buttons?: Button[][] }

export interface UserInput {
  settings: Settings;
  trackers: Tracker[];
  day?: DayLog;
  tasks: Task[];
  cashflows: Cashflow[];
  transactions: Transaction[];
  snoozes: { id: string; trackerId?: string; taskId?: string; fireAt: number }[];
  clock: Clock;
  fromMin: number;       // son çalışmanın dakikası
  skipped?: string[];    // bugün "geç" denen rutinler
  salaryDayHint?: number; // Para ayarlarından
  appUrl: string;
  letter?: string;       // Pazar mektubu (hazırsa)
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Rutin anımsatıcısının düğmeleri — kayıt türüne göre "Evet" ne anlama gelir */
export function routineButtons(t: Tracker, date: string, appUrl: string): Button[][] {
  const canYes = t.type === 'check' || t.type === 'counter' || t.type === 'duration';
  const yes = t.type === 'counter' ? `+${t.step ?? 1} ${t.unit ?? ''}`.trim() : t.type === 'duration' ? `Evet (${t.doneAt ?? 10} dk) ✓` : 'Evet ✓';
  return [
    ...(canYes ? [[{ text: yes, data: `d|${t.id}|${date}` }]] : [[{ text: 'Uygulamada kaydet', url: appUrl }]]),
    [{ text: '15 dk sonra', data: `l|${t.id}|${date}` }, { text: 'Bugün geç', data: `s|${t.id}|${date}` }],
  ];
}

export function routineText(t: Tracker, message?: string): string {
  return esc(message?.trim() || `${t.name} yaptın mı?`);
}

/** Bu çalışmada bu kullanıcıya gidecek mesajlar (tekrar gönderimi anahtar ile dışarıda engellenir) */
export function planUserMessages(x: UserInput): Outgoing[] {
  const { settings: s, clock: c } = x;
  const out: Outgoing[] = [];
  const due = (hhmm?: string) => !!hhmm && inWindow(toMin(hhmm), x.fromMin, c.minutes);

  // Deneme mesajı her koşulda
  if (s.telegramTest) out.push({ key: `test_${s.telegramTest}`, text: 'Deneme ✓ MeLife buradan sana nazikçe soracak.' });

  if (s.pauseDate === c.date || isQuiet(s, c.minutes)) return out;
  const focus = !!s.focusUntil && c.date <= s.focusUntil;

  // 1) Rutinler
  for (const t of x.trackers) {
    if (!t.active || t.paused || t.mode === 'reduce' || (focus && !t.focus) || x.skipped?.includes(t.id)) continue;
    (t.reminders ?? []).forEach((r, i) => {
      if (!r.on || !due(r.time)) return;
      const scheduled = r.days?.length ? r.days.includes(c.weekday) : isScheduled(t, c.date);
      if (!scheduled || isDone(t, x.day, c.date, { tasksFor: () => 0 })) return;
      out.push({ key: `r_${t.id}_${c.date}_${i}`, text: routineText(t, r.message), buttons: routineButtons(t, c.date, x.appUrl) });
    });
  }

  // 2) Ertelenenler
  for (const z of x.snoozes) {
    if (z.fireAt > c.ms) continue;
    const t = x.trackers.find((tr) => tr.id === z.trackerId);
    if (t && !isDone(t, x.day, c.date, { tasksFor: () => 0 })) {
      out.push({ key: `z_${z.id}`, text: `Tekrar soruyorum: ${routineText(t)}`, buttons: routineButtons(t, c.date, x.appUrl) });
    }
  }

  // 3) Saatli görevler
  for (const task of x.tasks) {
    if (task.done || !task.time || !task.remindBefore || task.forDate !== c.date) continue;
    const at = toMin(task.time) - task.remindBefore;
    if (!inWindow((at + 1440) % 1440, x.fromMin, c.minutes)) continue;
    out.push({
      key: `t_${task.id}_${task.forDate}`,
      text: `⏰ <b>${esc(task.time)}</b> · ${esc(task.text)}`,
      buttons: [[{ text: 'Tamam ✓', data: `t|${task.id}` }, { text: 'Uygulamayı aç', url: x.appUrl }]],
    });
  }

  // 4) Planlama soruları
  const p = s.planning ?? {};
  if (due(p.morning)) out.push({ key: `pm_${c.date}`, text: 'Günaydın 🌤 Bugüne bakalım mı?', buttons: [[{ text: 'Bugünü aç', url: x.appUrl }]] });
  if (due(p.evening)) out.push({ key: `pe_${c.date}`, text: 'Günü kapatalım mı? Bugüne bir bak, yarını yaz. 🌙', buttons: [[{ text: 'Günü kapat', url: `${x.appUrl}/?do=close-day` }]] });
  if (c.weekday === 0 && due(p.sunday)) {
    out.push({ key: `pw_${c.date}`, text: 'Haftayı kapatalım mı? 10 dakika yeter.', buttons: [[{ text: 'Haftayı kapat', url: `${x.appUrl}/?do=close-week` }]] });
    if (p.letter && x.letter) out.push({ key: `pl_${c.date}`, text: `✉️ <b>Haftanın mektubu</b>\n\n${esc(x.letter)}` });
  }

  // 5) Para soruları (10:00'da, açıksa)
  if (p.money !== false && inWindow(10 * 60, x.fromMin, c.minutes)) {
    for (const b of dueBills(x.cashflows, c.date)) {
      out.push({
        key: `b_${b.id}_${c.date.slice(0, 7)}_${c.date}`,
        text: `${esc(b.name)} · ${Math.round(b.amount).toLocaleString('tr-TR')} ₺ ${b.type === 'income' ? 'geldi mi?' : 'ödendi mi?'}`,
        buttons: [[{ text: 'Para\'da bak', url: `${x.appUrl}/?do=bills` }]],
      });
    }
    if (shouldAskSalary(x.transactions, c.date, x.salaryDayHint)) {
      out.push({ key: `sal_${c.date}`, text: 'Maaş yattı mı? 💸', buttons: [[{ text: 'Maaşı ekle', url: `${x.appUrl}/?do=salary` }]] });
    }
  }

  return out;
}

/* ── Düğme yanıtları ───────────────────────────────────── */

export type Action =
  | { kind: 'done'; trackerId: string; date: string }
  | { kind: 'later'; trackerId: string; date: string }
  | { kind: 'skip'; trackerId: string; date: string }
  | { kind: 'task'; taskId: string };

export function parseAction(data: string): Action | null {
  const [k, a, b] = data.split('|');
  if (k === 'd' && a && b) return { kind: 'done', trackerId: a, date: b };
  if (k === 'l' && a && b) return { kind: 'later', trackerId: a, date: b };
  if (k === 's' && a && b) return { kind: 'skip', trackerId: a, date: b };
  if (k === 't' && a) return { kind: 'task', taskId: a };
  return null;
}

/** "Evet" denince güne yazılacak değer (mevcut değere göre) */
export function doneValue(t: Tracker, current: number): number {
  if (t.type === 'counter') return current + (t.step ?? 1);
  if (t.type === 'duration') return Math.max(current, t.doneAt ?? t.target ?? 10);
  return 1;
}

export const ACK: Record<Action['kind'], string> = {
  done: '✓ Kaydedildi',
  later: '⏰ 15 dk sonra tekrar soracağım',
  skip: '👌 Bugün geçildi',
  task: '✓ Görev tamamlandı',
};
