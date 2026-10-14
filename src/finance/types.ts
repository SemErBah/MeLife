/* ── Types ─────────────────────────────────────────── */

export interface UserConfig {
  userId?: string;
  monthlyLimit?: number;      // isteğe bağlı dönem bütçesi (0/boş = bütçe yok)
  salaryDay?: number;         // eski MeDebit alanı
  salaryDayHint?: number;     // maaşın yaklaşık günü (ilk tahmin için)
  salaryAssetId?: string;     // maaşın yattığı hesap
  theme?: 'light' | 'dark' | 'system';
}

export type AssetType = 'Banka Hesabı' | 'Altın' | 'Döviz' | 'Nakit' | 'Kripto' | 'Hisse' | 'Diğer';

export type BankName = 
  | 'Cüzdan (Nakit)'
  | 'Garanti BBVA' 
  | 'Akbank' 
  | 'İş Bankası' 
  | 'Yapı Kredi' 
  | 'Ziraat Bankası' 
  | 'VakıfBank' 
  | 'Halkbank' 
  | 'QNB' 
  | 'Enpara' 
  | 'Kuveyt Türk' 
  | 'DenizBank'
  | 'TEB'
  | 'ING'
  | 'Diğer';

export interface Asset {
  id: string;
  userId?: string;
  name: string;
  bankName?: BankName | string;
  type: AssetType;
  amount: number;
  currentValue: number;
  dateAdded: string;
}

export type DebtType = 'Ek Hesap' | 'Kredi Kartı' | 'Kredi' | 'Diğer';

export interface Debt {
  id: string;
  userId?: string;
  name: string;
  bankName?: BankName | string;
  type: DebtType;
  cardLimit?: number;
  totalAmount: number;
  paidAmount: number;
  interestRate: number; // aylık %
  dueDate: string;
  paidOffAt?: string;
  isPaidOff: boolean;
  createdAt: string;
}

export type TransactionCategory =
  | 'Market'
  | 'Fatura'
  | 'Eğlence'
  | 'Ulaşım'
  | 'Giyim'
  | 'Sağlık'
  | 'Yemek'
  | 'Kira'
  | 'Eğitim'
  | 'Abonelik'
  | 'Gelir'
  | 'Diğer';

export interface BudgetLimit {
  id: string;
  userId?: string;
  category: TransactionCategory;
  limit: number;
}

/** İşlem türü. Eski kayıtlarda yok: isIncome'dan türetilir. */
export type TxKind = 'expense' | 'income' | 'salary' | 'transfer';

export interface Transaction {
  id: string;
  userId?: string;
  amount: number;
  category: TransactionCategory;
  date: string;
  description: string;
  isIncome: boolean;
  kind?: TxKind;
  assetId?: string;      // harcama/gelir hesabı ya da transferin kaynağı
  debtId?: string;       // kredi kartıyla harcama → kart borcu artar
  fromGoalId?: string;   // kumbaradan çekme (transfer kaynağı)
  toAssetId?: string;    // transfer hedefi: hesap
  toDebtId?: string;     // transfer hedefi: borç/kart ödemesi
  toGoalId?: string;     // transfer hedefi: kumbara
  billId?: string;       // hangi abonelik/faturadan geldiği
}

export interface SavingsGoal {
  id: string;
  userId?: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string;
  createdAt: string;
}

export type CashflowType = 'income' | 'expense';

export interface Cashflow {
  id: string;
  userId?: string;
  name: string;
  amount: number;
  type: CashflowType;
  category?: TransactionCategory; // gider ise işlemin kategorisi (varsayılan: Abonelik)
  expectedDate: string; // The day (1-31) or full date it is expected
  isRecurring: boolean; // Does it repeat monthly?
  sourceAssetId?: string; // Optional: The ID of the asset/bank account to deduct from or add to
  sourceDebtId?: string;  // ya da kredi kartından çekilir
  lastProcessedDate?: string; // eski otomatik işleme alanı
  lastPaidPeriod?: string;    // "2026-10": o ayki ödeme yapıldı / atlandı
  skippedUntil?: string;      // "Ertele": bu tarihe kadar sorma
  createdAt: string;
}

