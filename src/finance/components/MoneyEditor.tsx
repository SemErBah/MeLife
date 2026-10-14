import { Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Segmented } from '../../components/ui';
import { run, undoToast } from '../../store/useUI';
import { EXPENSE_CATEGORIES } from '../constants';
import { useFinance, type TxInput } from '../store/useFinance';
import { useMoneySheets } from '../store/useMoneySheets';
import type { Transaction, TransactionCategory } from '../types';
import { txKind } from '../utils/effects';
import { financeToday, fmt, parseAmount } from '../utils/format';
import { AmountBig, CatIcon, Chips, DateField } from './kit';
import { splitRef, useSourceOptions } from './kitHooks';

type Kind = 'expense' | 'income' | 'transfer';
const LAST_SOURCE = 'melife-last-source';
const readLast = () => { try { return localStorage.getItem(LAST_SOURCE) || ''; } catch { return ''; } };

/** Tek editör: harcama / gelir (maaş) / transfer — ekleme ve düzenleme */
export default function MoneyEditor({ id, preset }: { id?: string; preset?: Partial<Transaction> }) {
  const { transactions, saveTransaction, removeTransaction } = useFinance();
  const close = useMoneySheets((s) => s.close);
  const existing = id ? transactions.find((t) => t.id === id) : undefined;
  const base: Partial<Transaction> = existing ?? preset ?? {};
  const baseKind = txKind({ kind: base.kind, isIncome: !!base.isIncome });
  const opts = useSourceOptions();

  const [kind, setKind] = useState<Kind>(baseKind === 'salary' ? 'income' : baseKind);
  const [isSalary, setIsSalary] = useState(baseKind === 'salary');
  const [amount, setAmount] = useState(base.amount ? String(base.amount).replace('.', ',') : '');
  const [category, setCategory] = useState<TransactionCategory>(base.category && base.category !== 'Gelir' ? base.category : 'Market');
  const [date, setDate] = useState(base.date ?? financeToday());
  const [desc, setDesc] = useState(base.description ?? '');
  // Kaynak/hedef referansları: 'a:id' hesap, 'd:id' kart/borç, 'g:id' kumbara
  const [from, setFrom] = useState(() => {
    if (base.fromGoalId) return `g:${base.fromGoalId}`;
    if (base.debtId) return `d:${base.debtId}`;
    if (base.assetId) return `a:${base.assetId}`;
    const last = readLast();
    return [...opts.accounts, ...opts.cards].some((o) => o.value === last) ? last : '';
  });
  const [to, setTo] = useState(() =>
    base.toAssetId ? `a:${base.toAssetId}` : base.toDebtId ? `d:${base.toDebtId}` : base.toGoalId ? `g:${base.toGoalId}` : '');

  // Sık kullanılan kategoriler önde
  const cats = useMemo(() => {
    const freq: Record<string, number> = {};
    transactions.slice(-80).forEach((t) => { freq[t.category] = (freq[t.category] ?? 0) + 1; });
    return [...EXPENSE_CATEGORIES].sort((a, b) => (freq[b] ?? 0) - (freq[a] ?? 0));
  }, [transactions]);

  const value = parseAmount(amount);
  const valid = value > 0 && (kind !== 'transfer' || (from && to && from !== to));

  const build = (): TxInput => {
    const f = splitRef(from);
    const t = splitRef(to);
    if (kind === 'expense') {
      return {
        kind: 'expense', isIncome: false, category, amount: value, date, description: desc.trim(),
        ...(f.kind === 'd' ? { debtId: f.id } : f.kind === 'a' ? { assetId: f.id } : {}),
        ...(existing?.billId ? { billId: existing.billId } : {}),
      };
    }
    if (kind === 'income') {
      return {
        kind: isSalary ? 'salary' : 'income', isIncome: true, category: 'Gelir', amount: value, date,
        description: desc.trim() || (isSalary ? 'Maaş' : ''),
        ...(f.kind === 'a' ? { assetId: f.id } : {}),
      };
    }
    return {
      kind: 'transfer', isIncome: false, category: 'Diğer', amount: value, date, description: desc.trim(),
      ...(f.kind === 'g' ? { fromGoalId: f.id } : { assetId: f.id }),
      ...(t.kind === 'a' ? { toAssetId: t.id } : t.kind === 'd' ? { toDebtId: t.id } : { toGoalId: t.id }),
    };
  };

  const save = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!valid) return;
    const ok = await run(() => saveTransaction(build(), existing?.id), existing ? 'Güncellendi' : 'Kaydedildi');
    if (ok) {
      if (from && kind !== 'transfer') { try { localStorage.setItem(LAST_SOURCE, from); } catch { /* yok say */ } }
      close();
    }
  };

  const remove = async () => {
    if (!existing) return;
    const { id: _id, userId: _u, ...snapshot } = existing;
    if (await run(() => removeTransaction(existing.id))) {
      close();
      undoToast(`${fmt(existing.amount)} kaydı silindi`, () => saveTransaction(snapshot));
    }
  };

  return (
    <form onSubmit={save} className="space-y-5">
      <Segmented<Kind> value={kind} onChange={(k) => { setKind(k); setFrom(''); setTo(''); }} options={[
        { value: 'expense', label: 'Harcama' },
        { value: 'income', label: 'Gelir' },
        { value: 'transfer', label: 'Transfer' },
      ]} />

      <AmountBig value={amount} onChange={setAmount} autoFocus={!existing} />

      {kind === 'expense' && (
        <>
          <div>
            <p className="field-label">Kategori</p>
            <div className="grid grid-cols-4 gap-2">
              {cats.map((c) => (
                <button key={c} type="button" onClick={() => setCategory(c)} className={`chip-tile py-2.5 ${category === c ? 'active' : ''}`} aria-pressed={category === c}>
                  <CatIcon category={c} size={30} />
                  <span className="text-[11px] font-semibold truncate w-full text-center">{c}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="field-label">Nereden ödedin?</p>
            <Chips options={[...opts.accounts, ...opts.cards]} value={from} onChange={setFrom} allowEmpty="Belirtme" />
            {splitRef(from).kind === 'd' && <p className="text-[11px] text-text-muted mt-2">Kart borcuna eklenir.</p>}
          </div>
        </>
      )}

      {kind === 'income' && (
        <>
          <div className="flex gap-1.5">
            <button type="button" onClick={() => setIsSalary(false)} className={`pill ${!isSalary ? 'active' : ''}`}>Gelir</button>
            <button type="button" onClick={() => setIsSalary(true)} className={`pill ${isSalary ? 'active' : ''}`}>Maaş (yeni dönem başlar)</button>
          </div>
          <div>
            <p className="field-label">Hangi hesaba?</p>
            <Chips options={opts.accounts} value={from} onChange={setFrom} allowEmpty="Belirtme" />
          </div>
        </>
      )}

      {kind === 'transfer' && (
        <>
          <div>
            <p className="field-label">Nereden?</p>
            <Chips options={[...opts.accounts, ...opts.goals]} value={from} onChange={setFrom} />
          </div>
          <div>
            <p className="field-label">Nereye?</p>
            <Chips options={[...opts.accounts, ...opts.allDebts, ...opts.goals].filter((o) => o.value !== from)} value={to} onChange={setTo} />
            {splitRef(to).kind === 'd' && <p className="text-[11px] text-text-muted mt-2">Borç/kart ödemesi olarak kaydedilir.</p>}
          </div>
          {(opts.accounts.length + opts.goals.length) < 2 && (
            <p className="text-xs text-text-muted">Transfer için en az iki hesap ya da bir hesap + kumbara gerekir.</p>
          )}
        </>
      )}

      <div>
        <p className="field-label">Tarih</p>
        <DateField value={date} onChange={setDate} />
      </div>

      <input className="input" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={kind === 'expense' ? 'Not (isteğe bağlı): Migros, kahve…' : 'Not (isteğe bağlı)'} maxLength={80} />

      <div className="space-y-2">
        <button type="submit" disabled={!valid} className="btn btn-primary w-full">{existing ? 'Kaydet' : 'Ekle'}</button>
        {existing && <button type="button" onClick={remove} className="btn btn-ghost w-full"><Trash2 size={16} /> Sil</button>}
      </div>
    </form>
  );
}
