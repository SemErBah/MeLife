import { Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Field, ProgressBar, Segmented } from '../../components/ui';
import { confirmAction, run, toast } from '../../store/useUI';
import { ASSET_TYPES, BANKS, DEBT_TYPES } from '../constants';
import { useFinance } from '../store/useFinance';
import { useMoneySheets } from '../store/useMoneySheets';
import type { AssetType, DebtType } from '../types';
import { debtRemaining, goalPlan, minPayment } from '../utils/finance';
import { daysLeftLabel, daysUntil, financeToday, fmt, parseAmount, parseDate, safePct } from '../utils/format';
import { AmountBig, Chips, DateField, TxRow } from './kit';
import { splitRef, useSourceOptions } from './kitHooks';

const QUANTITY_UNIT: Partial<Record<AssetType, string>> = { 'Altın': 'gram', 'Döviz': 'birim', 'Kripto': 'adet', 'Hisse': 'lot' };
const num = (s: string) => s.replace(/[^\d.,]/g, '');

/* ═══ Hesap ═════════════════════════════════════════════ */

export function AccountSheet({ id }: { id?: string }) {
  const { assets, transactions, addAsset, updateAsset, deleteAsset } = useFinance();
  const close = useMoneySheets((s) => s.close);
  const a = id ? assets.find((x) => x.id === id) : undefined;
  const [type, setType] = useState<AssetType>(a?.type ?? 'Banka Hesabı');
  const [bank, setBank] = useState(a?.bankName ?? 'Diğer');
  const [name, setName] = useState(a?.name ?? '');
  const [balance, setBalance] = useState(a ? String(a.currentValue).replace('.', ',') : '');
  const [qty, setQty] = useState(a && a.amount !== a.currentValue ? String(a.amount) : '');
  const unit = QUANTITY_UNIT[type];
  const recent = a ? transactions.filter((t) => [t.assetId, t.toAssetId].includes(a.id)).sort((x, y) => y.date.localeCompare(x.date)).slice(0, 5) : [];

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = parseAmount(balance || '0');
    if (!name.trim() || Number.isNaN(v)) return;
    const q = unit && qty ? parseAmount(qty) : v;
    const data = { name: name.trim(), type, bankName: bank, currentValue: v, amount: Number.isNaN(q) ? v : q };
    const ok = a
      ? await run(() => updateAsset(a.id, data), 'Güncellendi')
      : await run(() => addAsset({ ...data, dateAdded: new Date().toISOString() }), 'Hesap eklendi');
    if (ok) close();
  };

  const remove = async () => {
    if (!a) return;
    if (await confirmAction({ title: `"${a.name}" silinsin mi?`, message: 'Hesap silinir; geçmiş işlemler korunur.', confirmLabel: 'Sil', danger: true })
      && await run(() => deleteAsset(a.id), 'Silindi')) close();
  };

  return (
    <form onSubmit={save} className="space-y-5">
      <Field label="Adı"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={type === 'Altın' ? 'Gram altın' : 'Ör: Garanti vadesiz, cüzdan'} autoFocus={!a} /></Field>
      <div>
        <p className="field-label">Türü</p>
        <Chips options={ASSET_TYPES.map((t) => ({ value: t, label: t === 'Banka Hesabı' ? 'Banka' : t }))} value={type} onChange={(v) => setType(v as AssetType)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={unit ? 'Güncel değer (₺)' : 'Bakiye (₺)'}>
          <input className="input num text-lg font-bold" inputMode="decimal" value={balance} onChange={(e) => setBalance(num(e.target.value))} placeholder="0" />
        </Field>
        {unit
          ? <Field label={`Miktar (${unit})`}><input className="input num" inputMode="decimal" value={qty} onChange={(e) => setQty(num(e.target.value))} placeholder="—" /></Field>
          : <Field label="Kurum"><select className="input" value={bank} onChange={(e) => setBank(e.target.value)}>{BANKS.map((b) => <option key={b}>{b}</option>)}</select></Field>}
      </div>
      {a && <p className="text-[11px] text-text-muted -mt-2">Bakiyeyi elle düzeltmek işlem oluşturmaz; sadece rakamı günceller.</p>}

      {recent.length > 0 && (
        <div>
          <p className="field-label">Son hareketler</p>
          <div className="-mx-3">{recent.map((t) => <TxRow key={t.id} tx={t} />)}</div>
        </div>
      )}

      <div className="space-y-2">
        <button type="submit" disabled={!name.trim()} className="btn btn-primary w-full">{a ? 'Kaydet' : 'Ekle'}</button>
        {a && <button type="button" onClick={remove} className="btn btn-ghost w-full"><Trash2 size={16} /> Sil</button>}
      </div>
    </form>
  );
}

