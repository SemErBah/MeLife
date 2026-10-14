import { logicalToday } from '../../utils/date';
/* ── Para & Tarih yardımcıları ─────────────────────────
   Tüm tarihler yerel saatle "YYYY-MM-DD" olarak tutulur.
   toISOString() UTC'ye çevirdiği için Türkiye'de gece
   00:00–03:00 arası bir önceki günü verir; kullanılmamalı. */

export const fmt = (n: number) =>
  (n < 0 ? '−' : '') + Math.abs(n).toLocaleString('tr-TR', { maximumFractionDigits: Number.isInteger(n) ? 0 : 2 }) + ' ₺';

export const fmtCompact = (n: number) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.0', '') + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'k';
  return Math.round(n).toString();
};

/** Türkçe tutar: "1.250" → 1250, "1.250,50" → 1250.5, "12,5" / "12.5" → 12.5 */
export function parseAmount(v: string): number {
  let s = v.trim().replace(/[\s₺]/g, '');
  if (!s) return NaN;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if ((s.match(/\./g) || []).length > 1 || /^[1-9]\d{0,2}\.\d{3}$/.test(s)) s = s.replace(/\./g, '');
  return Number(s);
}

/** Para için "bugün": MeLife ile aynı gün sınırı (04:00). Gece 01:00'deki harcama o güne yazılır. */
export const financeToday = () => logicalToday(new Date(), 4);

export function toLocalDateStr(d: Date = new Date()): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

/** "YYYY-MM-DD" → yerel gece yarısı. Diğer formatlar Date'e bırakılır. */
export function parseDate(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(s);
}

export function isInMonth(dateStr: string, year: number, month: number): boolean {
  const d = parseDate(dateStr);
  return d.getFullYear() === year && d.getMonth() === month;
}

/** Bugünden hedef tarihe kalan tam gün (geçmişse negatif). */
export function daysUntil(dateStr: string, from: Date = new Date()): number {
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  return Math.round((parseDate(dateStr).getTime() - today.getTime()) / 86_400_000);
}

export const safePct = (part: number, whole: number) =>
  whole > 0 ? Math.min((part / whole) * 100, 100) : 0;

export const fmtShortDate = (dateStr: string) =>
  parseDate(dateStr).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });

export const daysLeftLabel = (days: number) =>
  days > 1 ? `${days} gün kaldı` : days === 1 ? 'Yarın' : days === 0 ? 'Bugün' : `${Math.abs(days)} gün gecikti`;
