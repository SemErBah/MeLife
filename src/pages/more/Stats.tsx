import { useMemo, useState } from 'react';
import { Segmented } from '../../components/ui';
import { CATEGORIES, SCALE_FACES } from '../../constants';
import { TrackerIcon } from '../../components/TrackerIcon';
import { useFinance } from '../../finance/store/useFinance';
import { fmt, financeToday } from '../../finance/utils/format';
import { allPeriods, spentIn } from '../../finance/utils/period';
import { useDoneCtx } from '../../hooks/useDay';
import { useStore } from '../../store/useStore';
import { fmtMinutes, shortDate } from '../../utils/date';
import { findInsights } from '../../utils/insights';
import { avg, bedMinutes, dailySeries, minutesByCourse, rangeDates, routineRates, weeklyStudy } from '../../utils/stats';

type Pt = { label: string; value: number | null };

/** Basit çubuk grafik — kayıt olmayan gün boş kalır, yargı yok */
function Bars({ data, color = 'var(--accent-base)', target, fmtV = (v: number) => String(Math.round(v)), height = 96 }: {
  data: Pt[]; color?: string; target?: number; fmtV?: (v: number) => string; height?: number;
}) {
  const max = Math.max(target ?? 0, ...data.map((d) => d.value ?? 0), 1);
  const every = Math.ceil(data.length / 7);
  return (
    <div>
      <div className="relative flex items-end gap-[2px]" style={{ height }}>
        {target !== undefined && <div className="absolute left-0 right-0 border-t border-dashed border-text-muted/40" style={{ bottom: `${(target / max) * 100}%` }} />}
        {data.map((d, i) => (
          <div key={i} className="flex-1 rounded-t-[3px]" title={d.value !== null ? `${d.label}: ${fmtV(d.value)}` : d.label}
            style={{ height: d.value ? `${Math.max(2, (d.value / max) * 100)}%` : 2, background: d.value ? color : 'var(--surface-el)', opacity: d.value ? 0.85 : 1 }} />
        ))}
      </div>
      <div className="flex gap-[2px] mt-1">
        {data.map((d, i) => <span key={i} className="flex-1 text-[9px] text-text-muted text-center truncate">{i % every === 0 ? d.label : ''}</span>)}
      </div>
    </div>
  );
}

