import { Check, Plus, Receipt, Search, ShoppingCart, Trash2, TrendingDown, TrendingUp, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import Modal from '../../components/Modal';
import { Field, Segmented, Toggle } from '../../components/ui';
import { useMoneySheets } from '../../finance/store/useMoneySheets';
import { fmt, parseAmount } from '../../finance/utils/format';
import { useStore } from '../../store/useStore';
import { confirmAction, run, undoToast } from '../../store/useUI';
import type { ShopItem, ShopLine, ShopTrip } from '../../types';
import { fromKey, shortDate } from '../../utils/date';
import { frequentItems, itemKey, itemStats, knownStores, parseEntry, priceChange, tripTotal, type ItemStats } from '../../utils/shopping';

type Tab = 'list' | 'history' | 'prices';
type Checkout = { tripId?: string; lines: ShopLine[]; removeIds: string[] } | null;

const stamp = () => Date.now();
const fmtMonth = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' });

/** Alışveriş listesi, geçmiş alışverişler ve ürün fiyatları */
export default function Shopping() {
  const trips = useStore((s) => s.shopTrips);
  const [tab, setTab] = useState<Tab>('list');
  const [checkout, setCheckout] = useState<Checkout>(null);
  const stats = useMemo(() => itemStats(trips), [trips]);

  return (
    <div className="space-y-5">
      <Segmented value={tab} onChange={setTab} options={[
        { value: 'list', label: 'Liste' },
        { value: 'history', label: 'Geçmiş' },
        { value: 'prices', label: 'Fiyatlar' },
      ]} />
      {tab === 'list' && <ListView stats={stats} onCheckout={setCheckout} />}
      {tab === 'history' && <HistoryView onOpen={setCheckout} />}
      {tab === 'prices' && <PricesView stats={stats} />}

      <Modal isOpen={!!checkout} onClose={() => setCheckout(null)} title={checkout?.tripId ? 'Alışveriş' : 'Alışverişi kaydet'}>
        {checkout && <CheckoutForm key={checkout.tripId ?? 'new'} {...checkout} stats={stats} onDone={() => setCheckout(null)} />}
      </Modal>
    </div>
  );
}

/* ── Liste ─────────────────────────────────────────────── */

function ListView({ stats, onCheckout }: { stats: Map<string, ItemStats>; onCheckout: (c: Checkout) => void }) {
  const { shopping, saveItem } = useStore();
  const [text, setText] = useState('');
  const [edit, setEdit] = useState<string | null>(null);
  const open = shopping.filter((i) => !i.done);
  const inCart = shopping.filter((i) => i.done);
  const suggestions = useMemo(() => frequentItems(stats, shopping), [stats, shopping]);

  const add = async (raw: string) => {
    const { name, qty } = parseEntry(raw);
    if (!name) return;
    if (shopping.some((i) => !i.done && itemKey(i.name) === itemKey(name))) { setText(''); return; }
    if (await run(() => saveItem<ShopItem>('shopping', { name, ...(qty ? { qty } : {}), createdAt: stamp() }))) setText('');
  };

  const finish = () => onCheckout({
    lines: inCart.map((i) => ({ name: i.name, ...(i.qty ? { qty: i.qty } : {}), ...(lastPriceFor(stats, i) ? { price: lastPriceFor(stats, i) } : {}) })),
    removeIds: inCart.map((i) => i.id),
  });

  return (
    <div className="space-y-5">
      <form onSubmit={(e) => { e.preventDefault(); add(text); }} className="flex gap-2">
        <input className="input flex-1" value={text} onChange={(e) => setText(e.target.value)} placeholder="Ör: 2 kg domates" list="shop-names" aria-label="Listeye ekle" />
        <button type="submit" disabled={!text.trim()} className="btn btn-primary px-4" aria-label="Ekle"><Plus size={18} /></button>
        <datalist id="shop-names">{[...stats.values()].map((s) => <option key={s.key} value={s.name} />)}</datalist>
      </form>

      {suggestions.length > 0 && (
        <div>
          <p className="field-label">Sık aldıkların</p>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((s) => <button key={s.key} onClick={() => add(s.name)} className="pill"><Plus size={12} /> {s.name}</button>)}
          </div>
        </div>
      )}

      {shopping.length === 0 ? (
        <p className="text-sm text-text-muted text-center py-8 max-w-xs mx-auto leading-relaxed">Liste boş. Aklına geleni yaz; markette aldıkça işaretle, sonunda fiyatlarıyla kaydet.</p>
      ) : (
        <section className="widget">
          <div className="px-2 py-2 sm:px-3">
            {open.map((i) => <ItemRow key={i.id} item={i} stats={stats.get(itemKey(i.name))} onEdit={() => setEdit(i.id)} />)}
            {inCart.length > 0 && (
              <>
                <p className="slot-label">Sepette</p>
                {inCart.map((i) => <ItemRow key={i.id} item={i} stats={stats.get(itemKey(i.name))} onEdit={() => setEdit(i.id)} />)}
              </>
            )}
          </div>
        </section>
      )}

      {inCart.length > 0 ? (
        <button onClick={finish} className="btn btn-primary w-full"><Receipt size={16} /> Alışverişi bitir ({inCart.length} ürün)</button>
      ) : open.length > 0 && (
        <p className="text-xs text-text-muted text-center">Aldıklarını işaretle; bitince fiyatlarıyla kaydedersin.</p>
      )}

      <Modal isOpen={!!edit} onClose={() => setEdit(null)} title="Ürün">
        {edit && <ItemForm key={edit} id={edit} stats={stats} onDone={() => setEdit(null)} />}
      </Modal>
    </div>
  );
}

