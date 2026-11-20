import { describe, expect, it } from 'vitest';
import type { ShopTrip } from '../types';
import { frequentItems, itemKey, itemStats, knownStores, parseEntry, priceChange, tripTotal } from './shopping';

const trip = (date: string, items: ShopTrip['items'], store?: string): ShopTrip => ({ id: date, date, store, items, total: tripTotal(items), createdAt: 0 });

const trips = [
  trip('2026-11-01', [{ name: 'Süt', qty: '1 L', price: 40 }, { name: 'Ekmek', price: 15 }], 'Migros'),
  trip('2026-11-10', [{ name: ' süt ', qty: '1 L', price: 44 }, { name: 'Yumurta', qty: '10', price: 90 }], 'A101'),
  trip('2026-11-15', [{ name: 'Ekmek' }], 'Migros'),
];

describe('alışveriş', () => {
  it('ürünleri adına göre birleştirir, son fiyatı ve değişimi bulur', () => {
    expect(itemKey('  Süt  Tozu ')).toBe('süt tozu');
    const s = itemStats(trips).get('süt')!;
    expect(s.count).toBe(2);
    expect(s.last).toEqual({ date: '2026-11-10', store: 'A101', qty: '1 L', price: 44 });
    expect([s.min, s.max]).toEqual([40, 44]);
    expect(priceChange(s)).toBe(10);
  });
  it('fiyatsız alım sayılır ama fiyat geçmişine girmez', () => {
    const e = itemStats(trips).get('ekmek')!;
    expect(e.count).toBe(2);
    expect(e.lastBought).toBe('2026-11-15');
    expect(e.last?.price).toBe(15);
    expect(priceChange(e)).toBeNull();
  });
  it('farklı miktarlar karşılaştırılmaz', () => {
    const s = itemStats([trip('2026-11-01', [{ name: 'Su', qty: '1', price: 10 }]), trip('2026-11-02', [{ name: 'Su', qty: '6', price: 50 }])]).get('su');
    expect(priceChange(s)).toBeNull();
  });
  it('sık alınanları listede yoksa önerir', () => {
    const stats = itemStats(trips);
    expect(frequentItems(stats, []).map((s) => s.key)).toEqual(['ekmek', 'süt']);
    expect(frequentItems(stats, [{ id: 'x', name: 'SÜT', createdAt: 0 }]).map((s) => s.key)).toEqual(['ekmek']);
  });
  it('toplam ve mağazalar', () => {
    expect(tripTotal([{ name: 'a', price: 10.1 }, { name: 'b', price: 0.2 }, { name: 'c' }])).toBe(10.3);
    expect(knownStores(trips)).toEqual(['Migros', 'A101']);
  });
});

describe('ürün girişi', () => {
  it('baştaki miktarı ayırır', () => {
    expect(parseEntry('2 kg domates')).toEqual({ name: 'domates', qty: '2 kg' });
    expect(parseEntry('3 süt')).toEqual({ name: 'süt', qty: '3' });
    expect(parseEntry('1,5 lt ayran')).toEqual({ name: 'ayran', qty: '1,5 lt' });
    expect(parseEntry('  ekmek  ')).toEqual({ name: 'ekmek' });
    expect(parseEntry('7up')).toEqual({ name: '7up' });
  });
});
