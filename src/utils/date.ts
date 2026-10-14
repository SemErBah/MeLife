/* Tarih yardımcıları — gün anahtarı "YYYY-MM-DD" (yerel saat).
   Mantıksal gün dayStartHour'da (varsayılan 04:00) biter: gece 00:15'te atılan tik o güne sayılır. */

export const pad = (n: number) => String(n).padStart(2, '0');

export function toKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function logicalToday(now: Date = new Date(), dayStartHour = 4): string {
  const d = new Date(now);
  if (d.getHours() < dayStartHour) d.setDate(d.getDate() - 1);
  return toKey(d);
}

export function addDays(key: string, n: number): string {
  const d = fromKey(key);
  d.setDate(d.getDate() + n);
  return toKey(d);
}

/** 0 = Pazar … 6 = Cumartesi */
export const weekday = (key: string) => fromKey(key).getDay();

/** Haftanın pazartesisi */
export function weekStart(key: string): string {
  return addDays(key, -((weekday(key) + 6) % 7));
}

export function weekDays(key: string): string[] {
  const start = weekStart(key);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function daysBetween(a: string, b: string): number {
  return Math.round((fromKey(b).getTime() - fromKey(a).getTime()) / 86_400_000);
}

/** "07:00" → dakika. Gün sınırından önceki saatler (00:30) bir sonraki güne kayar → 1470. */
export function timeToMin(time: string, dayStartHour = 4): number {
  const [h, m] = time.split(':').map(Number);
  return ((h < dayStartHour ? h + 24 : h) * 60) + (m || 0);
}

export function nowToMin(now: Date, dayStartHour = 4): number {
  const h = now.getHours();
  return ((h < dayStartHour ? h + 24 : h) * 60) + now.getMinutes();
}

/** Yatış–kalkış arası dakika (gece yarısını geçebilir) */
export function sleepMinutes(bed: string, wake: string): number {
  const [bh, bm] = bed.split(':').map(Number);
  const [wh, wm] = wake.split(':').map(Number);
  let diff = (wh * 60 + wm) - (bh * 60 + bm);
  if (diff <= 0) diff += 1440;
  return diff;
}

/** "2026-W42" — ISO hafta anahtarı (Pazartesi başlar) */
export function isoWeekKey(key: string): string {
  const d = fromKey(key);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day + 3); // haftanın perşembesi
  const firstThu = new Date(d.getFullYear(), 0, 4);
  const week = 1 + Math.round(((d.getTime() - firstThu.getTime()) / 86_400_000 - 3 + ((firstThu.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${pad(week)}`;
}

export function nowHHMM(now: Date = new Date()): string {
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

/* ── Biçimlendirme ────────────────────────────────────── */

const fmtLong = new Intl.DateTimeFormat('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtShort = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short' });
const fmtWd = new Intl.DateTimeFormat('tr-TR', { weekday: 'short' });

export const longDate = (key: string) => fmtLong.format(fromKey(key));
const fmtWdLong = new Intl.DateTimeFormat('tr-TR', { weekday: 'long' });
const fmtDayMonth = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long' });
export const weekdayName = (key: string) => fmtWdLong.format(fromKey(key));
export const dayMonth = (key: string) => fmtDayMonth.format(fromKey(key));
export const shortDate = (key: string) => fmtShort.format(fromKey(key));
export const shortWeekday = (key: string) => fmtWd.format(fromKey(key));

export const WEEKDAY_LETTERS = ['Pz', 'Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct'];

export function fmtMinutes(min: number): string {
  const m = Math.round(min);
  if (m < 60) return `${m} dk`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} sa ${r} dk` : `${h} sa`;
}

export function fmtClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h ? `${h}:${pad(m)}:${pad(r)}` : `${pad(m)}:${pad(r)}`;
}

export function greeting(now: Date): string {
  const h = now.getHours();
  if (h >= 4 && h < 11) return 'Günaydın';
  if (h >= 11 && h < 17) return 'İyi günler';
  if (h >= 17 && h < 22) return 'İyi akşamlar';
  return 'İyi geceler';
}
