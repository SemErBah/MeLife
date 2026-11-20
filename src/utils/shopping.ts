import type { ShopItem, ShopLine, ShopTrip } from '../types';

/** Ürün adlarını karşılaştırmak için: "  Süt " ile "süt" aynı ürün */
export const itemKey = (name: string) => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('tr-TR');

export interface PricePoint { date: string; store?: string; qty?: string; price: number }

export interface ItemStats {
  key: string;
  name: string;          // en son yazıldığı hali
  count: number;         // kaç alışverişte alındı
  history: PricePoint[]; // yeniden eskiye, yalnızca fiyatı girilenler
  last?: PricePoint;
  prev?: PricePoint;
  min?: number;
  max?: number;
  lastBought: string;
}

/** Geçmiş alışverişlerden ürün bazında fiyat geçmişi */
export function itemStats(trips: ShopTrip[]): Map<string, ItemStats> {
  const out = new Map<string, ItemStats>();
  const sorted = [...trips].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  for (const t of sorted) {
    for (const l of t.items) {
      const key = itemKey(l.name);
      if (!key) continue;
      let s = out.get(key);
      if (!s) { s = { key, name: l.name.trim(), count: 0, history: [], lastBought: t.date }; out.set(key, s); }
      s.count++;
      if (l.price != null && l.price > 0) s.history.push({ date: t.date, store: t.store, qty: l.qty, price: l.price });
    }
  }
  for (const s of out.values()) {
    [s.last, s.prev] = s.history;
    if (s.history.length) {
      const prices = s.history.map((h) => h.price);
      s.min = Math.min(...prices);
      s.max = Math.max(...prices);
    }
  }
  return out;
}

/** Son iki fiyat arasındaki değişim (%), yoksa null */
export function priceChange(s: ItemStats | undefined): number | null {
  if (!s?.last || !s.prev || s.last.qty !== s.prev.qty) return null;
  return Math.round(((s.last.price - s.prev.price) / s.prev.price) * 100);
}

/** Sık alınan ama şu an listede olmayan ürünler (öneri) */
export function frequentItems(stats: Map<string, ItemStats>, list: ShopItem[], limit = 8): ItemStats[] {
  const onList = new Set(list.map((i) => itemKey(i.name)));
  return [...stats.values()]
    .filter((s) => s.count >= 2 && !onList.has(s.key))
    .sort((a, b) => b.count - a.count || b.lastBought.localeCompare(a.lastBought))
    .slice(0, limit);
}

export const tripTotal = (items: ShopLine[]) => Math.round(items.reduce((a, l) => a + (l.price ?? 0), 0) * 100) / 100;

/** Daha önce gidilen yerler, en sık önce */
export function knownStores(trips: ShopTrip[]): string[] {
  const c = new Map<string, number>();
  for (const t of trips) if (t.store?.trim()) c.set(t.store.trim(), (c.get(t.store.trim()) ?? 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s);
}

const LEAD = /^(\d+(?:[.,]\d+)?\s*(?:kg|g|gr|gram|l|lt|litre|ml|adet|paket|pk|kutu|şişe|kavanoz|demet|tane|x)?\.?)\s+(.+)$/iu;

/** "2 kg domates" → { name: "domates", qty: "2 kg" }; sayı yoksa yalnızca ad */
export function parseEntry(raw: string): { name: string; qty?: string } {
  const text = raw.trim().replace(/\s+/g, ' ');
  const m = text.match(LEAD);
  return m ? { name: m[2], qty: m[1].replace(/\.$/, '') } : { name: text };
}
