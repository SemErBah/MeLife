import { Download, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Field, Segmented, Toggle } from '../../components/ui';
import { confirmAction, run, toast } from '../../store/useUI';
import { EXPENSE_CATEGORIES } from '../constants';
import { useFinance } from '../store/useFinance';
import { useMoneySheets } from '../store/useMoneySheets';
import type { Cashflow, CashflowType, TransactionCategory } from '../types';
import { financeToday, fmt, parseAmount, parseDate } from '../utils/format';
import { billDateFor, lastSalaryAmount } from '../utils/period';
import { AmountBig, Chips, DateField } from './kit';
import { splitRef, useSourceOptions } from './kitHooks';

/* ═══ Maaş yattı ════════════════════════════════════════ */

export function SalarySheet() {
  const { transactions, assets, userConfig, paySalary } = useFinance();
  const close = useMoneySheets((s) => s.close);
  const opts = useSourceOptions();
  const last = lastSalaryAmount(transactions);
  const [amount, setAmount] = useState(last ? String(last) : '');
  const [account, setAccount] = useState(() => {
    const id = userConfig?.salaryAssetId;
    return id && assets.some((a) => a.id === id) ? `a:${id}` : assets[0] ? `a:${assets[0].id}` : '';
  });
  const [date, setDate] = useState(financeToday());
  const value = parseAmount(amount);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!(value > 0)) return;
    if (await run(() => paySalary(value, splitRef(account).id || undefined, date))) {
      toast('Maaş eklendi · yeni dönem başladı 🎉');
      close();
    }
  };

  return (
    <form onSubmit={save} className="space-y-5">
      <p className="text-sm text-text-muted text-center">{last ? `Son maaşın ${fmt(last)} idi. Bu sefer ne kadar yattı?` : 'Ne kadar yattı?'}</p>
      <AmountBig value={amount} onChange={setAmount} autoFocus />
      <div>
        <p className="field-label">Hangi hesaba?</p>
        {opts.accounts.length
          ? <Chips options={opts.accounts} value={account} onChange={setAccount} />
          : <p className="text-sm text-text-muted">Henüz hesap yok; maaş yine kaydedilir, bakiyeye eklenmez.</p>}
      </div>
      <div>
        <p className="field-label">Ne zaman?</p>
        <DateField value={date} onChange={setDate} />
      </div>
      <button type="submit" disabled={!(value > 0)} className="btn btn-primary w-full">Maaşı ekle</button>
      <p className="text-[11px] text-text-muted text-center">Bu tarihten itibaren yeni dönem sayılır; harcama özetleri buna göre hesaplanır.</p>
    </form>
  );
}

/* ═══ Fatura/abonelik: ödendi mi? ═══════════════════════ */

export function BillPaySheet({ id }: { id: string }) {
  const { cashflows, payBill, skipBill } = useFinance();
  const close = useMoneySheets((s) => s.close);
  const opts = useSourceOptions();
  const cf = cashflows.find((c) => c.id === id);
  const [amount, setAmount] = useState(cf ? String(cf.amount) : '');
  const [source, setSource] = useState(cf?.sourceDebtId ? `d:${cf.sourceDebtId}` : cf?.sourceAssetId ? `a:${cf.sourceAssetId}` : '');
  const [date, setDate] = useState(financeToday());
  if (!cf) return null;
  const isIncome = cf.type === 'income';
  const value = parseAmount(amount);

  const pay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!(value > 0)) return;
    const s = splitRef(source);
    if (await run(() => payBill(cf, value, s.kind === 'd' ? { debtId: s.id } : { assetId: s.id || undefined }, date), 'Kaydedildi')) close();
  };

  return (
    <form onSubmit={pay} className="space-y-5">
      <div className="text-center">
        <p className="font-display text-xl font-semibold">{cf.name}</p>
        <p className="text-xs text-text-muted mt-1">{parseDate(billDateFor(cf, financeToday())).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })} · tutar değiştiyse düzelt</p>
      </div>
      <AmountBig value={amount} onChange={setAmount} />
      <div>
        <p className="field-label">{isIncome ? 'Hangi hesaba?' : 'Nereden ödendi?'}</p>
        <Chips options={isIncome ? opts.accounts : [...opts.accounts, ...opts.cards]} value={source} onChange={setSource} allowEmpty="Belirtme" />
      </div>
      <div>
        <p className="field-label">Tarih</p>
        <DateField value={date} onChange={setDate} />
      </div>
      <button type="submit" disabled={!(value > 0)} className="btn btn-primary w-full">{isIncome ? 'Geldi olarak kaydet' : 'Ödendi olarak kaydet'}</button>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={async () => { if (await run(() => skipBill(cf, 'later'), 'Yarın tekrar sorarım')) close(); }} className="btn btn-ghost">Ertele</button>
        <button type="button" onClick={async () => { if (await run(() => skipBill(cf, 'month'), 'Bu ay atlandı')) close(); }} className="btn btn-ghost">Bu ay yok</button>
      </div>
    </form>
  );
}