const lastPriceFor = (stats: Map<string, ItemStats>, i: ShopItem) => {
  const s = stats.get(itemKey(i.name));
  return s?.last && (s.last.qty ?? '') === (i.qty ?? '') ? s.last.price : undefined;
};

function ItemRow({ item, stats, onEdit }: { item: ShopItem; stats?: ItemStats; onEdit: () => void }) {
  const saveItem = useStore((s) => s.saveItem);
  const change = priceChange(stats);
  return (
    <div className={`row-item ${item.done ? 'is-done' : ''}`}>
      <button
        onClick={() => run(() => saveItem<ShopItem>('shopping', { done: !item.done }, item.id))}
        className={`check-btn ${item.done ? 'done' : ''}`}
        aria-label={item.done ? `${item.name}: sepetten çıkar` : `${item.name}: sepete attım`}
        aria-pressed={!!item.done}
      >
        <Check size={18} strokeWidth={3} />
      </button>
      <button onClick={onEdit} className="flex-1 min-w-0 text-left min-h-0">
        <span className="block text-[15px] font-semibold truncate">{item.name}{item.qty && <span className="text-text-muted font-medium"> · {item.qty}</span>}</span>
        {stats?.last ? (
          <span className="flex items-center gap-1.5 text-xs text-text-muted">
            <span className="truncate">son <b className="text-text-main num">{fmt(stats.last.price)}</b>{stats.last.qty ? ` (${stats.last.qty})` : ''} · {[stats.last.store, shortDate(stats.last.date)].filter(Boolean).join(' · ')}</span>
            {change !== null && change !== 0 && <Trend pct={change} />}
          </span>
        ) : item.note ? <span className="block text-xs text-text-muted truncate">{item.note}</span> : null}
      </button>
    </div>
  );
}

