import { ArrowLeftRight, Banknote, ChevronRight, CreditCard, Landmark, Minus, PiggyBank, Plus, Repeat, Settings2, Wallet, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import ProfileButton from '../components/ProfileButton';
import { ProgressBar } from '../components/ui';
import { CatIcon, Bubble, Row, Section, TxRow } from './components/kit';
import { useFinance } from './store/useFinance';
import { useMoneySheets } from './store/useMoneySheets';
import type { Debt } from './types';
import { debtRemaining, minPayment } from './utils/finance';
import { isSpending } from './utils/effects';
import { daysLeftLabel, daysUntil, financeToday, fmt, parseDate, safePct } from './utils/format';
import { byCategory, currentPeriods, diffDays, dueBills, expectedSalary, nextBillDate, periodDays, shouldAskSalary, spentIn } from './utils/period';

const fmtDay = (d: string) => parseDate(d).toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtShort = (d: string) => parseDate(d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });

/** Para: tek ekran. Bilgi verir, yargılamaz. */
export default function Money() {
  const f = useFinance();
  const { transactions, assets, debts, cashflows, savingsGoals, userConfig, isLoading } = f;
  const open = useMoneySheets((s) => s.open);
  const today = financeToday();

  const { current, previous } = useMemo(() => currentPeriods(transactions, today), [transactions, today]);
  const spent = spentIn(transactions, current);
  const budget = userConfig?.monthlyLimit || 0;
  const expected = expectedSalary(transactions, today, userConfig?.salaryDayHint);
  const daysToSalary = expected ? diffDays(today, expected) : null;
  const totalAssets = assets.reduce((s, a) => s + a.currentValue, 0);
  const activeDebts = debts.filter((d) => !d.isPaidOff);
  const totalDebt = activeDebts.reduce((s, d) => s + debtRemaining(d), 0);

  if (isLoading) {
    return (
      <div className="page max-w-3xl" aria-busy="true">
        <div className="skeleton h-10 w-40" />
        <div className="skeleton h-40 rounded-3xl" />
        <div className="skeleton h-64 rounded-3xl" />
      </div>
    );
  }

  const empty = !assets.length && !transactions.length && !debts.length && !cashflows.length && !savingsGoals.length;
  const periodLabel = current.bySalary
    ? `Maaştan beri ${periodDays(current)} gün`
    : `${parseDate(current.start).toLocaleDateString('tr-TR', { month: 'long' })} başından beri`;

  return (
    <div className="page max-w-3xl">
      <header className="space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-sm text-text-muted">
            {periodLabel}
            {daysToSalary !== null && daysToSalary > 0 && ` · maaşa ~${daysToSalary} gün`}
          </p>
          <ProfileButton />
        </div>
        <h1 className="page-title">Para</h1>
      </header>

      {/* Özet: tek sakin rakam */}
      <section className="now-card space-y-4">
        <div>
          <p className="eyebrow">Bu dönem harcadın</p>
          <p className="text-5xl font-extrabold num tracking-tight mt-2">{fmt(spent)}</p>
          {budget > 0 && <BudgetLine spent={spent} budget={budget} daysLeft={daysToSalary} />}
        </div>
        {(assets.length > 0 || totalDebt > 0) && (
          <p className="text-sm text-text-muted">
            Hesaplarında <b className="text-text-main num">{fmt(totalAssets)}</b>
            {totalDebt > 0 && <> · borç <b className="text-text-main num">{fmt(totalDebt)}</b></>}
          </p>
        )}
        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => open({ t: 'editor', preset: { kind: 'expense' } })} className="btn btn-primary px-2"><Minus size={16} /> Harcama</button>
          <button onClick={() => open({ t: 'editor', preset: { kind: 'income', isIncome: true } })} className="btn btn-ghost px-2"><Plus size={16} /> Gelir</button>
          <button onClick={() => open({ t: 'editor', preset: { kind: 'transfer' } })} className="btn btn-ghost px-2"><ArrowLeftRight size={16} /> Transfer</button>
        </div>
      </section>

      {/* Sorular: maaş, faturalar, yaklaşan borçlar */}
      <Nudges today={today} />

      {empty ? (
        <section className="widget p-6 text-center space-y-3">
          <p className="font-display text-xl font-semibold">Buradan başla</p>
          <p className="text-sm text-text-muted">Bir hesap ekle (banka ya da nakit cüzdan). İstersen hiç hesap eklemeden de harcamalarını yazabilirsin.</p>
          <div className="flex gap-2 justify-center flex-wrap">
            <button onClick={() => open({ t: 'account' })} className="btn btn-primary btn-sm"><Wallet size={15} /> Hesap ekle</button>
            <button onClick={() => open({ t: 'salary' })} className="btn btn-ghost btn-sm"><Banknote size={15} /> Maaş yattı</button>
          </div>
        </section>
      ) : (
        <>
          <Recent />
          <Categories current={current} previous={previous} />
        </>
      )}

      <Accounts />
      <Debts debts={debts} />
      <Bills today={today} />
      <Goals />

      <button onClick={() => open({ t: 'settings' })} className="btn btn-ghost w-full"><Settings2 size={16} /> Para ayarları</button>
    </div>
  );
}

