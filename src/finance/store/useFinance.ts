import { create } from 'zustand';
import type { Asset, BudgetLimit, Cashflow, Debt, SavingsGoal, Transaction, UserConfig } from '../types';
import { api } from '../services/financeApi';
import { diffEffect, effectOf, type Effect } from '../utils/effects';
import { addDaysStr } from '../utils/period';
import { financeToday } from '../utils/format';

/* Para verisi — eski MeDebit koleksiyonlarında kalır (assets, debts, …).
   Her işlem bakiyelere effects.ts üzerinden yansır; düzenleme/silme etkiyi düzeltir.
   Düzenli ödemeler artık sessizce işlenmez: "ödendi mi?" diye sorulur. */

export type TxInput = Omit<Transaction, 'id' | 'userId'>;

interface FinanceState {
  userConfig: UserConfig | null;
  assets: Asset[];
  debts: Debt[];
  transactions: Transaction[];
  savingsGoals: SavingsGoal[];
  cashflows: Cashflow[];
  budgetLimits: BudgetLimit[];
  isLoading: boolean;

  connect: () => () => void;
  setUserConfig: (patch: Partial<UserConfig>) => Promise<void>;

  // İşlemler (bakiyeler otomatik)
  saveTransaction: (data: TxInput, id?: string) => Promise<void>;
  removeTransaction: (id: string) => Promise<void>;
  paySalary: (amount: number, assetId: string | undefined, date: string) => Promise<void>;

  // Abonelik & faturalar
  saveCashflow: (data: Omit<Cashflow, 'id'>, id?: string) => Promise<void>;
  deleteCashflow: (id: string) => Promise<void>;
  payBill: (cf: Cashflow, amount: number, source: { assetId?: string; debtId?: string }, date: string) => Promise<void>;
  skipBill: (cf: Cashflow, how: 'later' | 'month') => Promise<void>;

  // Hesaplar, borçlar, kumbaralar
  addAsset: (data: Omit<Asset, 'id'>) => Promise<void>;
  updateAsset: (id: string, data: Partial<Asset>) => Promise<void>;
  deleteAsset: (id: string) => Promise<void>;
  addDebt: (data: Omit<Debt, 'id'>) => Promise<void>;
  updateDebt: (id: string, data: Partial<Debt>) => Promise<void>;
  deleteDebt: (id: string) => Promise<void>;
  addSavingsGoal: (data: Omit<SavingsGoal, 'id'>) => Promise<void>;
  editSavingsGoal: (id: string, data: Partial<SavingsGoal>) => Promise<void>;
  deleteSavingsGoal: (id: string) => Promise<void>;

  resetAllData: () => Promise<void>;
}

const EMPTY_DATA = {
  userConfig: null,
  assets: [],
  debts: [],
  transactions: [],
  savingsGoals: [],
  cashflows: [],
  budgetLimits: [],
};