/* ═══ Fatura/abonelik ekle-düzenle ══════════════════════ */

export function BillEditor({ id }: { id?: string }) {
  const { cashflows, saveCashflow, deleteCashflow } = useFinance();
  const close = useMoneySheets((s) => s.close);
  const opts = useSourceOptions();
  const cf = id ? cashflows.find((c) => c.id === id) : undefined;
  const monthly = !cf || /^\d{1,2}$/.test(cf.expectedDate);

  const [name, setName] = useState(cf?.name ?? '');
  const [type, setType] = useState<CashflowType>(cf?.type ?? 'expense');
  const [amount, setAmount] = useState(cf ? String(cf.amount) : '');
  const [recurring, setRecurring] = useState(cf ? cf.isRecurring && monthly : true);
  const [day, setDay] = useState(monthly ? cf?.expectedDate ?? '' : '');
  const [onceDate, setOnceDate] = useState(!monthly ? cf!.expectedDate : financeToday());
  const [category, setCategory] = useState<TransactionCategory>(cf?.category ?? 'Abonelik');
  const [source, setSource] = useState(cf?.sourceDebtId ? `d:${cf.sourceDebtId}` : cf?.sourceAssetId ? `a:${cf.sourceAssetId}` : '');
  const value = parseAmount(amount);
  const dayNum = Number(day);
  const valid = name.trim() && value > 0 && (!recurring || (dayNum >= 1 && dayNum <= 31));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    const s = splitRef(source);
    const data: Omit<Cashflow, 'id'> = {
      name: name.trim(), type, amount: value,
      category: type === 'expense' ? category : undefined,
      expectedDate: recurring ? String(dayNum) : onceDate,
      isRecurring: recurring,
      sourceAssetId: s.kind === 'a' ? s.id : '',
      sourceDebtId: s.kind === 'd' ? s.id : '',
      createdAt: cf?.createdAt ?? new Date().toISOString(),
    };
    if (await run(() => saveCashflow(data, cf?.id), cf ? 'Güncellendi' : 'Eklendi')) close();
  };

  const remove = async () => {
    if (!cf) return;
    if (await confirmAction({ title: `"${cf.name}" silinsin mi?`, message: 'Geçmiş ödemeler korunur.', confirmLabel: 'Sil', danger: true })
      && await run(() => deleteCashflow(cf.id), 'Silindi')) close();
  };

  return (
    <form onSubmit={save} className="space-y-5">
      <Segmented<CashflowType> value={type} onChange={setType} options={[{ value: 'expense', label: 'Ödeme' }, { value: 'income', label: 'Gelir' }]} />
      <Field label="Adı"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ör: İnternet, Netflix, kira" autoFocus={!cf} /></Field>
      <Field label="Tutar (yaklaşık olabilir)">
        <input className="input num text-lg font-bold" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))} placeholder="0" />
      </Field>
      <div className="flex items-center justify-between gap-4">
        <p className="font-semibold text-sm">Her ay tekrarlansın</p>
        <Toggle checked={recurring} onChange={setRecurring} label="Her ay" />
      </div>
      {recurring
        ? <Field label="Ayın kaçında?"><input className="input num w-28" inputMode="numeric" value={day} onChange={(e) => setDay(e.target.value.replace(/\D/g, '').slice(0, 2))} placeholder="12" /></Field>
        : <Field label="Tarih"><input type="date" className="input" value={onceDate} onChange={(e) => setOnceDate(e.target.value)} /></Field>}
      {type === 'expense' && (
        <div>
          <p className="field-label">Kategori</p>
          <Chips options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c }))} value={category} onChange={(v) => setCategory(v as TransactionCategory)} />
        </div>
      )}
      <div>
        <p className="field-label">{type === 'expense' ? 'Genelde nereden ödenir?' : 'Hangi hesaba gelir?'}</p>
        <Chips options={type === 'expense' ? [...opts.accounts, ...opts.cards] : opts.accounts} value={source} onChange={setSource} allowEmpty="Her seferinde seçerim" />
      </div>
      <p className="text-[11px] text-text-muted">Günü gelince "ödendi mi?" diye sorarım; kendiliğinden kaydetmem.</p>
      <div className="space-y-2">
        <button type="submit" disabled={!valid} className="btn btn-primary w-full">{cf ? 'Kaydet' : 'Ekle'}</button>
        {cf && <button type="button" onClick={remove} className="btn btn-ghost w-full"><Trash2 size={16} /> Sil</button>}
      </div>
    </form>
  );
}