/* ═══ Borç / kredi kartı ════════════════════════════════ */

export function DebtSheet({ id }: { id?: string }) {
  const { debts } = useFinance();
  const d = id ? debts.find((x) => x.id === id) : undefined;
  const [editing, setEditing] = useState(!d);
  if (!d || editing) return <DebtForm id={d?.id} onCancel={d ? () => setEditing(false) : undefined} />;
  return <DebtView id={d.id} onEdit={() => setEditing(true)} />;
}

function DebtView({ id, onEdit }: { id: string; onEdit: () => void }) {
  const { debts, saveTransaction, deleteDebt } = useFinance();
  const close = useMoneySheets((s) => s.close);
  const opts = useSourceOptions();
  const d = debts.find((x) => x.id === id)!;
  const remaining = debtRemaining(d);
  const min = minPayment(d);
  const isCard = d.type === 'Kredi Kartı';
  const [amount, setAmount] = useState('');
  const [from, setFrom] = useState(opts.accounts[0]?.value ?? '');
  const [date, setDate] = useState(financeToday());
  const value = parseAmount(amount);

  const pay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!(value > 0)) return;
    const f = splitRef(from);
    const ok = await run(() => saveTransaction({
      kind: 'transfer', isIncome: false, category: 'Diğer', amount: value, date, description: '',
      ...(f.kind === 'a' ? { assetId: f.id } : {}), toDebtId: d.id,
    }));
    if (ok) {
      toast(value >= remaining ? `"${d.name}" kapandı 🎉` : 'Ödeme kaydedildi');
      close();
    }
  };

  const remove = async () => {
    if (await confirmAction({ title: `"${d.name}" silinsin mi?`, message: 'Borç kaydı silinir; geçmiş işlemler korunur.', confirmLabel: 'Sil', danger: true })
      && await run(() => deleteDebt(d.id), 'Silindi')) close();
  };

  const days = d.dueDate ? daysUntil(d.dueDate) : null;
  return (
    <form onSubmit={pay} className="space-y-5">
      <div className="text-center">
        <p className="text-xs text-text-muted">{[d.bankName !== 'Diğer' ? d.bankName : null, d.type].filter(Boolean).join(' · ')}</p>
        <p className="text-4xl font-extrabold num mt-1">{fmt(remaining)}</p>
        <p className="text-xs text-text-muted mt-1">kalan{d.dueDate && days !== null ? ` · son ödeme ${parseDate(d.dueDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })} (${daysLeftLabel(days).toLowerCase()})` : ''}</p>
        <div className="mt-4"><ProgressBar pct={safePct(d.paidAmount, d.totalAmount)} color="var(--accent-base)" height={6} /></div>
        <p className="text-[11px] text-text-muted mt-1.5">{fmt(d.paidAmount)} ödendi · toplam {fmt(d.totalAmount)}{d.interestRate ? ` · aylık faiz %${d.interestRate}` : ''}</p>
      </div>

      {remaining > 0 && (
        <>
          <AmountBig value={amount} onChange={setAmount} />
          <div className="flex gap-1.5 justify-center flex-wrap -mt-3">
            {isCard && min < remaining && <button type="button" onClick={() => setAmount(String(Math.ceil(min)))} className="pill">Asgari · {fmt(Math.ceil(min))}</button>}
            <button type="button" onClick={() => setAmount(String(remaining))} className="pill">Tamamı · {fmt(remaining)}</button>
          </div>
          <div>
            <p className="field-label">Hangi hesaptan?</p>
            <Chips options={opts.accounts} value={from} onChange={setFrom} allowEmpty="Belirtme" />
          </div>
          <div><p className="field-label">Tarih</p><DateField value={date} onChange={setDate} /></div>
          <button type="submit" disabled={!(value > 0)} className="btn btn-primary w-full">Ödemeyi kaydet</button>
        </>
      )}
      {isCard && <p className="text-[11px] text-text-muted text-center">Bu kartla yaptığın harcamaları "Nereden ödedin?" kısmında kartı seçerek girersen borç kendiliğinden artar.</p>}

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onEdit} className="btn btn-ghost"><Pencil size={15} /> Düzenle</button>
        <button type="button" onClick={remove} className="btn btn-ghost"><Trash2 size={15} /> Sil</button>
      </div>
    </form>
  );
}

