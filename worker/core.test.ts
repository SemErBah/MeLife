import { describe, expect, it } from 'vitest';
import type { Settings, Task, Tracker } from '../src/types';
import { doneValue, inWindow, isQuiet, istanbulClock, parseAction, planUserMessages, type UserInput } from './core';

const S = (p: Partial<Settings> = {}): Settings => ({ onboarded: true, dayStartHour: 4, theme: 'dark', startDate: '2026-10-01', showStreak: false, ...p });
const tr = (p: Partial<Tracker>): Tracker => ({ id: 'dis', name: 'Diş fırçala', icon: 'brush', category: 'order', type: 'check', order: 0, active: true, reminders: [{ time: '07:15', on: true }], ...p });

// 2026-10-14 Çarşamba, İstanbul 07:17 (UTC+3 → 04:17Z)
const clock = istanbulClock(new Date('2026-10-14T04:17:00Z'));
const base = (p: Partial<UserInput> = {}): UserInput => ({
  settings: S(), trackers: [tr({})], tasks: [], cashflows: [], transactions: [], snoozes: [],
  clock, fromMin: 7 * 60 + 12, appUrl: 'https://melife-app.web.app', ...p,
});

describe('İstanbul saati', () => {
  it('mantıksal gün 04:00 sınırı', () => {
    expect(clock).toMatchObject({ date: '2026-10-14', minutes: 437, weekday: 3 });
    const night = istanbulClock(new Date('2026-10-14T22:30:00Z')); // 01:30 İst
    expect(night).toMatchObject({ realDate: '2026-10-15', date: '2026-10-14', minutes: 90 });
  });
  it('pencere ve sessiz saat gece yarısını geçer', () => {
    expect(inWindow(5, 1430, 10)).toBe(true);
    expect(inWindow(1435, 1430, 10)).toBe(true);
    expect(inWindow(20, 1430, 10)).toBe(false);
    expect(isQuiet({ quietStart: '00:30', quietEnd: '07:00' }, 60)).toBe(true);
    expect(isQuiet({ quietStart: '00:30', quietEnd: '07:00' }, 7 * 60)).toBe(false);
  });
});

describe('anımsatıcı planı', () => {
  it('zamanı gelmiş ve yapılmamış rutini sorar', () => {
    const m = planUserMessages(base());
    expect(m).toHaveLength(1);
    expect(m[0].text).toBe('Diş fırçala yaptın mı?');
    expect(m[0].buttons?.[0][0].data).toBe('d|dis|2026-10-14');
  });
  it('kendi mesajını kullanır', () => {
    const m = planUserMessages(base({ trackers: [tr({ reminders: [{ time: '07:15', on: true, message: 'Dişlerini fırçaladın mı? 🙂' }] })] }));
    expect(m[0].text).toBe('Dişlerini fırçaladın mı? 🙂');
  });
  it('yapıldıysa, kapalıysa, pencere dışıysa sormaz', () => {
    expect(planUserMessages(base({ day: { id: 'd', date: '2026-10-14', entries: { dis: 1 } } }))).toHaveLength(0);
    expect(planUserMessages(base({ trackers: [tr({ reminders: [{ time: '07:15', on: false }] })] }))).toHaveLength(0);
    expect(planUserMessages(base({ fromMin: 7 * 60 + 15 }))).toHaveLength(0);
    expect(planUserMessages(base({ trackers: [tr({ paused: true })] }))).toHaveLength(0);
    expect(planUserMessages(base({ skipped: ['dis'] }))).toHaveLength(0);
  });
  it('bugün dokunma, sessiz saat ve odak modu', () => {
    expect(planUserMessages(base({ settings: S({ pauseDate: '2026-10-14' }) }))).toHaveLength(0);
    expect(planUserMessages(base({ settings: S({ quietStart: '00:30', quietEnd: '07:30' }) }))).toHaveLength(0);
    expect(planUserMessages(base({ settings: S({ focusUntil: '2026-10-20' }) }))).toHaveLength(0);
    expect(planUserMessages(base({ settings: S({ focusUntil: '2026-10-20' }), trackers: [tr({ focus: true })] }))).toHaveLength(1);
  });
  it('saatli görev X dk önce', () => {
    const task: Task = { id: 'g', text: 'Saha: Kemalpaşa', forDate: '2026-10-14', time: '07:30', remindBefore: 15, done: false, order: 0, createdAt: 0 };
    const m = planUserMessages(base({ trackers: [], tasks: [task] }));
    expect(m[0].text).toContain('Saha: Kemalpaşa');
    expect(m[0].buttons?.[0][0].data).toBe('t|g');
  });
  it('planlama ve para soruları', () => {
    const m = planUserMessages(base({
      trackers: [], settings: S({ planning: { morning: '07:15' } }),
      clock: istanbulClock(new Date('2026-10-14T07:02:00Z')), fromMin: 9 * 60 + 57, // 10:02
      cashflows: [{ id: 'c', name: 'İnternet', amount: 450, type: 'expense', expectedDate: '12', isRecurring: true, createdAt: '' }],
    }));
    expect(m.map((x) => x.key)).toEqual(['b_c_2026-10_2026-10-14']);
  });
});

describe('düğmeler', () => {
  it('ayrıştırma', () => {
    expect(parseAction('d|dis|2026-10-14')).toEqual({ kind: 'done', trackerId: 'dis', date: '2026-10-14' });
    expect(parseAction('t|g')).toEqual({ kind: 'task', taskId: 'g' });
    expect(parseAction('x')).toBeNull();
  });
  it('"Evet" değeri türe göre', () => {
    expect(doneValue(tr({}), 0)).toBe(1);
    expect(doneValue(tr({ type: 'counter', step: 250 }), 500)).toBe(750);
    expect(doneValue(tr({ type: 'duration', doneAt: 10 }), 3)).toBe(10);
  });
});