/* ═══ Para ayarları ═════════════════════════════════════ */

export function MoneySettings() {
  const state = useFinance();
  const { userConfig, setUserConfig, resetAllData } = state;
  const opts = useSourceOptions();
  const close = useMoneySheets((s) => s.close);
  const [budget, setBudget] = useState(userConfig?.monthlyLimit ? String(userConfig.monthlyLimit) : '');
  const [hint, setHint] = useState(userConfig?.salaryDayHint ? String(userConfig.salaryDayHint) : '');
  const [account, setAccount] = useState(userConfig?.salaryAssetId ? `a:${userConfig.salaryAssetId}` : '');
  const [resetText, setResetText] = useState('');

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const b = parseAmount(budget);
    const h = Number(hint);
    if (await run(() => setUserConfig({
      monthlyLimit: b > 0 ? b : 0,
      salaryDayHint: h >= 1 && h <= 31 ? h : 0,
      salaryAssetId: splitRef(account).id || '',
    }), 'Kaydedildi')) close();
  };

  const exportData = () => {
    const { userConfig: c, assets, debts, transactions, savingsGoals, cashflows, budgetLimits } = useFinance.getState();
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), userConfig: c, assets, debts, transactions, savingsGoals, cashflows, budgetLimits }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `melife-para-${financeToday()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const reset = async () => {
    if (await confirmAction({ title: 'Tüm para verileri silinsin mi?', message: 'Hesaplar, borçlar, işlemler, faturalar ve kumbaralar kalıcı olarak silinir. Önce yedek indirmen önerilir.', confirmLabel: 'Hepsini sil', danger: true })) {
      if (await run(resetAllData, 'Para verileri silindi')) { setResetText(''); close(); }
    }
  };

  return (
    <form onSubmit={save} className="space-y-6">
      <Field label="Dönem bütçesi (isteğe bağlı)" hint="Maaştan maaşa harcamak istediğin tutar. Boş bırakırsan bütçe hiç gösterilmez.">
        <input className="input num text-lg font-bold" inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value.replace(/[^\d.,]/g, ''))} placeholder="—" />
      </Field>
      <div>
        <p className="field-label">Maaş hesabı</p>
        <Chips options={opts.accounts} value={account} onChange={setAccount} allowEmpty="Her seferinde seçerim" />
      </div>
      <Field label="Maaş genelde ayın kaçında? (isteğe bağlı)" hint="Sadece ilk tahmin için. Birkaç maaş girince aralığı kendim hesaplarım.">
        <input className="input num w-28" inputMode="numeric" value={hint} onChange={(e) => setHint(e.target.value.replace(/\D/g, '').slice(0, 2))} placeholder="—" />
      </Field>
      <button type="submit" className="btn btn-primary w-full">Kaydet</button>

      <div className="pt-4 border-t border-border-light space-y-3">
        <button type="button" onClick={exportData} className="btn btn-ghost w-full"><Download size={16} /> Para verilerimi indir (.json)</button>
        <div className="rounded-2xl bg-surface-el p-4 space-y-3">
          <p className="text-sm font-semibold">Tüm para verilerini sil</p>
          <p className="text-xs text-text-muted">Onaylamak için <b>SIFIRLA</b> yaz.</p>
          <div className="flex gap-2">
            <input value={resetText} onChange={(e) => setResetText(e.target.value)} className="input flex-1" placeholder="SIFIRLA" />
            <button type="button" onClick={reset} disabled={resetText.trim().toLocaleUpperCase('tr-TR') !== 'SIFIRLA'} className="btn btn-ghost shrink-0 disabled:opacity-40"><Trash2 size={16} /> Sil</button>
          </div>
        </div>
      </div>
    </form>
  );
}
