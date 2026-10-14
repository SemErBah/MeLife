import type { Transaction, TxKind } from '../types';

/* Bir işlemin bakiyelere etkisi — tek doğruluk kaynağı.
   Ekleme: effectOf(tx). Silme: effectOf(tx, -1). Düzenleme: diffEffect(eski, yeni). */

export type TxLike = Pick<Transaction,
  'amount' | 'isIncome' | 'kind' | 'assetId' | 'debtId' | 'fromGoalId' | 'toAssetId' | 'toDebtId' | 'toGoalId'>;

export interface Effect {
  assets: Record<string, number>;     // bakiye değişimi
  debtTotal: Record<string, number>;  // kart/borç toplamı (harcama artırır)
  debtPaid: Record<string, number>;   // ödenen (kart ödemesi artırır)
  goals: Record<string, number>;      // kumbara
}

export const emptyEffect = (): Effect => ({ assets: {}, debtTotal: {}, debtPaid: {}, goals: {} });

/** Eski MeDebit kayıtlarında kind yok */
export const txKind = (t: Pick<Transaction, 'kind' | 'isIncome'>): TxKind => t.kind ?? (t.isIncome ? 'income' : 'expense');

/** Harcama toplamlarına giren işlem mi? (transfer ve gelir girmez) */
export const isSpending = (t: Pick<Transaction, 'kind' | 'isIncome'>) => txKind(t) === 'expense';
export const isIncomeLike = (t: Pick<Transaction, 'kind' | 'isIncome'>) => {
  const k = txKind(t);
  return k === 'income' || k === 'salary';
};

const add = (map: Record<string, number>, id: string | undefined, delta: number) => {
  if (!id || !delta) return;
  map[id] = (map[id] ?? 0) + delta;
};

export function effectOf(t: TxLike, sign: 1 | -1 = 1): Effect {
  const e = emptyEffect();
  const amt = (Number(t.amount) || 0) * sign;
  switch (txKind(t)) {
    case 'expense':
      if (t.debtId) add(e.debtTotal, t.debtId, amt);
      else add(e.assets, t.assetId, -amt);
      break;
    case 'income':
    case 'salary':
      add(e.assets, t.assetId, amt);
      break;
    case 'transfer':
      // kaynak
      if (t.fromGoalId) add(e.goals, t.fromGoalId, -amt);
      else add(e.assets, t.assetId, -amt);
      // hedef
      if (t.toAssetId) add(e.assets, t.toAssetId, amt);
      if (t.toDebtId) add(e.debtPaid, t.toDebtId, amt);
      if (t.toGoalId) add(e.goals, t.toGoalId, amt);
      break;
  }
  return e;
}

export function mergeEffects(a: Effect, b: Effect): Effect {
  const out = emptyEffect();
  (Object.keys(out) as (keyof Effect)[]).forEach((k) => {
    for (const src of [a[k], b[k]]) for (const [id, v] of Object.entries(src)) add(out[k], id, v);
    for (const [id, v] of Object.entries(out[k])) if (Math.abs(v) < 1e-9) delete out[k][id];
  });
  return out;
}

/** Düzenleme: eski etkiyi geri al, yenisini uygula — yalnızca fark kalır */
export const diffEffect = (oldTx: TxLike, newTx: TxLike) => mergeEffects(effectOf(oldTx, -1), effectOf(newTx, 1));

export const isEmptyEffect = (e: Effect) => Object.values(e).every((m) => Object.keys(m).length === 0);
