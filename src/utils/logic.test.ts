import { describe, expect, it } from 'vitest';
import type { DayLog, Task, Tracker } from '../types';
import { addDays, isoWeekKey, logicalToday, sleepMinutes, timeToMin, weekStart } from './date';
import { doneCount, isActive, isDone, isScheduled, streak, taskSort, weeklyCount, type DoneContext } from './trackers';
import { fromTemplate, newTrackerId, TEMPLATES } from '../services/seed';

const ctx: DoneContext = { tasksFor: () => 0 };
const tr = (p: Partial<Tracker>): Tracker => ({
  id: 'x', name: 'x', icon: 'brush', category: 'order', type: 'check', order: 0, active: true, ...p,
});
const task = (p: Partial<Task>): Task => ({ id: Math.random().toString(), text: 't', done: false, order: 0, createdAt: 0, ...p });
const at = (s: string) => new Date(s);

describe('tarih', () => {
  it('gün 04:00\'te biter', () => {
    expect(logicalToday(at('2026-10-13T00:15:00'))).toBe('2026-10-12');
    expect(logicalToday(at('2026-10-13T04:00:00'))).toBe('2026-10-13');
  });
  it('gece yarısından sonraki saatler sıralamada sona gider', () => {
    expect(timeToMin('00:30')).toBeGreaterThan(timeToMin('23:30'));
  });
  it('hafta pazartesi başlar', () => {
    expect(weekStart('2026-10-18')).toBe('2026-10-12');
    expect(weekStart('2026-10-12')).toBe('2026-10-12');
  });
  it('ISO hafta anahtarı', () => {
    expect(isoWeekKey('2026-10-12')).toBe('2026-W42');
    expect(isoWeekKey('2026-10-18')).toBe('2026-W42');
    expect(isoWeekKey('2027-01-01')).toBe('2026-W53');
  });
  it('uyku gece yarısını geçer', () => {
    expect(sleepMinutes('00:10', '07:05')).toBe(415);
    expect(sleepMinutes('23:30', '07:00')).toBe(450);
  });
});

describe('rutinler', () => {
  it('duraklatılan rutin görünmez', () => {
    expect(isActive(tr({}))).toBe(true);
    expect(isActive(tr({ paused: true }))).toBe(false);
  });
  it('gün seçimi', () => {
    expect(isScheduled(tr({ days: [0] }), '2026-10-18')).toBe(true);  // Pazar
    expect(isScheduled(tr({ days: [0] }), '2026-10-12')).toBe(false);
    expect(isScheduled(tr({}), '2026-10-12')).toBe(true);
  });
  it('"10 dakika bile sayılır" eşiği', () => {
    const t = tr({ type: 'duration', target: 60, doneAt: 10 });
    const day = (v: number): DayLog => ({ id: 'd', date: 'd', entries: { x: v } });
    expect(isDone(t, day(9), 'd', ctx)).toBe(false);
    expect(isDone(t, day(10), 'd', ctx)).toBe(true);
  });
  it('haftalık sayım (bilgi amaçlı)', () => {
    const t = tr({ id: 'a', weeklyTimes: 4 });
    const days: Record<string, DayLog> = {
      '2026-10-12': { id: '1', date: '2026-10-12', entries: { a: 1 } },
      '2026-10-14': { id: '2', date: '2026-10-14', entries: { a: 1 } },
      '2026-10-11': { id: '3', date: '2026-10-11', entries: { a: 1 } }, // önceki hafta
    };
    expect(weeklyCount(t, days, '2026-10-15', ctx)).toBe(2);
  });
  it('yapılan şey sayısı = rutinler + görevler', () => {
    const list = [tr({ id: 'a' }), tr({ id: 'b' })];
    const n = doneCount(list, { id: 'd', date: '2026-10-12', entries: { a: 1 } }, '2026-10-12',
      [task({ forDate: '2026-10-12', done: true }), task({ forDate: '2026-10-12' })], ctx);
    expect(n).toBe(2);
  });
  it('zincir: bugün boşsa kırılmaz', () => {
    const list = [tr({ id: 'a' })];
    const today = '2026-10-15';
    const days: Record<string, DayLog> = {};
    for (let i = 1; i <= 3; i++) { const d = addDays(today, -i); days[d] = { id: d, date: d, entries: { a: 1 } }; }
    expect(streak(list, days, today, [], ctx)).toBe(3);
    days[today] = { id: today, date: today, entries: { a: 1 } };
    expect(streak(list, days, today, [], ctx)).toBe(4);
  });
});

