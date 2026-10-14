import { ArrowLeftRight } from 'lucide-react';
import { CAT_COLOR, categoryConfig } from '../constants';
import { useMoneySheets } from '../store/useMoneySheets';
import type { Transaction, TransactionCategory } from '../types';
import { addDaysStr } from '../utils/period';
import { txKind } from '../utils/effects';
import { financeToday, fmt } from '../utils/format';

/* Para ekranının küçük, ortak parçaları — sakin, kenarlıksız, tek tip */

export function CatIcon({ category, size = 36 }: { category: TransactionCategory | string; size?: number }) {
  const cfg = categoryConfig[category as TransactionCategory] ?? categoryConfig['Diğer'];
  const color = CAT_COLOR[category as TransactionCategory] ?? 'var(--text-muted)';
  return (
    <span className="cat-bubble" style={{ '--c': color, width: size, height: size } as React.CSSProperties}>{cfg.icon}</span>
  );
}

export function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="widget">
      <div className="widget-header"><h3>{title}</h3>{action}</div>
      <div className="px-2 pb-3 sm:px-3">{children}</div>
    </section>
  );
}

export function Row({ icon, title, sub, right, onClick }: {
  icon: React.ReactNode; title: React.ReactNode; sub?: React.ReactNode; right?: React.ReactNode; onClick?: () => void;
}) {
  return (
    <button onClick={onClick} className="row-item w-full text-left min-h-0">
      {icon}
      <span className="flex-1 min-w-0">
        <span className="block text-[15px] font-semibold truncate">{title}</span>
        {sub && <span className="block text-xs text-text-muted truncate mt-0.5">{sub}</span>}
      </span>
      {right && <span className="shrink-0 text-right">{right}</span>}
    </button>
  );
}

export function Bubble({ icon, color = 'var(--text-muted)' }: { icon: React.ReactNode; color?: string }) {
  return <span className="cat-bubble" style={{ '--c': color } as React.CSSProperties}>{icon}</span>;
}

/* ── Tutar ─────────────────────────────────────────────── */

export function AmountBig({ value, onChange, autoFocus }: { value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  return (
    <div className="flex items-baseline justify-center gap-2 py-2">
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ''))}
        placeholder="0"
        autoFocus={autoFocus}
        className="bg-transparent text-center text-5xl font-extrabold num w-full max-w-[260px] p-0 border-0 focus:shadow-none"
        style={{ boxShadow: 'none', background: 'transparent' }}
        aria-label="Tutar"
      />
      <span className="text-2xl font-bold text-text-muted">₺</span>
    </div>
  );
}

export function Amount({ tx }: { tx: Transaction }) {
  const k = txKind(tx);
  if (k === 'transfer') return <span className="text-[15px] font-semibold num text-text-muted">{fmt(tx.amount)}</span>;
  if (k === 'income' || k === 'salary') return <span className="text-[15px] font-semibold num text-accent">+{fmt(tx.amount)}</span>;
  return <span className="text-[15px] font-semibold num">−{fmt(tx.amount)}</span>;
}

/* ── Seçiciler ─────────────────────────────────────────── */

import { useNames, type Opt } from './kitHooks';

export function Chips({ options, value, onChange, allowEmpty }: {
  options: Opt[]; value: string; onChange: (v: string) => void; allowEmpty?: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {allowEmpty !== undefined && (
        <button type="button" onClick={() => onChange('')} className={`pill ${value === '' ? 'active' : ''}`}>{allowEmpty}</button>
      )}
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)} className={`pill ${value === o.value ? 'active' : ''}`}>
          {o.icon}{o.label}{o.sub && <span className="num opacity-70 font-medium">· {o.sub}</span>}
        </button>
      ))}
    </div>
  );
}

export function DateField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const today = financeToday();
  const yesterday = addDaysStr(today, -1);
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <button type="button" onClick={() => onChange(today)} className={`pill ${value === today ? 'active' : ''}`}>Bugün</button>
      <button type="button" onClick={() => onChange(yesterday)} className={`pill ${value === yesterday ? 'active' : ''}`}>Dün</button>
      <input type="date" value={value} onChange={(e) => onChange(e.target.value)} className="input py-1.5 w-auto text-sm" style={{ minHeight: 34 }} />
    </div>
  );
}

/* ── İşlem satırı ──────────────────────────────────────── */

export function TxRow({ tx }: { tx: Transaction }) {
  const open = useMoneySheets((s) => s.open);
  const n = useNames();
  const k = txKind(tx);

  if (k === 'transfer') {
    const from = n.goal(tx.fromGoalId) ?? n.asset(tx.assetId) ?? '?';
    const to = n.asset(tx.toAssetId) ?? n.debt(tx.toDebtId) ?? n.goal(tx.toGoalId) ?? '?';
    const title = tx.toDebtId ? `${to} ödemesi` : tx.toGoalId ? `Kumbara · ${to}` : tx.fromGoalId ? `Kumbaradan · ${from}` : 'Transfer';
    return (
      <Row onClick={() => open({ t: 'editor', id: tx.id })} icon={<Bubble icon={<ArrowLeftRight size={16} />} />}
        title={tx.description || title} sub={`${from} → ${to}`} right={<Amount tx={tx} />} />
    );
  }
  const source = tx.debtId ? n.debt(tx.debtId) : n.asset(tx.assetId);
  const catName = k === 'salary' ? 'Maaş' : tx.category;
  const desc = tx.description && tx.description !== catName ? tx.description : '';
  return (
    <Row
      onClick={() => open({ t: 'editor', id: tx.id })}
      icon={<CatIcon category={k === 'salary' ? 'Gelir' : tx.category} />}
      title={desc || catName}
      sub={[desc ? catName : null, source].filter(Boolean).join(' · ') || undefined}
      right={<Amount tx={tx} />}
    />
  );
}