function DebtForm({ id, onCancel }: { id?: string; onCancel?: () => void }) {
  const { debts, addDebt, updateDebt } = useFinance();
  const close = useMoneySheets((s) => s.close);
  const d = id ? debts.find((x) => x.id === id) : undefined;
  const [type, setType] = useState<DebtType>(d?.type ?? 'Kredi Kartı');
  const [name, setName] = useState(d?.name ?? '');
  const [bank, setBank] = useState(d?.bankName ?? 'Diğer');
  const [total, setTotal] = useState(d ? String(d.totalAmount) : '');
  const [paid, setPaid] = useState(d ? String(d.paidAmount) : '');
  const [interest, setInterest] = useState(d?.interestRate ? String(d.interestRate) : '');
  const [limit, setLimit] = useState(d?.cardLimit ? String(d.cardLimit) : '');
  const [due, setDue] = useState(d?.dueDate ?? '');
  const isCard = type === 'Kredi Kartı';

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const totalAmount = parseAmount(total || '0');
    if (!name.trim() || Number.isNaN(totalAmount)) return;
    const data = {
      name: name.trim(), type, bankName: bank, dueDate: due,
      totalAmount, paidAmount: parseAmount(paid || '0') || 0,
      interestRate: parseAmount(interest || '0') || 0,
      ...(isCard && limit ? { cardLimit: parseAmount(limit) } : {}),
    };
    const ok = d
      ? await run(() => updateDebt(d.id, data), 'Güncellendi')
      : await run(() => addDebt({ ...data, isPaidOff: totalAmount > 0 && data.paidAmount >= totalAmount, createdAt: new Date().toISOString() }), 'Eklendi');
    if (ok) (onCancel ?? close)();
  };

  return (
    <form onSubmit={save} className="space-y-5">
      <Chips options={DEBT_TYPES.map((t) => ({ value: t, label: t }))} value={type} onChange={(v) => setType(v as DebtType)} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Adı"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={isCard ? 'Bonus kart' : 'İhtiyaç kredisi'} autoFocus={!d} /></Field>
        <Field label="Kurum"><select className="input" value={bank} onChange={(e) => setBank(e.target.value)}>{BANKS.filter((b) => b !== 'Cüzdan (Nakit)').map((b) => <option key={b}>{b}</option>)}</select></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={isCard ? 'Güncel kart borcu' : 'Toplam borç'}><input className="input num text-lg font-bold" inputMode="decimal" value={total} onChange={(e) => setTotal(num(e.target.value))} placeholder="0" /></Field>
        <Field label="Ödenen"><input className="input num" inputMode="decimal" value={paid} onChange={(e) => setPaid(num(e.target.value))} placeholder="0" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Son ödeme tarihi"><input type="date" className="input" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
        <Field label="Aylık faiz % (isteğe bağlı)"><input className="input num" inputMode="decimal" value={interest} onChange={(e) => setInterest(num(e.target.value))} placeholder="—" /></Field>
      </div>
      {isCard && <Field label="Kart limiti (asgari ödeme için)"><input className="input num" inputMode="decimal" value={limit} onChange={(e) => setLimit(num(e.target.value))} placeholder="—" /></Field>}
      <div className="grid grid-cols-[auto_1fr] gap-2">
        {onCancel && <button type="button" onClick={onCancel} className="btn btn-ghost">Vazgeç</button>}
        <button type="submit" disabled={!name.trim()} className={`btn btn-primary ${onCancel ? '' : 'col-span-2'}`}>{d ? 'Kaydet' : 'Ekle'}</button>
      </div>
    </form>
  );
}

/* ═══ Kumbara ═══════════════════════════════════════════ */

export function GoalSheet({ id }: { id?: string }) {
  const { savingsGoals } = useFinance();
  const g = id ? savingsGoals.find((x) => x.id === id) : undefined;
  const [editing, setEditing] = useState(!g);
  if (!g || editing) return <GoalForm id={g?.id} onCancel={g ? () => setEditing(false) : undefined} />;
  return <GoalView id={g.id} onEdit={() => setEditing(true)} />;
}