function Trend({ pct }: { pct: number }) {
  const up = pct > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 font-semibold num shrink-0 ${up ? 'text-danger' : 'text-accent'}`}>
      {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}{up ? '+' : ''}{pct}%
    </span>
  );
}

function ItemForm({ id, stats, onDone }: { id: string; stats: Map<string, ItemStats>; onDone: () => void }) {
  const { shopping, saveItem, removeItem, restoreItem } = useStore();
  const item = shopping.find((i) => i.id === id);
  const [name, setName] = useState(item?.name ?? '');
  const [qty, setQty] = useState(item?.qty ?? '');
  const [note, setNote] = useState(item?.note ?? '');
  if (!item) return null;
  const s = stats.get(itemKey(item.name));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (await run(() => saveItem<ShopItem>('shopping', { name: name.trim(), qty: qty.trim(), note: note.trim() }, id), 'Kaydedildi')) onDone();
  };

  return (
    <form onSubmit={save} className="space-y-5">
      <div className="grid grid-cols-[1fr_110px] gap-3">
        <Field label="Ürün"><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Miktar"><input className="input" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="1 kg" /></Field>
      </div>
      <Field label="Not (isteğe bağlı)"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Marka, indirimli olan…" /></Field>
      {s && s.history.length > 0 && <PriceHistory s={s} />}
      <div className="space-y-2">
        <button type="submit" disabled={!name.trim()} className="btn btn-primary w-full">Kaydet</button>
        <button type="button" onClick={async () => {
          const snap = { ...item } as unknown as Record<string, unknown>;
          if (await run(() => removeItem('shopping', id))) { onDone(); undoToast('Listeden çıkarıldı', () => restoreItem('shopping', id, snap)); }
        }} className="btn btn-ghost w-full"><Trash2 size={16} /> Listeden çıkar</button>
      </div>
    </form>
  );
}

/* ── Alışverişi kaydet / düzenle ───────────────────────── */

function CheckoutForm({ tripId, lines: initial, removeIds, stats: allStats, onDone }: NonNullable<Checkout> & { stats: Map<string, ItemStats>; onDone: () => void }) {
  const { shopTrips, saveItem, removeItem, restoreItem } = useStore();
  // Eski bir alışverişi açınca "önceki fiyat" kendisi olmasın
  const stats = useMemo(() => (tripId ? itemStats(shopTrips.filter((t) => t.id !== tripId)) : allStats), [tripId, shopTrips, allStats]);
  const today = useStore((s) => s.today());
  const openMoney = useMoneySheets((s) => s.open);
  const trip = tripId ? shopTrips.find((t) => t.id === tripId) : undefined;
  const [date, setDate] = useState(trip?.date ?? today);
  const [store, setStore] = useState(trip?.store ?? '');
  const [rows, setRows] = useState(() => (trip?.items ?? initial).map((l) => ({ name: l.name, qty: l.qty ?? '', price: l.price != null ? String(l.price).replace('.', ',') : '' })));
  const [toMoney, setToMoney] = useState(removeIds.length > 0); // geçmiş alışveriş eklerken harcama zaten girilmiş olabilir
  const stores = useMemo(() => knownStores(shopTrips).slice(0, 6), [shopTrips]);

  const lines: ShopLine[] = rows.filter((r) => r.name.trim()).map((r) => {
    const p = parseAmount(r.price);
    return { name: r.name.trim(), ...(r.qty.trim() ? { qty: r.qty.trim() } : {}), ...(p > 0 ? { price: p } : {}) };
  });
  const total = tripTotal(lines);
  const setRow = (i: number, patch: Partial<(typeof rows)[number]>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lines.length) return;
    const data = { date, store: store.trim(), items: lines, total, ...(trip ? {} : { createdAt: stamp() }) };
    const ok = await run(async () => {
      await saveItem<ShopTrip>('shopTrips', data, tripId);
      await Promise.all(removeIds.map((id) => removeItem('shopping', id)));
    }, trip ? 'Kaydedildi' : 'Alışveriş kaydedildi');
    if (!ok) return;
    onDone();
    if (toMoney && total > 0) {
      openMoney({ t: 'editor', preset: { kind: 'expense', category: 'Market', amount: total, date, description: store.trim() ? `${store.trim()} alışverişi` : 'Alışveriş' } });
    }
  };

  return (
    <form onSubmit={save} className="space-y-5">
      <div className="grid grid-cols-[150px_1fr] gap-3">
        <Field label="Tarih"><input type="date" className="input num" value={date} max={today} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Nereden"><input className="input" value={store} onChange={(e) => setStore(e.target.value)} placeholder="Migros, pazar…" /></Field>
      </div>
      {stores.length > 0 && (
        <div className="flex flex-wrap gap-1.5 -mt-3">
          {stores.map((s) => <button type="button" key={s} onClick={() => setStore(s)} className={`pill ${store === s ? 'active' : ''}`}>{s}</button>)}
        </div>
      )}

      <div>
        <p className="field-label">Ürünler ve fiyatları</p>
        <div className="space-y-2">
          {rows.map((r, i) => {
            const s = stats.get(itemKey(r.name));
            return (
              <div key={i}>
                <div className="grid grid-cols-[1fr_72px_96px_auto] gap-1.5 items-center">
                  <input className="input" value={r.name} onChange={(e) => setRow(i, { name: e.target.value })} placeholder="Ürün" aria-label="Ürün" />
                  <input className="input" value={r.qty} onChange={(e) => setRow(i, { qty: e.target.value })} placeholder="Miktar" aria-label="Miktar" />
                  <input className="input num text-right" inputMode="decimal" value={r.price} onChange={(e) => setRow(i, { price: e.target.value })} placeholder="₺" aria-label={`${r.name || 'Ürün'} fiyatı`} />
                  <button type="button" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} className="icon-btn text-text-muted" aria-label="Satırı sil"><X size={16} /></button>
                </div>
                {s?.last && <p className="text-[11px] text-text-muted mt-0.5 pl-1">önceki: {fmt(s.last.price)}{s.last.qty ? ` (${s.last.qty})` : ''} · {shortDate(s.last.date)}{s.min !== s.max ? ` · en ucuz ${fmt(s.min!)}` : ''}</p>}
              </div>
            );
          })}
        </div>
        <button type="button" onClick={() => setRows((rs) => [...rs, { name: '', qty: '', price: '' }])} className="btn btn-ghost btn-sm mt-2"><Plus size={14} /> Ürün ekle</button>
        <p className="text-[11px] text-text-muted mt-2">Fiyat satırın toplamı (ör. 2 kg için ödediğin). Boş bırakabilirsin.</p>
      </div>

      <div className="flex items-baseline justify-between border-t border-border pt-4">
        <span className="text-sm text-text-muted">Toplam</span>
        <span className="font-display text-2xl font-semibold num">{fmt(total)}</span>
      </div>

      {!trip && total > 0 && (
        <div className="flex items-center justify-between gap-3">
          <span>
            <span className="block text-sm font-semibold">Para'ya harcama olarak da ekle</span>
            <span className="block text-[11px] text-text-muted">Kaydedince harcama ekranı Market kategorisiyle açılır; hesabı orada seçersin.</span>
          </span>
          <Toggle checked={toMoney} onChange={setToMoney} label="Para'ya harcama olarak da ekle" />
        </div>
      )}

      <div className="space-y-2">
        <button type="submit" disabled={!lines.length} className="btn btn-primary w-full">Kaydet</button>
        {trip && (
          <button type="button" onClick={async () => {
            if (!await confirmAction({ title: 'Bu alışveriş silinsin mi?', message: "Fiyat geçmişinden de çıkar. Para'daki harcama kaydı silinmez.", confirmLabel: 'Sil', danger: true })) return;
            const snap = { ...trip } as unknown as Record<string, unknown>;
            if (await run(() => removeItem('shopTrips', trip.id))) { onDone(); undoToast('Silindi', () => restoreItem('shopTrips', trip.id, snap)); }
          }} className="btn btn-ghost w-full"><Trash2 size={16} /> Sil</button>
        )}
      </div>
    </form>
  );
}

/* ── Geçmiş ────────────────────────────────────────────── */

function HistoryView({ onOpen }: { onOpen: (c: Checkout) => void }) {
  const trips = useStore((s) => s.shopTrips);
  const months = useMemo(() => trips.reduce<{ key: string; trips: ShopTrip[]; total: number }[]>((acc, t) => {
    const key = t.date.slice(0, 7);
    const last = acc[acc.length - 1];
    if (last?.key === key) { last.trips.push(t); last.total += t.total; } else acc.push({ key, trips: [t], total: t.total });
    return acc;
  }, []), [trips]);

  return (
    <div className="space-y-5">
      <button onClick={() => onOpen({ lines: [{ name: '' }], removeIds: [] })} className="btn btn-ghost w-full"><Plus size={16} /> Geçmiş bir alışveriş ekle</button>
      {months.length === 0 ? (
        <p className="text-sm text-text-muted text-center py-8 max-w-xs mx-auto leading-relaxed">Henüz kayıtlı alışveriş yok. Listeden "Alışverişi bitir" dediğinde burada görünür.</p>
      ) : months.map((m) => (
        <section key={m.key} className="widget">
          <div className="widget-header">
            <h3 className="capitalize">{fmtMonth.format(fromKey(`${m.key}-01`))}</h3>
            <span className="text-sm font-semibold num">{fmt(Math.round(m.total * 100) / 100)}</span>
          </div>
          <div className="px-2 pb-3 sm:px-3">
            {m.trips.map((t) => (
              <button key={t.id} onClick={() => onOpen({ tripId: t.id, lines: t.items, removeIds: [] })} className="row-item w-full text-left min-h-0">
                <span className="cat-bubble sm" style={{ '--c': 'var(--accent-base)' } as React.CSSProperties}><ShoppingCart size={16} /></span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] font-semibold truncate">{t.store || 'Alışveriş'}</span>
                  <span className="block text-xs text-text-muted truncate">{shortDate(t.date)} · {t.items.length} ürün · {t.items.slice(0, 4).map((l) => l.name).join(', ')}{t.items.length > 4 ? '…' : ''}</span>
                </span>
                <span className="text-sm font-semibold num shrink-0">{t.total ? fmt(t.total) : '–'}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/* ── Fiyatlar ──────────────────────────────────────────── */

function PricesView({ stats }: { stats: Map<string, ItemStats> }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const items = [...stats.values()]
    .filter((s) => s.history.length > 0 && (!q.trim() || s.key.includes(itemKey(q))))
    .sort((a, b) => b.lastBought.localeCompare(a.lastBought) || a.name.localeCompare(b.name, 'tr'));

  if (!stats.size) return <p className="text-sm text-text-muted text-center py-8 max-w-xs mx-auto leading-relaxed">Alışverişlerini fiyatlarıyla kaydettikçe her ürünün ne zaman, nereden, kaça alındığı burada birikir.</p>;

  return (
    <div className="space-y-4">
      <label className="relative block">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
        <input className="input pl-10" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ürün ara" aria-label="Ürün ara" />
      </label>
      <section className="widget">
        <div className="px-2 py-2 sm:px-3">
          {items.length === 0 && <p className="text-sm text-text-muted px-3 py-2">Eşleşen ürün yok.</p>}
          {items.map((s) => {
            const change = priceChange(s);
            return (
              <div key={s.key}>
                <button onClick={() => setOpen(open === s.key ? null : s.key)} className="row-item w-full text-left min-h-0" aria-expanded={open === s.key}>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[15px] font-semibold truncate">{s.name}</span>
                    <span className="block text-xs text-text-muted truncate">
                      {s.count} kez alındı{s.min !== s.max ? ` · ${fmt(s.min!)} – ${fmt(s.max!)}` : ''}
                    </span>
                  </span>
                  <span className="text-right shrink-0">
                    <span className="block text-sm font-semibold num">{fmt(s.last!.price)}</span>
                    <span className="block text-[11px] text-text-muted">{change !== null && change !== 0 ? <Trend pct={change} /> : shortDate(s.last!.date)}</span>
                  </span>
                </button>
                {open === s.key && <div className="px-3 pb-3"><PriceHistory s={s} /></div>}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function PriceHistory({ s }: { s: ItemStats }) {
  return (
    <div>
      <p className="field-label">Fiyat geçmişi</p>
      <ul className="space-y-1">
        {s.history.slice(0, 12).map((h, i) => (
          <li key={i} className="flex items-center justify-between text-sm gap-3">
            <span className="text-text-muted truncate">{shortDate(h.date)}{h.store ? ` · ${h.store}` : ''}{h.qty ? ` · ${h.qty}` : ''}</span>
            <span className={`num font-semibold shrink-0 ${h.price === s.min && s.min !== s.max ? 'text-accent' : ''}`}>{fmt(h.price)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
