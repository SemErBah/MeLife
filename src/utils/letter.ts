import { fmtMinutes, longDate } from './date';

/* Haftalık mektup — kısa, sıcak, yargısız. Uygulamada ve Telegram'da aynı metin. */

export interface LetterInput {
  name?: string;
  doneTasks: number;
  bestDay?: { date: string; count: number };
  routines: { name: string; done: number; planned: number }[];
  sleepAvg?: number | null;       // dk
  moodAvg?: number | null;        // 1–5
  studyMinutes?: number;
  reduce?: { name: string; unit?: string; avg: number; prevAvg: number | null }[];
  spent?: number;
  topCategory?: string;
  intentionsDone?: number;
  intentionsTotal?: number;
}

const tl = (n: number) => `${Math.round(n).toLocaleString('tr-TR')} ₺`;

export function weeklyLetter(x: LetterInput): string {
  const lines: string[] = [];
  lines.push(x.name ? `Merhaba ${x.name},` : 'Merhaba,');

  const facts: string[] = [];
  if (x.doneTasks > 0) {
    facts.push(`Bu hafta ${x.doneTasks} görev bitirdin${x.bestDay && x.bestDay.count > 1 ? `; en dolu günün ${longDate(x.bestDay.date)} oldu` : ''}.`);
  }
  const strong = x.routines.filter((r) => r.planned > 0 && r.done > 0).sort((a, b) => b.done / b.planned - a.done / a.planned).slice(0, 2);
  if (strong.length) facts.push(strong.map((r) => `${r.name}: ${r.done}/${r.planned} gün`).join(', ') + '.');
  if (x.intentionsTotal) facts.push(`Haftanın ${x.intentionsTotal} niyetinden ${x.intentionsDone ?? 0} tanesini işaretledin.`);
  if (x.studyMinutes) facts.push(`Toplam ${fmtMinutes(x.studyMinutes)} ders çalıştın.`);
  if (x.sleepAvg) facts.push(`Ortalama ${fmtMinutes(x.sleepAvg)} uyudun.`);
  if (x.moodAvg) facts.push(`Ruh hali ortalaman ${x.moodAvg.toFixed(1)}/5.`);
  for (const r of x.reduce ?? []) {
    const cmp = r.prevAvg !== null ? (r.avg < r.prevAvg ? ` (geçen hafta ${r.prevAvg.toFixed(1)}'di, azalıyor)` : r.avg > r.prevAvg ? ` (geçen hafta ${r.prevAvg.toFixed(1)})` : '') : '';
    facts.push(`${r.name}: günde ortalama ${r.avg.toFixed(1)}${r.unit ? ` ${r.unit}` : ''}${cmp}.`);
  }
  if (x.spent) facts.push(`${tl(x.spent)} harcadın${x.topCategory ? `, en çok ${x.topCategory}` : ''}.`);

  if (facts.length) lines.push('', ...facts);
  else lines.push('', 'Bu hafta pek kayıt yok. Olur böyle haftalar; hiçbir şey kaybolmadı.');

  lines.push('', 'Yeni haftaya küçük bir şeyle başla. Bir şey yeter.');
  return lines.join('\n');
}