/** Noktalı çizgi (1–5 ölçek, yatış saati) */
function Line({ data, min, max, color = 'var(--accent-base)', height = 80 }: { data: Pt[]; min: number; max: number; color?: string; height?: number }) {
  const w = 300;
  const pts = data.map((d, i) => d.value === null ? null : [(i / Math.max(1, data.length - 1)) * w, height - ((d.value - min) / (max - min)) * (height - 8) - 4] as const);
  const path = pts.filter(Boolean).map((p, i) => `${i ? 'L' : 'M'}${p![0].toFixed(1)},${p![1].toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none" aria-hidden="true">
      <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" opacity={0.7} />
      {pts.map((p, i) => p && <circle key={i} cx={p[0]} cy={p[1]} r={2.6} fill={color} />)}
    </svg>
  );
}

function Block({ title, summary, children }: { title: string; summary?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="widget">
      <div className="widget-header"><h3>{title}</h3>{summary && <span className="text-xs text-text-muted text-right">{summary}</span>}</div>
      <div className="widget-body">{children}</div>
    </section>
  );
}

const clock = (minsAfter18: number) => {
  const t = (minsAfter18 + 18 * 60) % (24 * 60);
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.round(t % 60)).padStart(2, '0')}`;
};

export default function Stats() {
  const { trackers, days, sessions, courses, journal } = useStore();
  const today = useStore((s) => s.today());
  const ctx = useDoneCtx();
  const [span, setSpan] = useState<'30' | '90'>('30');
  const dates = useMemo(() => rangeDates(today, Number(span)), [today, span]);
  const label = (d: string) => shortDate(d).split(' ')[0];

  const live = trackers.filter((t) => t.active);
  const sleepT = live.find((t) => t.type === 'sleep');
  const waterT = live.find((t) => t.key === 'water') ?? live.find((t) => t.type === 'counter' && t.unit === 'ml');
  const scales = live.filter((t) => t.type === 'scale');
  const studyT = live.find((t) => t.key === 'study');
  const reduces = live.filter((t) => t.mode === 'reduce');

  const sleep = dailySeries(sleepT, days, dates);
  const sleepAvg = avg(sleep.flatMap((s) => (s.value ? [s.value] : [])));
  const bed = bedMinutes(days, dates);
  const bedAvg = avg(bed.flatMap((b) => (b.value !== null ? [b.value] : [])));
  const water = dailySeries(waterT, days, dates);
  const waterAvg = avg(water.flatMap((w) => (w.value ? [w.value] : [])));
  const study = weeklyStudy(sessions, days, studyT, dates);
  const byCourse = minutesByCourse(sessions, dates);
  const rates = routineRates(live, days, dates, ctx);
  const insights = useMemo(() => findInsights(trackers, days, journal, rangeDates(today, 90)), [trackers, days, journal, today]);

  return (
    <div className="space-y-5">
      <Segmented value={span} onChange={setSpan} options={[{ value: '30', label: 'Son 30 gün' }, { value: '90', label: 'Son 90 gün' }]} />

      {insights.length > 0 && (
        <section className="now-card space-y-2">
          <p className="eyebrow">Keşifler · son 90 gün</p>
          <ul className="space-y-2">{insights.map((i) => <li key={i.key} className="text-[15px] leading-relaxed">🔍 {i.text}</li>)}</ul>
          <p className="text-[11px] text-text-muted">Bunlar sadece birlikte görülen şeyler; neden-sonuç değil. Yeterli kayıt yoksa hiçbir şey söylemez.</p>
        </section>
      )}

      {sleepT && (
        <Block title="Uyku" summary={sleepAvg ? <>ort. <b className="text-text-main">{fmtMinutes(sleepAvg)}</b>{bedAvg !== null ? ` · yatış ~${clock(bedAvg)}` : ''}</> : 'kayıt yok'}>
          <Bars data={sleep.map((s) => ({ label: label(s.date), value: s.value }))} color={CATEGORIES.health.color} target={sleepT.target} fmtV={fmtMinutes} />
          {bed.some((b) => b.value !== null) && (
            <div className="mt-4">
              <p className="text-[11px] text-text-muted mb-1">Yatış saati (yukarısı daha geç)</p>
              <Line data={bed.map((b) => ({ label: b.date, value: b.value }))} min={Math.min(...bed.flatMap((b) => (b.value !== null ? [b.value] : [])), 300) - 30} max={Math.max(...bed.flatMap((b) => (b.value !== null ? [b.value] : [])), 360) + 30} color={CATEGORIES.health.color} />
            </div>
          )}
        </Block>
      )}

      {waterT && (
        <Block title={waterT.name} summary={waterAvg ? <>ort. <b className="text-text-main num">{Math.round(waterAvg).toLocaleString('tr-TR')} {waterT.unit}</b></> : 'kayıt yok'}>
          <Bars data={water.map((w) => ({ label: label(w.date), value: w.value }))} color={CATEGORIES.health.color} target={waterT.target} fmtV={(v) => `${v} ${waterT.unit ?? ''}`} />
        </Block>
      )}

      {scales.map((t) => {
        const s = dailySeries(t, days, dates);
        const a = avg(s.flatMap((x) => (x.value ? [x.value] : [])));
        return (
          <Block key={t.id} title={t.name} summary={a ? <>ort. {SCALE_FACES[Math.round(a) - 1]} <b className="text-text-main">{a.toFixed(1)}</b></> : 'kayıt yok'}>
            <Line data={s.map((x) => ({ label: x.date, value: x.value }))} min={1} max={5} color={CATEGORIES.mood.color} />
          </Block>
        );
      })}

      {(studyT || sessions.length > 0) && (
        <Block title="Ders çalışma" summary={<>toplam <b className="text-text-main">{fmtMinutes(study.reduce((a, w) => a + w.minutes, 0))}</b></>}>
          <Bars data={study.map((w) => ({ label: shortDate(w.week), value: w.minutes || null }))} color={CATEGORIES.mind.color} fmtV={fmtMinutes} height={80} />
          {Object.keys(byCourse).length > 0 && (
            <ul className="mt-4 space-y-2">
              {Object.entries(byCourse).sort((a, b) => b[1] - a[1]).map(([id, m]) => (
                <li key={id} className="flex justify-between text-sm">
                  <span className="truncate">{courses.find((c) => c.id === id)?.name ?? 'Ders seçilmeden'}</span>
                  <span className="num text-text-muted">{fmtMinutes(m)}</span>
                </li>
              ))}
            </ul>
          )}
        </Block>
      )}

      {reduces.map((t) => {
        const s = dailySeries(t, days, dates);
        const a = avg(s.flatMap((x) => (x.value !== null ? [x.value] : [])));
        return (
          <Block key={t.id} title={t.name} summary={a !== null ? <>günlük ort. <b className="text-text-main">{a.toFixed(1)}</b></> : 'kayıt yok'}>
            <Bars data={s.map((x) => ({ label: label(x.date), value: x.value }))} color={CATEGORIES[t.category].color} />
          </Block>
        );
      })}

      {rates.length > 0 && (
        <Block title="Rutinler" summary="planlanan günlerin ne kadarında">
          <ul className="space-y-3">
            {rates.map((r) => (
              <li key={r.t.id} className="flex items-center gap-3">
                <span className="w-5 shrink-0" style={{ color: CATEGORIES[r.t.category].color }}><TrackerIcon name={r.t.icon} size={15} /></span>
                <span className="text-sm w-28 truncate shrink-0">{r.t.name}</span>
                <span className="flex-1 h-1.5 rounded-full bg-surface-el overflow-hidden">
                  <span className="block h-full rounded-full" style={{ width: `${r.pct * 100}%`, background: CATEGORIES[r.t.category].color }} />
                </span>
                <span className="text-xs text-text-muted num w-12 text-right shrink-0">{r.done}/{r.planned}</span>
              </li>
            ))}
          </ul>
        </Block>
      )}

      <MoneyBlock />
    </div>
  );
}

function MoneyBlock() {
  const { transactions } = useFinance();
  const periods = useMemo(() => allPeriods(transactions, financeToday()).slice(0, 6).reverse(), [transactions]);
  const data = periods.map((p) => ({ label: shortDate(p.start), value: spentIn(transactions, p) || null }));
  if (!data.some((d) => d.value)) return null;
  return (
    <Block title="Harcama" summary="dönem dönem (maaştan maaşa)">
      <Bars data={data} color="var(--text-muted)" fmtV={fmt} height={80} />
    </Block>
  );
}
