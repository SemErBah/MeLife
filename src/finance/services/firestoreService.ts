import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  setDoc,
  getDoc,
  query,
  where,
  increment,
  type Unsubscribe,
} from 'firebase/firestore';
import { db as maybeDb, auth as maybeAuth } from '../../firebase';

// Para modülü yalnızca Firebase modunda çalışır; referanslar çağrı anında kullanılır
const db = maybeDb!;
const auth = maybeAuth!;
import type { Asset, Debt, Transaction, SavingsGoal, UserConfig, Cashflow, BudgetLimit } from '../types';

/* ── Collection references ────────────── */
const assetsCol = () => collection(db, 'assets');
const debtsCol = () => collection(db, 'debts');
const txCol = () => collection(db, 'transactions');
const goalsCol = () => collection(db, 'savingsGoals');
const cashflowsCol = () => collection(db, 'cashflows');
const budgetLimitsCol = () => collection(db, 'budgetLimits');

/* ── Config ───────────────────────────── */
export async function getConfig(): Promise<UserConfig | null> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Kullanıcı girişi yapılmadı");
  
  const configDoc = doc(db, 'users', uid, 'app', 'config');
  const snap = await getDoc(configDoc);
  return snap.exists() ? (snap.data() as UserConfig) : null;
}

export async function saveConfig(config: UserConfig): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Kullanıcı girişi yapılmadı");
  
  const configDoc = doc(db, 'users', uid, 'app', 'config');
  await setDoc(configDoc, { ...config, userId: uid }, { merge: true });
}

/* ── Assets ───────────────────────────── */
export async function addAsset(data: Omit<Asset, 'id'>): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Giriş yapın");
  
  const ref = await addDoc(assetsCol(), { ...data, userId: uid });
  return ref.id;
}

export async function updateAsset(id: string, data: Partial<Asset>): Promise<void> {
  await updateDoc(doc(db, 'assets', id), data);
}

export async function deleteAsset(id: string): Promise<void> {
  await deleteDoc(doc(db, 'assets', id));
}

/** Bakiyeyi atomik olarak değiştirir; eşzamanlı güncellemeler birbirini ezmez. */
export async function adjustAssetBalance(id: string, delta: number): Promise<void> {
  await updateDoc(doc(db, 'assets', id), { currentValue: increment(delta) });
}

export function onAssetsChange(cb: (assets: Asset[]) => void): Unsubscribe {
  const uid = auth.currentUser?.uid;
  if (!uid) return () => {};
  
  const q = query(assetsCol(), where("userId", "==", uid));
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as Asset));
    cb(items);
  });
}

/* ── Debts ────────────────────────────── */
export async function addDebt(data: Omit<Debt, 'id'>): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Giriş yapın");

  const ref = await addDoc(debtsCol(), { ...data, userId: uid });
  return ref.id;
}

export async function updateDebt(id: string, data: Partial<Debt>): Promise<void> {
  await updateDoc(doc(db, 'debts', id), data);
}

export async function incrementDebtPaid(id: string, amount: number, extra: Partial<Debt> = {}): Promise<void> {
  await updateDoc(doc(db, 'debts', id), { ...extra, paidAmount: increment(amount) });
}

/** Kart harcaması toplamı, ödeme ödeneni artırır (atomik). */
export async function incrementDebt(id: string, dTotal: number, dPaid: number, extra: Partial<Debt> = {}): Promise<void> {
  await updateDoc(doc(db, 'debts', id), {
    ...(dTotal ? { totalAmount: increment(dTotal) } : {}),
    ...(dPaid ? { paidAmount: increment(dPaid) } : {}),
    ...extra,
  });
}

export async function deleteDebt(id: string): Promise<void> {
  await deleteDoc(doc(db, 'debts', id));
}

export function onDebtsChange(cb: (debts: Debt[]) => void): Unsubscribe {
  const uid = auth.currentUser?.uid;
  if (!uid) return () => {};

  const q = query(debtsCol(), where("userId", "==", uid));
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as Debt));
    cb(items);
  });
}

/* ── Transactions ────────────────────── */
export async function addTransaction(data: Omit<Transaction, 'id'>): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Giriş yapın");

  const ref = await addDoc(txCol(), { ...data, userId: uid });
  return ref.id;
}

/** Tam üzerine yazar: düzenlemede kaldırılan alanlar (ör. hesap→kart) gerçekten silinir. */
export async function updateTransaction(id: string, data: Omit<Transaction, 'id'>): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Giriş yapın");
  await setDoc(doc(db, 'transactions', id), { ...data, userId: uid });
}

export async function deleteTransaction(id: string): Promise<void> {
  await deleteDoc(doc(db, 'transactions', id));
}

export function onTransactionsChange(cb: (txs: Transaction[]) => void): Unsubscribe {
  const uid = auth.currentUser?.uid;
  if (!uid) return () => {};

  const q = query(txCol(), where("userId", "==", uid));
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));
    cb(items);
  });
}

/* ── Savings Goals ───────────────────── */
export async function addGoal(data: Omit<SavingsGoal, 'id'>): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Giriş yapın");

  const ref = await addDoc(goalsCol(), { ...data, userId: uid });
  return ref.id;
}

export async function updateGoal(id: string, data: Partial<SavingsGoal>): Promise<void> {
  await updateDoc(doc(db, 'savingsGoals', id), data);
}

export async function incrementGoal(id: string, amount: number): Promise<void> {
  await updateDoc(doc(db, 'savingsGoals', id), { currentAmount: increment(amount) });
}

export async function deleteGoal(id: string): Promise<void> {
  await deleteDoc(doc(db, 'savingsGoals', id));
}

export function onGoalsChange(cb: (goals: SavingsGoal[]) => void): Unsubscribe {
  const uid = auth.currentUser?.uid;
  if (!uid) return () => {};

  const q = query(goalsCol(), where("userId", "==", uid));
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as SavingsGoal));
    cb(items);
  });
}

/* ── Cashflows ───────────────────────── */
export async function addCashflow(data: Omit<Cashflow, 'id'>): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Giriş yapın");

  const ref = await addDoc(cashflowsCol(), { ...data, userId: uid });
  return ref.id;
}

export async function updateCashflow(id: string, data: Partial<Cashflow>): Promise<void> {
  await updateDoc(doc(db, 'cashflows', id), data);
}

export async function deleteCashflow(id: string): Promise<void> {
  await deleteDoc(doc(db, 'cashflows', id));
}

export function onCashflowsChange(cb: (items: Cashflow[]) => void): Unsubscribe {
  const uid = auth.currentUser?.uid;
  if (!uid) return () => {};

  const q = query(cashflowsCol(), where("userId", "==", uid));
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as Cashflow));
    cb(items);
  });
}

/* ── Budget Limits ───────────────────────── */
export async function addBudgetLimit(data: Omit<BudgetLimit, 'id'>): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Giriş yapın");

  const ref = await addDoc(budgetLimitsCol(), { ...data, userId: uid });
  return ref.id;
}

export async function deleteBudgetLimit(id: string): Promise<void> {
  await deleteDoc(doc(db, 'budgetLimits', id));
}

export function onBudgetLimitsChange(cb: (items: BudgetLimit[]) => void): Unsubscribe {
  const uid = auth.currentUser?.uid;
  if (!uid) return () => {};

  const q = query(budgetLimitsCol(), where("userId", "==", uid));
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as BudgetLimit));
    cb(items);
  });
}