/* ── Bütçe satırı: düz bilgi, uyarı yok ─────────────────── */

function BudgetLine({ spent, budget, daysLeft }: { spent: number; budget: number; daysLeft: number | null }) {
  const left = budget - spent;
  return (
    <div className="mt-3 space-y-2">
      <ProgressBar pct={safePct(spent, budget)} color="var(--accent-base)" height={6} />
      <p className="text-sm text-text-muted">
        {left >= 0
          ? <>Bütçeden <b className="text-text-main num">{fmt(left)}</b> kaldı{daysLeft && daysLeft > 0 ? <> · günde ~<span className="num">{fmt(Math.floor(left / daysLeft))}</span></> : ''}</>
          : <>Bütçenin <b className="text-text-main num">{fmt(-left)}</b> üstündesin</>}
      </p>
    </div>
  );
}

/* ── Sorular ──────────────────────────────────────────── */

function useDismissed(key: string): [boolean, () => void] {
  const full = `melife-money-${key}`;
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(full) === '1'; } catch { return false; } });
  return [hidden, () => { setHidden(true); try { localStorage.setItem(full, '1'); } catch { /* yok say */ } }];
}

function Nudges({ today }: { today: string }) {
  const { transactions, cashflows, debts, userConfig } = useFinance();
  const open = useMoneySheets((s) => s.open);
  const [salaryHidden, hideSalary] = useDismissed(`salary-${today}`);
  const askSalary = !salaryHidden && shouldAskSalary(transactions, today, userConfig?.salaryDayHint);
  const bills = dueBills(cashflows, today);
  // Son ödeme yaklaşan borçlar — son 20 günde ödeme yapıldıysa artık sorma
  const paidRecently = (id: string) => transactions.some((t) => t.toDebtId === id && diffDays(t.date, today) <= 20);
  const soonDebts = debts.filter((d) => !d.isPaidOff && d.dueDate && daysUntil(d.dueDate) <= 3 && debtRemaining(d) > 0 && !paidRecently(d.id));

  if (!askSalary && !bills.length && !soonDebts.length) return null;

  return (
    <div className="space-y-2">
      {askSalary && (
        <Nudge icon={<Banknote size={18} />} title="Maaş yattı mı?" sub="Yattıysa ekle, yeni dönem başlasın."
          actions={<><button onClick={() => open({ t: 'salary' })} className="btn btn-soft-accent btn-sm">Yattı</button>
            <button onClick={hideSalary} className="icon-btn text-text-muted" aria-label="Henüz değil"><X size={16} /></button></>} />
      )}
      {bills.map((b) => (
        <Nudge key={b.id} icon={<Repeat size={18} />}
          title={`${b.name} · ${fmt(b.amount)}`}
          sub={b.late === 0 ? (b.type === 'income' ? 'Bugün · geldi mi?' : 'Bugün · ödendi mi?') : `${b.late} gün önceydi · ${b.type === 'income' ? 'geldi mi?' : 'ödendi mi?'}`}
          actions={<button onClick={() => open({ t: 'billPay', id: b.id })} className="btn btn-soft-accent btn-sm">Bak</button>} />
      ))}
      {soonDebts.map((d) => {
        const days = daysUntil(d.dueDate);
        return (
          <Nudge key={d.id} icon={<CreditCard size={18} />}
            title={`${d.name} · ${fmt(d.type === 'Kredi Kartı' ? Math.ceil(minPayment(d)) : debtRemaining(d))}`}
            sub={`${daysLeftLabel(days)}${d.type === 'Kredi Kartı' ? ' · asgari' : ''}`}
            actions={<button onClick={() => open({ t: 'debt', id: d.id })} className="btn btn-soft-accent btn-sm">Öde</button>} />
        );
      })}
    </div>
  );
}

function Nudge({ icon, title, sub, actions }: { icon: React.ReactNode; title: string; sub: string; actions: React.ReactNode }) {
  return (
    <div className="card p-3.5 flex items-center gap-3">
      <Bubble icon={icon} color="var(--accent-base)" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-[15px] truncate">{title}</p>
        <p className="text-xs text-text-muted">{sub}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">{actions}</div>
    </div>
  );
}

