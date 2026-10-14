import { getLocalBackend } from '../../services/backend';
import type { Asset, BudgetLimit, Cashflow, Debt, SavingsGoal, Transaction, UserConfig } from '../types';

/* Demo/yerel mod için firestoreService ile aynı arayüz (veriler bu tarayıcıda). */

type Data = Record<string, unknown>;
const b = () => getLocalBackend();
const COL = {
  assets: 'fin_assets', debts: 'fin_debts', tx: 'fin_transactions',
  goals: 'fin_goals', cashflows: 'fin_cashflows', limits: 'fin_budgetLimits',
};

const add = (col: string, data: object) => b().add(col, data as Data);
const patch = (col: string, id: string, data: object) => b().set(col, id, data as Data, true);
const bump = (col: string, id: string, field: string, delta: number, extra: object = {}) => {
  const cur = Number(b().peek(col, id)?.[field] ?? 0);
  return patch(col, id, { [field]: cur + delta, ...extra });
};
const watch = <T,>(col: string) => (cb: (items: T[]) => void) => b().watchCol<T>(col, cb);

export async function getConfig(): Promise<UserConfig | null> {
  return (b().peek('fin_config', 'main') as UserConfig | null) ?? null;
}
export const saveConfig = (config: UserConfig) => patch('fin_config', 'main', config);

export const addAsset = (data: Omit<Asset, 'id'>) => add(COL.assets, data);
export const updateAsset = (id: string, data: Partial<Asset>) => patch(COL.assets, id, data);
export const deleteAsset = (id: string) => b().remove(COL.assets, id);
export const adjustAssetBalance = (id: string, delta: number) => bump(COL.assets, id, 'currentValue', delta);
export const onAssetsChange = watch<Asset>(COL.assets);

export const addDebt = (data: Omit<Debt, 'id'>) => add(COL.debts, data);
export const updateDebt = (id: string, data: Partial<Debt>) => patch(COL.debts, id, data);
export const incrementDebtPaid = (id: string, amount: number, extra: Partial<Debt> = {}) => bump(COL.debts, id, 'paidAmount', amount, extra);
export async function incrementDebt(id: string, dTotal: number, dPaid: number, extra: Partial<Debt> = {}) {
  const cur = b().peek(COL.debts, id);
  await patch(COL.debts, id, {
    totalAmount: Number(cur?.totalAmount ?? 0) + dTotal,
    paidAmount: Number(cur?.paidAmount ?? 0) + dPaid,
    ...extra,
  });
}
export const deleteDebt = (id: string) => b().remove(COL.debts, id);
export const onDebtsChange = watch<Debt>(COL.debts);

export const addTransaction = (data: Omit<Transaction, 'id'>) => add(COL.tx, data);
export const updateTransaction = (id: string, data: Omit<Transaction, 'id'>) => b().set(COL.tx, id, data as Data, false);
export const deleteTransaction = (id: string) => b().remove(COL.tx, id);
export const onTransactionsChange = watch<Transaction>(COL.tx);

export const addGoal = (data: Omit<SavingsGoal, 'id'>) => add(COL.goals, data);
export const updateGoal = (id: string, data: Partial<SavingsGoal>) => patch(COL.goals, id, data);
export const incrementGoal = (id: string, amount: number) => bump(COL.goals, id, 'currentAmount', amount);
export const deleteGoal = (id: string) => b().remove(COL.goals, id);
export const onGoalsChange = watch<SavingsGoal>(COL.goals);

export const addCashflow = (data: Omit<Cashflow, 'id'>) => add(COL.cashflows, data);
export const updateCashflow = (id: string, data: Partial<Cashflow>) => patch(COL.cashflows, id, data);
export const deleteCashflow = (id: string) => b().remove(COL.cashflows, id);
export const onCashflowsChange = watch<Cashflow>(COL.cashflows);

export const addBudgetLimit = (data: Omit<BudgetLimit, 'id'>) => add(COL.limits, data);
export const deleteBudgetLimit = (id: string) => b().remove(COL.limits, id);
export const onBudgetLimitsChange = watch<BudgetLimit>(COL.limits);