function GoalView({ id, onEdit }: { id: string; onEdit: () => void }) {
  const { savingsGoals, saveTransaction, deleteSavingsGoal } = useFinance();
  const close = useMoneySheets((s) => s.close);
  const opts = useSourceOptions();
  const g = savingsGoals.find((x) => x.id === id)!;
  const [mode, setMode] = useState<'in' | 'out'>('in');
  const [amount, setAmount] = useState('');
  const [acc, setAcc] = useState(opts.accounts[0]?.value ?? '');
  const value = parseAmount(amount);
  const plan = goalPlan(g);
  const pct = safePct(g.currentAmount, g.targetAmount);

  const move = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!(value > 0)) return;
    const a = splitRef(acc).id || undefined;
    const ok = await run(() => saveTransaction(mode === 'in'
      ? { kind: 'transfer', isIncome: false, category: 'Diğer', amount: value, date: financeToday(), description: '', assetId: a, toGoalId: g.id }
      : { kind: 'transfer', isIncome: false, category: 'Diğer', amount: value, date: financeToday(), description: '', fromGoalId: g.id, toAssetId: a }));
    if (ok) {
      toast(mode === 'in' && g.currentAmount + value >= g.targetAmount ? `"${g.name}" hedefine ulaştın 🎉` : mode === 'in' ? 'Kumbaraya aktarıldı' : 'Kumbaradan çekildi');
      close();
    }
  };

  const remove = async () => {
    if (await confirmAction({ title: `"${g.name}" silinsin mi?`, message: 'Kumbara kaydı silinir.', confirmLabel: 'Sil', danger: true })
      && await run(() => deleteSavingsGoal(g.id), 'Silindi')) close();
  };

  return (
    <form onSubmit={move} className="space-y-5">
      <div className="text-center">
        <p className="text-4xl font-extrabold num">{fmt(g.currentAmount)}</p>
        <p className="text-xs text-text-muted mt-1">hedef {fmt(g.targetAmount)}{g.deadline ? ` · ${parseDate(g.deadline).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}</p>
        <div className="mt-4"><ProgressBar pct={pct} color="var(--accent-base)" height={6} /></div>
        {plan.remaining > 0 && (
          <p className="text-xs text-text-muted mt-2">
            {plan.monthlyNeeded !== null && plan.daysLeft !== null && plan.daysLeft >= 0
              ? `${fmt(plan.remaining)} kaldı · ayda ${fmt(Math.ceil(plan.monthlyNeeded))} ayırırsan yetişir`
              : `${fmt(plan.remaining)} kaldı`}
          </p>
        )}
      </div>
      <Segmented value={mode} onChange={setMode} options={[{ value: 'in', label: 'Aktar' }, { value: 'out', label: 'Çek' }]} />
      <AmountBig value={amount} onChange={setAmount} />
      <div>
        <p className="field-label">{mode === 'in' ? 'Hangi hesaptan?' : 'Hangi hesaba?'}</p>
        <Chips options={opts.accounts} value={acc} onChange={setAcc} allowEmpty="Belirtme" />
      </div>
      <button type="submit" disabled={!(value > 0) || (mode === 'out' && value > g.currentAmount)} className="btn btn-primary w-full">{mode === 'in' ? 'Aktar' : 'Çek'}</button>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onEdit} className="btn btn-ghost"><Pencil size={15} /> Düzenle</button>
        <button type="button" onClick={remove} className="btn btn-ghost"><Trash2 size={15} /> Sil</button>
      </div>
    </form>
  );
}

function GoalForm({ id, onCancel }: { id?: string; onCancel?: () => void }) {
  const { savingsGoals, addSavingsGoal, editSavingsGoal } = useFinance();
  const close = useMoneySheets((s) => s.close);
  const g = id ? savingsGoals.find((x) => x.id === id) : undefined;
  const [name, setName] = useState(g?.name ?? '');
  const [target, setTarget] = useState(g ? String(g.targetAmount) : '');
  const [deadline, setDeadline] = useState(g?.deadline ?? '');
  const t = parseAmount(target);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !(t > 0)) return;
    const ok = g
      ? await run(() => editSavingsGoal(g.id, { name: name.trim(), targetAmount: t, deadline }), 'Güncellendi')
      : await run(() => addSavingsGoal({ name: name.trim(), targetAmount: t, currentAmount: 0, deadline, createdAt: new Date().toISOString() }), 'Kumbara oluşturuldu');
    if (ok) (onCancel ?? close)();
  };

  return (
    <form onSubmit={save} className="space-y-5">
      <Field label="Adı"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ör: Acil durum, tatil, laptop" autoFocus={!g} /></Field>
      <Field label="Hedef tutar"><input className="input num text-lg font-bold" inputMode="decimal" value={target} onChange={(e) => setTarget(num(e.target.value))} placeholder="0" /></Field>
      <Field label="Hedef tarih (isteğe bağlı)" hint="Girersen ayda ne kadar ayırman gerektiğini söylerim."><input type="date" className="input" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></Field>
      <div className="grid grid-cols-[auto_1fr] gap-2">
        {onCancel && <button type="button" onClick={onCancel} className="btn btn-ghost">Vazgeç</button>}
        <button type="submit" disabled={!name.trim() || !(t > 0)} className={`btn btn-primary ${onCancel ? '' : 'col-span-2'}`}>{g ? 'Kaydet' : 'Oluştur'}</button>
      </div>
    </form>
  );
}