/* ── Son kayıtlar ─────────────────────────────────────── */

function Recent() {
  const { transactions } = useFinance();
  const open = useMoneySheets((s) => s.open);
  const recent = [...transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  const groups = recent.reduce<{ date: string; items: typeof recent }[]>((acc, t) => {
    const last = acc[acc.length - 1];
    if (last?.date === t.date) last.items.push(t); else acc.push({ date: t.date, items: [t] });
    return acc;
  }, []);

  return (
    <Section title="Son kayıtlar" action={<button className="widget-link" onClick={() => open({ t: 'allTx' })}>Tümü <ChevronRight size={13} className="inline -mt-0.5" /></button>}>
      {groups.length === 0 ? (
        <p className="text-sm text-text-muted px-3 pb-2">Henüz kayıt yok. Yukarıdaki "Harcama" ile başlayabilirsin.</p>
      ) : groups.map((g) => {
        const daySpent = g.items.filter(isSpending).reduce((s, t) => s + t.amount, 0);
        return (
          <div key={g.date} className="mb-1">
            <div className="flex justify-between px-3 pt-1">
              <p className="slot-label px-0 capitalize">{fmtDay(g.date)}</p>
              {daySpent > 0 && <p className="text-[11px] text-text-muted num">−{fmt(daySpent)}</p>}
            </div>
            {g.items.map((t) => <TxRow key={t.id} tx={t} />)}
          </div>
        );
      })}
    </Section>
  );
}

/* ── Nereye gitti ─────────────────────────────────────── */

function Categories({ current, previous }: { current: ReturnType<typeof currentPeriods>['current']; previous: ReturnType<typeof currentPeriods>['previous'] }) {
  const { transactions } = useFinance();
  const cur = byCategory(transactions, current);
  const prev = byCategory(transactions, previous);
  const rows = Object.entries(cur).sort((a, b) => b[1] - a[1]);
  if (!rows.length) return null;
  const max = rows[0][1];

  return (
    <Section title="Nereye gitti">
      <ul className="px-3 pb-1 space-y-3">
        {rows.map(([cat, v]) => {
          const p = prev[cat];
          const change = p ? Math.round(((v - p) / p) * 100) : null;
          return (
            <li key={cat} className="flex items-center gap-3">
              <CatIcon category={cat} size={30} />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between gap-2 text-sm">
                  <span className="font-medium truncate">{cat}</span>
                  <span className="num font-semibold">{fmt(v)}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1.5 rounded-full bg-surface-el overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(v / max) * 100}%`, background: 'var(--text-muted)', opacity: 0.55 }} />
                  </div>
                  {change !== null && Math.abs(change) >= 5 && (
                    <span className="text-[10px] text-text-muted num w-16 text-right">{change > 0 ? '+' : '−'}%{Math.abs(change)} önceki</span>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

/* ── Hesaplar / borçlar / faturalar / kumbaralar ─────── */

const addBtn = (onClick: () => void) => (
  <button className="widget-link" onClick={onClick}><Plus size={13} className="inline -mt-0.5" /> Ekle</button>
);

function Accounts() {
  const { assets } = useFinance();
  const open = useMoneySheets((s) => s.open);
  return (
    <Section title="Hesaplar" action={addBtn(() => open({ t: 'account' }))}>
      {assets.length === 0
        ? <p className="text-sm text-text-muted px-3 pb-2">Banka hesabı, nakit cüzdan, altın…</p>
        : [...assets].sort((a, b) => b.currentValue - a.currentValue).map((a) => (
          <Row key={a.id} onClick={() => open({ t: 'account', id: a.id })}
            icon={<Bubble icon={a.type === 'Nakit' ? <Banknote size={16} /> : <Landmark size={16} />} />}
            title={a.name} sub={a.bankName && a.bankName !== 'Diğer' ? a.bankName : a.type}
            right={<span className="text-[15px] font-semibold num">{fmt(a.currentValue)}</span>} />
        ))}
    </Section>
  );
}

function Debts({ debts }: { debts: Debt[] }) {
  const open = useMoneySheets((s) => s.open);
  const [showClosed, setShowClosed] = useState(false);
  const active = debts.filter((d) => !d.isPaidOff || (d.type === 'Kredi Kartı' && d.totalAmount > 0))
    .sort((a, b) => (a.dueDate || '9').localeCompare(b.dueDate || '9'));
  const closed = debts.filter((d) => !active.includes(d));

  return (
    <Section title="Borçlar & kartlar" action={addBtn(() => open({ t: 'debt' }))}>
      {active.length === 0 && <p className="text-sm text-text-muted px-3 pb-2">{debts.length ? 'Aktif borcun yok.' : 'Kredi kartı, kredi, ek hesap…'}</p>}
      {active.map((d) => {
        const rem = debtRemaining(d);
        return (
          <Row key={d.id} onClick={() => open({ t: 'debt', id: d.id })}
            icon={<Bubble icon={<CreditCard size={16} />} />}
            title={d.name}
            sub={<>
              {d.dueDate ? `${fmtShort(d.dueDate)} · ${daysLeftLabel(daysUntil(d.dueDate)).toLowerCase()}` : d.type}
              <span className="block h-1 rounded-full bg-surface-el mt-1.5 overflow-hidden max-w-[180px]">
                <span className="block h-full rounded-full" style={{ width: `${safePct(d.paidAmount, d.totalAmount)}%`, background: 'var(--accent-base)' }} />
              </span>
            </>}
            right={<span className="text-[15px] font-semibold num">{rem > 0 ? fmt(rem) : 'Kapandı'}</span>} />
        );
      })}
      {closed.length > 0 && (
        <button onClick={() => setShowClosed(!showClosed)} className="text-xs font-semibold text-text-muted px-3" style={{ minHeight: 32 }}>
          {showClosed ? 'Kapananları gizle' : `Kapananlar (${closed.length})`}
        </button>
      )}
      {showClosed && closed.map((d) => (
        <Row key={d.id} onClick={() => open({ t: 'debt', id: d.id })} icon={<Bubble icon={<CreditCard size={16} />} />}
          title={d.name} sub={d.paidOffAt ? `Kapandı · ${new Date(d.paidOffAt).toLocaleDateString('tr-TR')}` : 'Kapandı'} />
      ))}
    </Section>
  );
}

function Bills({ today }: { today: string }) {
  const { cashflows } = useFinance();
  const open = useMoneySheets((s) => s.open);
  const rows = cashflows
    .map((c) => ({ c, next: nextBillDate(c, today) }))
    .filter((x) => x.next || x.c.isRecurring)
    .sort((a, b) => (a.next || '9').localeCompare(b.next || '9'));
  const monthly = cashflows.filter((c) => c.isRecurring && c.type === 'expense').reduce((s, c) => s + c.amount, 0);

  return (
    <Section title="Abonelik & faturalar" action={addBtn(() => open({ t: 'bill' }))}>
      {rows.length === 0
        ? <p className="text-sm text-text-muted px-3 pb-2">Kira, internet, Netflix… Günü gelince "ödendi mi?" diye sorarım.</p>
        : <>
          {monthly > 0 && <p className="text-xs text-text-muted px-3 pb-1">Aylık toplam <span className="num">{fmt(monthly)}</span></p>}
          {rows.map(({ c, next }) => (
            <Row key={c.id} onClick={() => open({ t: 'bill', id: c.id })}
              icon={c.type === 'income' ? <Bubble icon={<Plus size={16} />} color="var(--accent-base)" /> : <CatIcon category={c.category || 'Abonelik'} />}
              title={c.name}
              sub={next ? `Sıradaki ${fmtShort(next)}` : 'Bitti'}
              right={<span className={`text-[15px] font-semibold num ${c.type === 'income' ? 'text-accent' : ''}`}>{c.type === 'income' ? '+' : ''}{fmt(c.amount)}</span>} />
          ))}
        </>}
    </Section>
  );
}

function Goals() {
  const { savingsGoals } = useFinance();
  const open = useMoneySheets((s) => s.open);
  return (
    <Section title="Kumbaralar" action={addBtn(() => open({ t: 'goal' }))}>
      {savingsGoals.length === 0
        ? <p className="text-sm text-text-muted px-3 pb-2">Acil durum, tatil, laptop… Hesaptan aktarınca bakiyen de güncellenir.</p>
        : savingsGoals.map((g) => (
          <Row key={g.id} onClick={() => open({ t: 'goal', id: g.id })}
            icon={<Bubble icon={<PiggyBank size={16} />} color="var(--accent-base)" />}
            title={g.name}
            sub={<span className="block h-1 rounded-full bg-surface-el mt-1 overflow-hidden max-w-[180px]">
              <span className="block h-full rounded-full" style={{ width: `${safePct(g.currentAmount, g.targetAmount)}%`, background: 'var(--accent-base)' }} />
            </span>}
            right={<span className="text-sm num"><b>{fmt(g.currentAmount)}</b> <span className="text-text-muted">/ {fmt(g.targetAmount)}</span></span>} />
        ))}
    </Section>
  );
}
