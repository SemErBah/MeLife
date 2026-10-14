import { CreditCard, PiggyBank, Wallet } from 'lucide-react';
import { useFinance } from '../store/useFinance';
import { debtRemaining } from '../utils/finance';
import { fmt } from '../utils/format';

/* Para seçicileri için kancalar ve yardımcılar (bileşen değil) */

export interface Opt { value: string; label: string; sub?: string; icon?: React.ReactNode }

/** Hesap ('a:id'), kart/borç ('d:id'), kumbara ('g:id') seçenekleri */
export function useSourceOptions() {
  const { assets, debts, savingsGoals } = useFinance();
  const accounts: Opt[] = assets.map((a) => ({ value: `a:${a.id}`, label: a.name, sub: fmt(a.currentValue), icon: <Wallet size={13} /> }));
  const cards: Opt[] = debts.filter((d) => d.type === 'Kredi Kartı')
    .map((d) => ({ value: `d:${d.id}`, label: d.name, sub: fmt(debtRemaining(d)), icon: <CreditCard size={13} /> }));
  const allDebts: Opt[] = debts.filter((d) => !d.isPaidOff || d.type === 'Kredi Kartı')
    .map((d) => ({ value: `d:${d.id}`, label: d.name, sub: fmt(debtRemaining(d)), icon: <CreditCard size={13} /> }));
  const goals: Opt[] = savingsGoals.map((g) => ({ value: `g:${g.id}`, label: g.name, sub: fmt(g.currentAmount), icon: <PiggyBank size={13} /> }));
  return { accounts, cards, allDebts, goals };
}

export const splitRef = (ref: string): { kind: 'a' | 'd' | 'g' | ''; id: string } => {
  const [kind, id] = ref.split(':');
  return { kind: (kind as 'a' | 'd' | 'g') || '', id: id ?? '' };
};

export function useNames() {
  const { assets, debts, savingsGoals } = useFinance();
  return {
    asset: (id?: string) => assets.find((a) => a.id === id)?.name,
    debt: (id?: string) => debts.find((d) => d.id === id)?.name,
    goal: (id?: string) => savingsGoals.find((g) => g.id === id)?.name,
  };
}