describe('görevler', () => {
  it('sıralama: yapılmayanlar → saatliler → yıldızlılar', () => {
    const list = [
      task({ id: 'done', done: true, time: '08:00' }),
      task({ id: 'plain', order: 0 }),
      task({ id: 'star', star: true, order: 1 }),
      task({ id: 'late', time: '18:00' }),
      task({ id: 'early', time: '09:00' }),
    ].sort(taskSort(4));
    expect(list.map((t) => t.id)).toEqual(['early', 'late', 'star', 'plain', 'done']);
  });
});

describe('şablonlar', () => {
  it('aynı şablon iki kez eklenirse kimlik çakışmaz', () => {
    const ids = new Set(['su']);
    expect(fromTemplate(TEMPLATES.find((t) => t.tid === 'su')!, ids, 0).id).toBe('su-2');
  });
  it('isimden kimlik üretir (Türkçe karakterler)', () => {
    expect(newTrackerId('Diş fırçala', new Set())).toBe('dis-fircala');
    expect(newTrackerId('Diş fırçala', new Set(['dis-fircala']))).toBe('dis-fircala-2');
  });
});

import { daysToNextStep, lastTime, limitFor, reduceStats } from './reduce';

describe('alışkanlık azaltma', () => {
  const plan = { start: 20, stepPerWeek: 2, floor: 0, startDate: '2026-10-12', unitPrice: 100, perPack: 20 };
  const sig = tr({ id: 's', type: 'counter', mode: 'reduce', reduce: plan });

  it('sınır her hafta azalır, tabanın altına inmez', () => {
    expect(limitFor(plan, '2026-10-12')).toBe(20);
    expect(limitFor(plan, '2026-10-18')).toBe(20);
    expect(limitFor(plan, '2026-10-19')).toBe(18);
    expect(limitFor(plan, '2027-06-01')).toBe(0);
    expect(limitFor({ ...plan, floor: 5 }, '2027-06-01')).toBe(5);
  });
  it('bir sonraki düşüşe kalan gün', () => {
    expect(daysToNextStep(plan, '2026-10-12')).toBe(7);
    expect(daysToNextStep(plan, '2026-10-18')).toBe(1);
    expect(daysToNextStep({ ...plan, stepPerWeek: 0 }, '2026-10-12')).toBeNull();
  });
  it('son zaman önceki günlere de bakar', () => {
    const days: Record<string, DayLog> = { '2026-10-12': { id: '1', date: '2026-10-12', times: { s: [100, 300] } } };
    expect(lastTime('s', days, '2026-10-13')).toBe(300);
    expect(lastTime('s', {}, '2026-10-13')).toBeNull();
  });
  it('kazanç, istekler ve tetikleyiciler', () => {
    const days: Record<string, DayLog> = {
      '2026-10-12': { id: '1', date: '2026-10-12', entries: { s: 15 }, urges: { s: 2 }, tags: { s: { Kahve: 3, Stres: 1 } } },
      '2026-10-13': { id: '2', date: '2026-10-13', entries: { s: 12 }, urges: { s: 1 }, tags: { s: { Kahve: 2 } } },
    };
    const st = reduceStats(sig, days, '2026-10-14');
    expect(st.saved).toBe(13);          // (20-15) + (20-12)
    expect(st.savedMoney).toBe(65);     // 13 × 5 ₺
    expect(st.urges).toBe(3);
    expect(st.triggers[0]).toEqual({ tag: 'Kahve', n: 5 });
    expect(st.bestStreakUnder).toBe(3); // bugün (henüz 0) + 2 gün
    // bitmemiş gün kazanca girmez
    expect(reduceStats(sig, days, '2026-10-13').saved).toBe(5);
    expect(st.series).toHaveLength(14);
  });
});

