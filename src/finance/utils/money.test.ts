import { describe, expect, it } from 'vitest';
import type { Cashflow, Transaction } from '../types';
import { diffEffect, effectOf, isSpending, mergeEffects } from './effects';
import { parseAmount } from './format';
import { allPeriods, currentPeriods, dueBills, expectedSalary, nextBillDate, shouldAskSalary, spentIn } from './period';

const tx = (p: Partial<Transaction>): Transaction => ({
  id: Math.random().toString(), amount: 100, category: 'Market', date: '2026-10-10', description: '', isIncome: false, ...p,
});
const cf = (p: Partial<Cashflow>): Cashflow => ({
  id: 'c', name: 'İnternet', amount: 450, type: 'expense', expectedDate: '12', isRecurring: true, createdAt: '2026-01-01', ...p,
});

describe('tutar ayrıştırma (Türkçe)', () => {
  it.each([
    ['1.250', 1250], ['1.250,50', 1250.5], ['12,5', 12.5], ['12.5', 12.5], ['1.250.000', 1250000], ['250', 250], ['₺ 300', 300],
  ])('%s → %d', (input, out) => expect(parseAmount(input)).toBe(out));
  it('boş → NaN', () => expect(parseAmount('')).toBeNaN());
});

describe('işlem etkisi', () => {
  it('hesaptan harcama hesabı azaltır', () => {
    expect(effectOf(tx({ assetId: 'a', amount: 50 })).assets).toEqual({ a: -50 });
  });
  it('kartla harcama kart borcunu artırır', () => {
    const e = effectOf(tx({ debtId: 'k', amount: 300 }));
    expect(e.debtTotal).toEqual({ k: 300 });
    expect(e.assets).toEqual({});
  });
  it('eski kayıt (kind yok) isIncome ile çalışır', () => {
    expect(effectOf(tx({ isIncome: true, assetId: 'a', amount: 70 })).assets).toEqual({ a: 70 });
  });
  it('maaş hesaba eklenir, harcamaya girmez', () => {
    const t = tx({ kind: 'salary', isIncome: true, assetId: 'a', amount: 40000 });
    expect(effectOf(t).assets).toEqual({ a: 40000 });
    expect(isSpending(t)).toBe(false);
  });
  it('kart ödemesi: hesap −, ödenen +', () => {
    const e = effectOf(tx({ kind: 'transfer', assetId: 'a', toDebtId: 'k', amount: 1000 }));
    expect(e.assets).toEqual({ a: -1000 });
    expect(e.debtPaid).toEqual({ k: 1000 });
  });
  it('kumbaraya aktar ve kumbaradan çek', () => {
    expect(effectOf(tx({ kind: 'transfer', assetId: 'a', toGoalId: 'g', amount: 200 }))).toMatchObject({ assets: { a: -200 }, goals: { g: 200 } });
    expect(effectOf(tx({ kind: 'transfer', fromGoalId: 'g', toAssetId: 'a', amount: 50 }))).toMatchObject({ assets: { a: 50 }, goals: { g: -50 } });
  });
  it('silme etkiyi geri alır', () => {
    const t = tx({ assetId: 'a', amount: 80 });
    expect(mergeEffects(effectOf(t), effectOf(t, -1)).assets).toEqual({});
  });
  it('düzenleme yalnızca farkı uygular', () => {
    const old = tx({ assetId: 'a', amount: 100 });
    expect(diffEffect(old, { ...old, amount: 130 }).assets).toEqual({ a: -30 });
    // hesap değişti: eskiye iade, yeniden düş
    expect(diffEffect(old, { ...old, assetId: 'b' }).assets).toEqual({ a: 100, b: -100 });
    // hesaptan karta taşındı
    expect(diffEffect(old, { ...old, assetId: undefined, debtId: 'k' })).toMatchObject({ assets: { a: 100 }, debtTotal: { k: 100 } });
  });
});

describe('maaş dönemi', () => {
  const txs = [
    tx({ kind: 'salary', isIncome: true, date: '2026-08-14', amount: 38000 }),
    tx({ kind: 'salary', isIncome: true, date: '2026-09-16', amount: 41000 }),
    tx({ kind: 'salary', isIncome: true, date: '2026-10-13', amount: 40000 }),
    tx({ date: '2026-10-12', amount: 500 }),
    tx({ date: '2026-10-13', amount: 200 }),
    tx({ date: '2026-10-14', amount: 300 }),
    tx({ kind: 'transfer', assetId: 'a', toGoalId: 'g', date: '2026-10-14', amount: 1000 }),
  ];
  it('dönem son maaştan başlar (değişken gün)', () => {
    const { current, previous } = currentPeriods(txs, '2026-10-20');
    expect(current).toEqual({ start: '2026-10-13', end: '2026-10-20', bySalary: true });
    expect(previous).toMatchObject({ start: '2026-09-16', end: '2026-10-12' });
    expect(spentIn(txs, current)).toBe(500); // transfer girmez
  });
  it('maaş yoksa takvim ayı', () => {
    expect(currentPeriods([], '2026-10-20').current).toEqual({ start: '2026-10-01', end: '2026-10-20', bySalary: false });
  });
  it('dönem listesi yeniden eskiye', () => {
    const ps = allPeriods(txs, '2026-10-20');
    expect(ps.slice(0, 3).map((p) => p.start)).toEqual(['2026-10-13', '2026-09-16', '2026-08-14']);
    expect(ps[1].end).toBe('2026-10-12');
  });
  it('sonraki maaş tahmini ortalama aralıktan', () => {
    // aralıklar 33 ve 27 → ort. 30
    expect(expectedSalary(txs, '2026-10-20')).toBe('2026-11-12');
  });
  it('maaş sorusu: yeni girildiyse sorma, tahmine yaklaşınca sor', () => {
    expect(shouldAskSalary(txs, '2026-10-20')).toBe(false);
    expect(shouldAskSalary(txs, '2026-11-11')).toBe(true);
    expect(shouldAskSalary([], '2026-10-20')).toBe(false);          // ipucu yok
    expect(shouldAskSalary([], '2026-10-20', 15)).toBe(true);       // ipucu günü geçti
    expect(shouldAskSalary([], '2026-10-05', 15)).toBe(false);
  });
});

describe('abonelik & faturalar', () => {
  it('günü gelen ve ödenmemiş olan sorulur', () => {
    expect(dueBills([cf({})], '2026-10-12')).toHaveLength(1);
    expect(dueBills([cf({})], '2026-10-11')).toHaveLength(0);
    expect(dueBills([cf({ lastPaidPeriod: '2026-10' })], '2026-10-20')).toHaveLength(0);
    expect(dueBills([cf({ skippedUntil: '2026-10-21' })], '2026-10-20')).toHaveLength(0);
    expect(dueBills([cf({ skippedUntil: '2026-10-20' })], '2026-10-20')).toHaveLength(1);
  });
  it('eski otomatik işlem bu ayı kapatmış sayılır', () => {
    expect(dueBills([cf({ lastProcessedDate: '2026-10-12' })], '2026-10-20')).toHaveLength(0);
  });
  it('ayın 31i kısa ayda son güne kayar', () => {
    expect(dueBills([cf({ expectedDate: '31' })], '2026-11-30')[0].due).toBe('2026-11-30');
  });
  it('sıradaki tarih', () => {
    expect(nextBillDate(cf({}), '2026-10-05')).toBe('2026-10-12');
    expect(nextBillDate(cf({ lastPaidPeriod: '2026-10' }), '2026-10-20')).toBe('2026-11-12');
  });
});