export const useFinance = create<FinanceState>((set, get) => {
  /** Etkiyi bakiyelere uygula. Silinmiş hesap/borç/kumbara atlanır. */
  async function applyEffect(e: Effect) {
    const { assets, debts, savingsGoals } = get();
    const jobs: Promise<unknown>[] = [];
    for (const [id, d] of Object.entries(e.assets)) {
      if (assets.some((a) => a.id === id)) jobs.push(api.adjustAssetBalance(id, d));
    }
    const debtIds = new Set([...Object.keys(e.debtTotal), ...Object.keys(e.debtPaid)]);
    for (const id of debtIds) {
      const debt = debts.find((x) => x.id === id);
      if (!debt) continue;
      const dT = e.debtTotal[id] ?? 0;
      const dP = e.debtPaid[id] ?? 0;
      const total = debt.totalAmount + dT;
      const paid = debt.paidAmount + dP;
      const isPaidOff = total > 0 && paid >= total;
      jobs.push(api.incrementDebt(id, dT, dP, {
        isPaidOff,
        paidOffAt: isPaidOff ? debt.paidOffAt || new Date().toISOString() : '',
      }));
    }
    for (const [id, d] of Object.entries(e.goals)) {
      if (savingsGoals.some((g) => g.id === id)) jobs.push(api.incrementGoal(id, d));
    }
    await Promise.all(jobs);
  }

  return {
    ...EMPTY_DATA,
    isLoading: true,

    connect: () => {
      set({ ...EMPTY_DATA, isLoading: true });
      let closed = false;
      let pending = 7;
      const markReady = () => { if (--pending === 0 && !closed) set({ isLoading: false }); };
      const once = <T,>(apply: (v: T) => void) => {
        let first = true;
        return (v: T) => { apply(v); if (first) { first = false; markReady(); } };
      };

      api.getConfig()
        .then((config) => { if (config && !closed) set({ userConfig: config }); })
        .catch((err) => console.error('Para ayarları yüklenemedi:', err))
        .finally(markReady);

      const unsubs = [
        api.onAssetsChange(once((assets) => set({ assets }))),
        api.onDebtsChange(once((debts) => set({ debts }))),
        api.onTransactionsChange(once((transactions) => set({ transactions }))),
        api.onGoalsChange(once((savingsGoals) => set({ savingsGoals }))),
        api.onCashflowsChange(once((cashflows) => set({ cashflows }))),
        api.onBudgetLimitsChange(once((budgetLimits) => set({ budgetLimits }))),
      ];

      return () => {
        closed = true;
        unsubs.forEach((u) => u());
        set({ ...EMPTY_DATA, isLoading: true });
      };
    },

    setUserConfig: async (patch) => {
      const next = { ...(get().userConfig ?? {}), ...patch } as UserConfig;
      set({ userConfig: next });
      await api.saveConfig(next);
    },

    /* ── İşlemler ── */
    saveTransaction: async (data, id) => {
      const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined && v !== '')) as TxInput;
      if (id) {
        const old = get().transactions.find((t) => t.id === id);
        await api.updateTransaction(id, clean);
        if (old) await applyEffect(diffEffect(old, clean));
      } else {
        await api.addTransaction(clean);
        await applyEffect(effectOf(clean));
      }
    },

    removeTransaction: async (id) => {
      const tx = get().transactions.find((t) => t.id === id);
      await api.deleteTransaction(id);
      if (tx) await applyEffect(effectOf(tx, -1));
    },

    paySalary: async (amount, assetId, date) => {
      await get().saveTransaction({
        kind: 'salary', isIncome: true, category: 'Gelir', description: 'Maaş', amount, date, assetId,
      });
      if (assetId && assetId !== get().userConfig?.salaryAssetId) await get().setUserConfig({ salaryAssetId: assetId });
    },

    /* ── Abonelik & faturalar ── */
    saveCashflow: async (data, id) => {
      if (id) await api.updateCashflow(id, data);
      else await api.addCashflow(data);
    },
    deleteCashflow: (id) => api.deleteCashflow(id),

    payBill: async (cf, amount, source, date) => {
      const isIncome = cf.type === 'income';
      await get().saveTransaction({
        kind: isIncome ? 'income' : 'expense',
        isIncome,
        category: isIncome ? 'Gelir' : cf.category || 'Abonelik',
        description: cf.name,
        amount,
        date,
        billId: cf.id,
        ...(source.debtId && !isIncome ? { debtId: source.debtId } : { assetId: source.assetId }),
      });
      await api.updateCashflow(cf.id, { lastPaidPeriod: date.slice(0, 7), skippedUntil: '' });
    },

    skipBill: async (cf, how) => {
      const today = financeToday();
      await api.updateCashflow(cf.id, how === 'later'
        ? { skippedUntil: addDaysStr(today, 1) }
        : { lastPaidPeriod: today.slice(0, 7), skippedUntil: '' });
    },

    /* ── Hesaplar, borçlar, kumbaralar ── */
    addAsset: async (data) => { await api.addAsset(data); },
    updateAsset: (id, data) => api.updateAsset(id, data),
    deleteAsset: (id) => api.deleteAsset(id),

    addDebt: async (data) => { await api.addDebt(data); },
    updateDebt: async (id, data) => {
      const debt = get().debts.find((d) => d.id === id);
      if (debt && (data.totalAmount !== undefined || data.paidAmount !== undefined)) {
        const total = data.totalAmount ?? debt.totalAmount;
        const paid = data.paidAmount ?? debt.paidAmount;
        const isPaidOff = total > 0 && paid >= total;
        data = { ...data, isPaidOff, paidOffAt: isPaidOff ? debt.paidOffAt || new Date().toISOString() : '' };
      }
      await api.updateDebt(id, data);
    },
    deleteDebt: (id) => api.deleteDebt(id),

    addSavingsGoal: async (data) => { await api.addGoal(data); },
    editSavingsGoal: (id, data) => api.updateGoal(id, data),
    deleteSavingsGoal: (id) => api.deleteGoal(id),

    resetAllData: async () => {
      const { assets, debts, transactions, savingsGoals, cashflows, budgetLimits } = get();
      await Promise.all([
        ...assets.map((a) => api.deleteAsset(a.id)),
        ...debts.map((d) => api.deleteDebt(d.id)),
        ...transactions.map((t) => api.deleteTransaction(t.id)),
        ...savingsGoals.map((g) => api.deleteGoal(g.id)),
        ...cashflows.map((c) => api.deleteCashflow(c.id)),
        ...budgetLimits.map((b) => api.deleteBudgetLimit(b.id)),
      ]);
    },
  };
});