import { daySummary, weekSummary } from './review';

describe('gün ve hafta özeti', () => {
  const ders = tr({ id: 'ders', type: 'duration', target: 60, doneAt: 10 });
  const dis = tr({ id: 'dis' });
  const sig = tr({ id: 's', type: 'counter', mode: 'reduce', reduce: { start: 20, stepPerWeek: 2, floor: 0, startDate: '2026-10-05' } });
  const days: Record<string, DayLog> = {
    '2026-10-12': { id: 'a', date: '2026-10-12', entries: { ders: 30, dis: 1, s: 12 } },
    '2026-10-13': { id: 'b', date: '2026-10-13', entries: { ders: 15, s: 10 } },
    '2026-10-06': { id: 'c', date: '2026-10-06', entries: { s: 18 } },
  };
  const tasks = [
    task({ forDate: '2026-10-12', done: true, text: 'fatura' }),
    task({ forDate: '2026-10-12', text: 'rapor' }),
    task({ forDate: '', weekOf: '2026-10-12', text: 'bir ara' }),
    task({ forDate: '2026-10-20', text: 'gelecek hafta' }),
  ];
  const data = { trackers: [ders, dis, sig], days, tasks, ctx };

  it('gün özeti', () => {
    const s = daySummary('2026-10-12', data);
    expect(s.doneTasks.map((t) => t.text)).toEqual(['fatura']);
    expect(s.openTasks.map((t) => t.text)).toEqual(['rapor']);
    expect(s.doneRoutines.map((t) => t.id)).toEqual(['ders', 'dis']);
    expect(s.durations[0].minutes).toBe(30);
    expect(s.reduce[0]).toMatchObject({ count: 12, limit: 18 });
  });
  it('hafta özeti', () => {
    const w = weekSummary('2026-10-12', data, '2026-10-14');
    expect(w.openTasks.map((t) => t.text).sort()).toEqual(['bir ara', 'rapor']);
    expect(w.routines.find((r) => r.t.id === 'dis')).toMatchObject({ done: 1, planned: 3 });
    expect(w.durations[0].minutes).toBe(45);
    expect(w.reduce[0]).toMatchObject({ avg: 11, prevAvg: 18, days: 2 });
  });
});

describe('hafta özeti: bitmeyenler', () => {
  it('önümüzdeki günlerin görevleri sorulmaz', () => {
    const tasks = [task({ forDate: '2026-10-12', text: 'pzt' }), task({ forDate: '2026-10-15', text: 'per' }), task({ forDate: '2026-10-13', text: 'sal' })];
    const w = weekSummary('2026-10-12', { trackers: [], days: {}, tasks, ctx }, '2026-10-13');
    expect(w.openTasks.map((t) => t.text)).toEqual(['pzt']);
    const sunday = weekSummary('2026-10-12', { trackers: [], days: {}, tasks: [...tasks, task({ forDate: '2026-10-18', text: 'paz' })], ctx }, '2026-10-18');
    expect(sunday.openTasks.map((t) => t.text).sort()).toEqual(['paz', 'per', 'pzt', 'sal']);
  });
});

import { pendingInstances, ruleMatches } from './recurring';

