import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EXPENSE_CATEGORIES } from '../constants';
import { useFinance } from '../store/useFinance';
import { useMoneySheets } from '../store/useMoneySheets';
import { isIncomeLike, isSpending } from '../utils/effects';
import { financeToday, fmt, parseDate } from '../utils/format';
import { allPeriods, inPeriod } from '../utils/period';
import { Chips, TxRow } from './kit';

const fmtDay = (d: string) => parseDate(d).toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtShort = (d: string) => parseDate(d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });

/** Tam işlem listesi: dönem dönem (maaştan maaşa), arama, kategori */
export default function AllTx() {
  const { transactions } = useFinance();
  const close = useMoneySheets((s) => s.close);
  const today = financeToday();
  const periods = useMemo(() => allPeriods(transactions, today), [transactions, today]);
  const [i, setI] = useState(0);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const p = periods[Math.min(i, periods.length - 1)];

  const list = transactions
    .filter((t) => inPeriod(t.date, p))
    .filter((t) => !cat || t.category === cat)
    .filter((t) => !q.trim() || `${t.description} ${t.category}`.toLocaleLowerCase('tr-TR').includes(q.trim().toLocaleLowerCase('tr-TR')))
    .sort((a, b) => b.date.localeCompare(a.date));
  const spent = list.filter(isSpending).reduce((s, t) => s + t.amount, 0);
  const income = list.filter(isIncomeLike).reduce((s, t) => s + t.amount, 0);
  const groups = list.reduce<{ date: string; items: typeof list }[]>((acc, t) => {
    const last = acc[acc.length - 1];
    if (last?.date === t.date) last.items.push(t); else acc.push({ date: t.date, items: [t] });
    return acc;
  }, []);

  return (
    <div className="fixed inset-0 z-[950] bg-base overflow-y-auto" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }} role="dialog" aria-modal="true" aria-label="Tüm işlemler">
      <div className="max-w-2xl mx-auto px-5 pt-4 pb-16 space-y-5">
        <div className="flex items-center justify-between">
          <button onClick={() => setI(Math.min(i + 1, periods.length - 1))} disabled={i >= periods.length - 1} className="icon-btn text-text-muted hover:bg-surface-el rounded-full disabled:opacity-30" aria-label="Önceki dönem"><ChevronLeft size={20} /></button>
          <div className="text-center">
            <p className="eyebrow">{p.bySalary ? 'Maaş dönemi' : 'Ay'}</p>
            <p className="font-semibold num">{fmtShort(p.start)} – {fmtShort(p.end)}</p>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setI(Math.max(i - 1, 0))} disabled={i === 0} className="icon-btn text-text-muted hover:bg-surface-el rounded-full disabled:opacity-30" aria-label="Sonraki dönem"><ChevronRight size={20} /></button>
            <button onClick={close} className="icon-btn text-text-muted hover:bg-surface-el rounded-full" aria-label="Kapat"><X size={20} /></button>
          </div>
        </div>

        <h1 className="page-title">İşlemler</h1>
        <p className="text-sm text-text-muted -mt-3">Harcanan <b className="text-text-main num">{fmt(spent)}</b>{income > 0 && <> · gelen <b className="text-accent num">{fmt(income)}</b></>}</p>

        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
          <input type="search" className="input pl-11" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ara: kahve, kira…" />
        </div>
        <Chips options={[...EXPENSE_CATEGORIES, 'Gelir'].map((c) => ({ value: c, label: c }))} value={cat} onChange={setCat} allowEmpty="Hepsi" />

        {groups.length === 0 ? (
          <p className="text-sm text-text-muted text-center py-16">Bu dönemde {q || cat ? 'eşleşen ' : ''}kayıt yok.</p>
        ) : groups.map((g) => {
          const daySpent = g.items.filter(isSpending).reduce((s, t) => s + t.amount, 0);
          return (
            <div key={g.date}>
              <div className="flex justify-between px-1 mb-1">
                <p className="text-xs font-semibold text-text-muted capitalize">{fmtDay(g.date)}</p>
                {daySpent > 0 && <p className="text-xs text-text-muted num">−{fmt(daySpent)}</p>}
              </div>
              <div className="widget px-1 py-1">{g.items.map((t) => <TxRow key={t.id} tx={t} />)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
