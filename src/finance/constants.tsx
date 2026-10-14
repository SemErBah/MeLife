import {
  ShoppingCart, Zap, Gamepad2, Bus, Shirt, HeartPulse, UtensilsCrossed,
  Home, Repeat, ArrowDownLeft, MoreHorizontal, GraduationCap,
} from 'lucide-react';
import type { AssetType, DebtType, TransactionCategory } from './types';

export const EXPENSE_CATEGORIES: TransactionCategory[] = [
  'Market', 'Yemek', 'Fatura', 'Kira', 'Ulaşım', 'Sağlık', 'Giyim', 'Eğlence', 'Eğitim', 'Abonelik', 'Diğer',
];

export const categoryConfig: Record<TransactionCategory, { icon: React.ReactNode; color: string; bg: string }> = {
  Market:   { icon: <ShoppingCart size={16} />,    color: 'text-orange-400', bg: 'bg-orange-400/15' },
  Fatura:   { icon: <Zap size={16} />,             color: 'text-yellow-500', bg: 'bg-yellow-400/15' },
  Eğlence:  { icon: <Gamepad2 size={16} />,        color: 'text-pink-400',   bg: 'bg-pink-400/15' },
  Ulaşım:   { icon: <Bus size={16} />,             color: 'text-sky-400',    bg: 'bg-sky-400/15' },
  Giyim:    { icon: <Shirt size={16} />,           color: 'text-violet-400', bg: 'bg-violet-400/15' },
  Sağlık:   { icon: <HeartPulse size={16} />,      color: 'text-red-400',    bg: 'bg-red-400/15' },
  Yemek:    { icon: <UtensilsCrossed size={16} />, color: 'text-amber-500',  bg: 'bg-amber-400/15' },
  Kira:     { icon: <Home size={16} />,            color: 'text-teal-400',   bg: 'bg-teal-400/15' },
  Eğitim:   { icon: <GraduationCap size={16} />,   color: 'text-cyan-400',   bg: 'bg-cyan-400/15' },
  Abonelik: { icon: <Repeat size={16} />,          color: 'text-indigo-400', bg: 'bg-indigo-400/15' },
  Gelir:    { icon: <ArrowDownLeft size={16} />,   color: 'text-emerald',    bg: 'bg-emerald-dim' },
  Diğer:    { icon: <MoreHorizontal size={16} />,  color: 'text-text-muted', bg: 'bg-surface-el' },
};

/** Kategori rengi — MeLife'ın sakin kategori paletinden */
export const CAT_COLOR: Record<TransactionCategory, string> = {
  Market: 'var(--cat-social)', Yemek: 'var(--cat-work)', Fatura: 'var(--cat-health)', Kira: 'var(--cat-order)',
  Ulaşım: 'var(--cat-health)', Sağlık: 'var(--cat-mood)', Giyim: 'var(--cat-mind)', Eğlence: 'var(--cat-mood)',
  Eğitim: 'var(--cat-mind)', Abonelik: 'var(--cat-mind)', Gelir: 'var(--accent-base)', Diğer: 'var(--text-muted)',
};

export const ASSET_TYPES: AssetType[] = ['Banka Hesabı', 'Nakit', 'Altın', 'Döviz', 'Kripto', 'Hisse', 'Diğer'];

export const DEBT_TYPES: DebtType[] = ['Kredi Kartı', 'Kredi', 'Ek Hesap', 'Diğer'];

export const BANKS = [
  'Cüzdan (Nakit)', 'Garanti BBVA', 'Akbank', 'İş Bankası', 'Yapı Kredi', 'Ziraat Bankası',
  'VakıfBank', 'Halkbank', 'QNB', 'Enpara', 'Kuveyt Türk', 'DenizBank', 'TEB', 'ING',
  'Papara', 'Kripto Cüzdan', 'Borsa Hesabı', 'Diğer',
];