describe('tekrarlayan görevler', () => {
  const base = { startDate: '2026-10-12', skips: [] as string[] };
  it('kural eşleşmeleri', () => {
    expect(ruleMatches({ ...base, repeat: 'weekdays' }, '2026-10-17')).toBe(false); // Cmt
    expect(ruleMatches({ ...base, repeat: 'weekdays' }, '2026-10-16')).toBe(true);
    expect(ruleMatches({ ...base, repeat: 'weekly' }, '2026-10-19')).toBe(true);    // başladığı gün (Pzt)
    expect(ruleMatches({ ...base, repeat: 'weekly', days: [3] }, '2026-10-14')).toBe(true);
    expect(ruleMatches({ ...base, repeat: 'monthly', monthDay: 31 }, '2026-11-30')).toBe(true);
    expect(ruleMatches({ ...base, repeat: 'daily' }, '2026-10-11')).toBe(false);   // başlamadan önce
    expect(ruleMatches({ ...base, repeat: 'daily', skips: ['2026-10-13'] }, '2026-10-13')).toBe(false);
  });
  it('çoğaltmadan üretir', () => {
    const rule = { id: 'r', text: 'Saha raporu', repeat: 'weekly' as const, days: [1], active: true, createdAt: 0, ...base };
    const first = pendingInstances([rule], [], '2026-10-12', 14);
    expect(first.map((x) => x.data.forDate)).toEqual(['2026-10-12', '2026-10-19']);
    const existing = first.map((x) => ({ id: x.id, ...x.data }));
    expect(pendingInstances([rule], existing, '2026-10-12', 14)).toHaveLength(0);
    expect(pendingInstances([{ ...rule, active: false }], [], '2026-10-12')).toHaveLength(0);
  });
});

import { bedMinutes, minutesByCourse, routineRates, weeklyStudy } from './stats';

describe('istatistik', () => {
  const dates = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-18', '2026-10-19'];
  it('rutin oranı planlanan günlere göre', () => {
    const t = tr({ id: 'a', days: [1, 3] }); // Pzt, Çar
    const days: Record<string, DayLog> = { '2026-10-12': { id: '1', date: '2026-10-12', entries: { a: 1 } } };
    const [r] = routineRates([t], days, dates, ctx);
    expect(r).toMatchObject({ done: 1, planned: 3 }); // 12, 14, 19
  });
  it('yatış saati gece yarısını düz çizer', () => {
    const days: Record<string, DayLog> = {
      '2026-10-12': { id: '1', date: '2026-10-12', sleep: { bed: '23:30', wake: '07:00' } },
      '2026-10-13': { id: '2', date: '2026-10-13', sleep: { bed: '00:30', wake: '07:00' } },
    };
    const [a, b] = bedMinutes(days, ['2026-10-12', '2026-10-13']);
    expect(b.value! - a.value!).toBe(60);
  });
  it('haftalık çalışma: rutin + rutine bağlı olmayan oturumlar, çift sayım yok', () => {
    const study = tr({ id: 's', type: 'duration' });
    const days: Record<string, DayLog> = { '2026-10-13': { id: '1', date: '2026-10-13', entries: { s: 40 } } };
    const sessions = [
      { id: 'x', trackerId: 's', courseId: 'c1', minutes: 40, date: '2026-10-13', createdAt: 0 },  // rutinle aynı süre
      { id: 'y', courseId: 'c2', minutes: 20, date: '2026-10-19', createdAt: 0 },
    ];
    expect(weeklyStudy(sessions, days, study, dates)).toEqual([{ week: '2026-10-12', minutes: 40 }, { week: '2026-10-19', minutes: 20 }]);
    expect(minutesByCourse(sessions, dates)).toEqual({ c1: 40, c2: 20 });
  });
});

import { weeklyLetter } from './letter';

describe('haftalık mektup', () => {
  it('yargısız, sadece olanı söyler', () => {
    const txt = weeklyLetter({
      name: 'Semih', doneTasks: 7, bestDay: { date: '2026-10-14', count: 4 },
      routines: [{ name: 'Diş fırçala', done: 6, planned: 7 }, { name: 'Spor', done: 0, planned: 2 }],
      sleepAvg: 410, reduce: [{ name: 'Sigara', unit: 'adet', avg: 12, prevAvg: 15 }], spent: 3450, topCategory: 'Market',
    });
    expect(txt).toContain('Merhaba Semih');
    expect(txt).toContain('7 görev');
    expect(txt).toContain('Diş fırçala: 6/7');
    expect(txt).not.toContain('Spor');            // yapılmayan öne çıkarılmaz
    expect(txt).toContain('azalıyor');
    expect(txt).toContain('3.450 ₺');
  });
  it('boş hafta suçlamaz', () => {
    expect(weeklyLetter({ doneTasks: 0, routines: [] })).toContain('Olur böyle haftalar');
  });
});
