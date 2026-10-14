import { create } from 'zustand';
import type { Transaction } from '../types';

/* Para'nın alt sayfaları — aynı anda bir tane açık */
export type MoneySheet =
  | { t: 'editor'; id?: string; preset?: Partial<Transaction> }
  | { t: 'salary' }
  | { t: 'billPay'; id: string }
  | { t: 'bill'; id?: string }
  | { t: 'debt'; id?: string }
  | { t: 'goal'; id?: string }
  | { t: 'account'; id?: string }
  | { t: 'allTx' }
  | { t: 'settings' };

interface S {
  sheet: MoneySheet | null;
  open: (s: MoneySheet) => void;
  close: () => void;
}

export const useMoneySheets = create<S>((set) => ({
  sheet: null,
  open: (sheet) => set({ sheet }),
  close: () => set({ sheet: null }),
}));
