import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight, Hourglass, PiggyBank, Plus, ShieldCheck, TrendingDown, Undo2, Wind, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { CATEGORIES } from '../constants';
import { TrackerIcon } from './TrackerIcon';
import { useSheets } from '../store/useSheets';
import { useMoneySheets } from '../finance/store/useMoneySheets';
import { useStore } from '../store/useStore';
import { run, toast } from '../store/useUI';
import type { Tracker } from '../types';
import { fmtClock, WEEKDAY_LETTERS, weekday } from '../utils/date';
import { countOn, daysToNextStep, DEFAULT_TRIGGERS, lastTime, limitFor, reduceStats, sinceText } from '../utils/reduce';
import { Ring } from './ui';

const fmtTL = (n: number) => `${Math.round(n).toLocaleString('tr-TR')} ₺`;

/* ═══ Bugün ekranındaki kart ═══════════════════════════ */

export function ReduceCard({ t }: { t: Tracker }) {
  const today = useStore((s) => s.today());
  const days = useStore((s) => s.days);
  const now = useStore((s) => s.now);
  const { logReduce, tagReduce } = useStore();
  const { openTracker, openUrge } = useSheets();
  const [askTag, setAskTag] = useState(false);

  const plan = t.reduce!;
  const count = countOn(t.id, days[today]);
  const limit = limitFor(plan, today);
  const last = lastTime(t.id, days, today);
  const sinceMs = last ? Math.max(0, now.getTime() - last) : null;
  const over = count > limit;
  const color = CATEGORIES[t.category].color;
  const gapLeft = plan.minGapMin && sinceMs !== null ? plan.minGapMin - Math.floor(sinceMs / 60_000) : 0;

  // Etiket sorusu birkaç saniye sonra kendiliğinden kaybolur
  useEffect(() => {
    if (!askTag) return;
    const id = setTimeout(() => setAskTag(false), 9000);
    return () => clearTimeout(id);
  }, [askTag]);

  const plusOne = async () => {
    if (await run(() => logReduce(t.id))) setAskTag(true);
  };

  return (
    <div className="card p-4 space-y-4" style={{ '--c': color } as React.CSSProperties}>
      <button onClick={() => openTracker(t.id, today)} className="w-full flex items-center gap-3 text-left min-h-0">
        <span className="cat-bubble"><TrackerIcon name={t.icon} /></span>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-[15px]">{t.name}</p>
          <p className="text-xs text-text-muted">
            {sinceMs === null ? 'Bugün henüz yok' : sinceMs < 60_000 ? 'Sonuncusu az önce' : `Sonuncusu ${sinceText(sinceMs)} önce`}
            {gapLeft > 0 && ` · ${plan.minGapMin} dk ara hedefine ${gapLeft} dk var`}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-extrabold num leading-none">{count}<span className="text-sm text-text-muted font-semibold"> / {limit}</span></p>
          <p className="text-[10px] text-text-muted font-semibold mt-1">bugünkü sınır</p>
        </div>
        <ChevronRight size={16} className="text-text-muted" />
      </button>

      {/* Sınır çizgisi: aşılırsa sadece renk değişir, ceza yok */}
      <div className="h-2 rounded-full bg-surface-el overflow-hidden">
        <div className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${Math.min(100, limit ? (count / limit) * 100 : count ? 100 : 0)}%`, background: over ? 'var(--warning-base)' : color }} />
      </div>
      {over && <p className="text-xs text-text-muted -mt-2">Bugünkü sınırı geçtin. Sorun değil, sayman bile önemli bir adım.</p>}

      <AnimatePresence mode="wait">
        {askTag ? (
          <motion.div key="tags" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-2">
            <p className="text-xs text-text-muted">Kaydedildi. Neden olduğunu yazmak ister misin? (isteğe bağlı)</p>
            <div className="flex flex-wrap gap-1.5">
              {DEFAULT_TRIGGERS.map((tag) => (
                <button key={tag} onClick={() => { setAskTag(false); run(() => tagReduce(t.id, tag)); }} className="pill">{tag}</button>
              ))}
              <button onClick={() => setAskTag(false)} className="pill"><X size={12} /> Geç</button>
            </div>
          </motion.div>
        ) : (
          <motion.div key="actions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-2 gap-2">
            <button onClick={() => openUrge(t.id)} className="btn btn-soft-accent"><Wind size={16} /> İstek geldi</button>
            <button onClick={plusOne} className="btn btn-ghost"><Plus size={16} /> 1 {t.unit === 'adet' ? 'içtim' : (t.unit ?? 'kayıt')}</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══ "İstek geldi" — 5 dakikalık nefes alanı ════════════ */

const URGE_SECONDS = 5 * 60;
const TIPS = [
  'Bir bardak su iç.',
  '10 yavaş nefes: 4 saniye al, 6 saniye ver.',
  'Kalk, 2 dakika yürü ya da cama çık.',
  'Ellerini meşgul et: sakız, çay, telefonda kısa bir mesaj.',
  'İstek dalga gibidir: yükselir, zirve yapar, geçer.',
  'Şu an neden istediğini fark et: alışkanlık mı, stres mi, can sıkıntısı mı?',
];

export function UrgeOverlay() {
  const id = useSheets((s) => s.urge);
  const openUrge = useSheets((s) => s.openUrge);
  const t = useStore((s) => s.trackers.find((x) => x.id === id));
  const { logUrge, logReduce } = useStore();
  const [started, setStarted] = useState<{ id: string | null; at: number }>({ id: null, at: 0 });
  const [nowMs, setNowMs] = useState(0);
  if (id && started.id !== id) setStarted({ id, at: nowMs || started.at });
  const startedAt = started.at;

  useEffect(() => {
    if (!id) return;
    const tick = () => setNowMs(Date.now());
    const first = setTimeout(() => { setStarted({ id, at: Date.now() }); tick(); }, 0);
    const iv = setInterval(tick, 1000);
    return () => { clearTimeout(first); clearInterval(iv); };
  }, [id]);

  const elapsed = Math.max(0, (nowMs - startedAt) / 1000);
  const left = Math.max(0, URGE_SECONDS - elapsed);
  const tip = TIPS[Math.floor(elapsed / 20) % TIPS.length];
  const color = t ? CATEGORIES[t.category].color : 'var(--accent-base)';

  const passed = async () => {
    openUrge(null);
    if (t && await run(() => logUrge(t.id))) toast('Bir isteği atlattın. 👏');
  };
  const gaveIn = async () => {
    openUrge(null);
    if (t) await run(() => logReduce(t.id), 'Kaydedildi. Denemen bile değerli.');
  };

  return (
    <AnimatePresence>
      {id && t && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[1000] flex flex-col items-center justify-between bg-base px-6"
          style={{ paddingTop: 'calc(24px + env(safe-area-inset-top))', paddingBottom: 'calc(32px + env(safe-area-inset-bottom))' }}
          role="dialog" aria-modal="true" aria-label="İstek geldi"
        >
          <div className="w-full max-w-md flex items-center justify-between">
            <span className="eyebrow">{t.name} · istek</span>
            <button onClick={() => openUrge(null)} className="icon-btn text-text-muted hover:bg-surface-hover" aria-label="Kapat"><X size={20} /></button>
          </div>

          <div className="flex flex-col items-center gap-8">
            <Ring pct={1 - left / URGE_SECONDS} size={240} stroke={12} color={color}>
              <div className="text-center">
                <p className="text-5xl font-extrabold num">{fmtClock(left)}</p>
                <p className="text-xs text-text-muted mt-2 font-semibold">{left > 0 ? 'sadece bekle' : 'süre doldu'}</p>
              </div>
            </Ring>
            <AnimatePresence mode="wait">
              <motion.p key={tip} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="text-center text-lg font-semibold max-w-xs leading-relaxed">
                {tip}
              </motion.p>
            </AnimatePresence>
            <p className="text-center text-sm text-text-muted max-w-xs">
              İstek çoğu zaman birkaç dakikada geçer. İçsen de sorun değil: kaydetmen yeterli.
            </p>
          </div>

          <div className="w-full max-w-md grid grid-cols-2 gap-3">
            <button onClick={gaveIn} className="btn btn-ghost py-4">İçtim</button>
            <button onClick={passed} className="btn btn-primary py-4"><ShieldCheck size={18} /> Geçti</button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ═══ Ayrıntı: istatistik + plan (TrackerSheet içinde) ══ */

export function ReduceBody({ t }: { t: Tracker }) {
  const today = useStore((s) => s.today());
  const days = useStore((s) => s.days);
  const { undoReduce } = useStore();
  const { openRoutine, close: closeSheets } = useSheets();
  const openMoney = useMoneySheets((s) => s.open);
  const st = useMemo(() => reduceStats(t, days, today), [t, days, today]);
  const plan = t.reduce!;
  const limit = limitFor(plan, today);
  const next = daysToNextStep(plan, today);
  const count = countOn(t.id, days[today]);
  const color = CATEGORIES[t.category].color;
  const max = Math.max(plan.start, ...st.series.map((x) => x.count), 1);
  const trend = st.prevAvg7 ? st.avg7 - st.prevAvg7 : 0;

  return (
    <div className="space-y-6" style={{ '--c': color } as React.CSSProperties}>
      <div className="flex items-center gap-3">
        <span className="cat-bubble" style={{ width: 52, height: 52, borderRadius: 18 }}><TrackerIcon name={t.icon} size={24} /></span>
        <div>
          <p className="text-lg font-bold leading-tight">{t.name}</p>
          <p className="text-xs text-text-muted mt-0.5">
            Bugün {count} · sınır {limit}
            {next !== null && ` · ${next} gün sonra ${Math.max(plan.floor, limit - plan.stepPerWeek)}`}
            {plan.floor === 0 && limit === 0 && ' · bırakma dönemindesin'}
          </p>
        </div>
      </div>

      {/* Son 14 gün */}
      <div>
        <p className="field-label">Son 14 gün</p>
        <div className="flex items-end gap-1 h-32">
          {st.series.map((x) => {
            const isToday = x.date === today;
            return (
              <div key={x.date} className="flex-1 flex flex-col items-center gap-1 h-full justify-end" title={`${x.date}: ${x.count}`}>
                <span className="text-[9px] text-text-muted num">{x.logged ? x.count : ''}</span>
                <div className="w-full relative flex-1 flex items-end">
                  {/* sınır çizgisi (plan başladıktan sonra) */}
                  {x.limit !== null && <div className="absolute left-0 right-0 border-t border-dashed border-text-muted/40" style={{ bottom: `${(x.limit / max) * 100}%` }} />}
                  <div className="w-full rounded-t-md transition-[height] duration-500"
                    style={{ height: `${(x.count / max) * 100}%`, minHeight: x.logged ? 2 : 0, background: x.limit !== null && x.count > x.limit ? 'var(--warning-base)' : color, opacity: isToday ? 1 : 0.75 }} />
                </div>
                <span className={`text-[9px] ${isToday ? 'text-text-main font-bold' : 'text-text-muted'}`}>{WEEKDAY_LETTERS[weekday(x.date)]}</span>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-text-muted mt-2">Kesikli çizgi o günkü sınır.</p>
      </div>

      {/* Özet kutuları */}
      <div className="grid grid-cols-2 gap-2">
        <Stat icon={<TrendingDown size={16} />} label="Günlük ortalama" value={st.avg7 ? st.avg7.toFixed(1) : '—'}
          sub={st.prevAvg7 ? `${trend <= 0 ? '↓' : '↑'} önceki haftaya göre ${Math.abs(trend).toFixed(1)}` : st.avg7 ? `son 7 gün · başlangıç ${plan.start}` : 'ilk gün bitince hesaplanır'} />
        <Stat icon={<ShieldCheck size={16} />} label="Atlatılan istek" value={String(st.urges)} sub="İstek geldi → Geçti" />
        <Stat icon={<Hourglass size={16} />} label="Sınırda kalınan gün" value={String(st.bestStreakUnder)} sub="art arda" />
        <Stat icon={<PiggyBank size={16} />} label="Cebinde kalan"
          value={plan.unitPrice && plan.perPack ? fmtTL(st.savedMoney) : `${st.saved}`}
          sub={!st.saved && !st.avg7 ? 'biten günlerden hesaplanır' : plan.unitPrice && plan.perPack ? `${st.saved} ${t.unit ?? ''} daha az` : `${t.unit ?? ''} daha az · fiyat girersen ₺ gösterir`} />
      </div>

      {st.savedMoney >= 1 && (
        <button
          onClick={() => { closeSheets(); openMoney({ t: 'editor', preset: { kind: 'transfer', amount: Math.floor(st.savedMoney), description: `${t.name}: içilmeyen` } }); }}
          className="btn btn-soft-accent w-full"
        >
          <PiggyBank size={16} /> {fmtTL(st.savedMoney)} kumbaraya aktar
        </button>
      )}

      {st.triggers.length > 0 && (
        <div>
          <p className="field-label">En sık ne zaman?</p>
          <div className="space-y-1.5">
            {st.triggers.slice(0, 5).map((x) => (
              <div key={x.tag} className="flex items-center gap-3">
                <span className="text-sm w-28 shrink-0">{x.tag}</span>
                <div className="flex-1 h-2 rounded-full bg-surface-el overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(x.n / st.triggers[0].n) * 100}%`, background: color }} />
                </div>
                <span className="text-xs text-text-muted num w-6 text-right">{x.n}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {count > 0 && (
          <button onClick={() => run(() => undoReduce(t.id), 'Geri alındı')} className="btn btn-ghost w-full"><Undo2 size={16} /> Yanlış bastım (−1)</button>
        )}
        <button onClick={() => openRoutine(t.id)} className="btn btn-ghost w-full">Planı düzenle</button>
      </div>

      {t.icon === 'cigarette' && (
        <p className="text-[11px] text-text-muted leading-relaxed">
          Destek istersen: ALO 171 Sigara Bırakma Danışma Hattı ücretsizdir. Aile hekimin de bırakma tedavisi konusunda yardımcı olabilir.
        </p>
      )}
    </div>
  );
}

function Stat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl bg-surface-el p-3">
      <p className="text-[11px] text-text-muted font-semibold flex items-center gap-1.5">{icon} {label}</p>
      <p className="text-xl font-extrabold num mt-1">{value}</p>
      <p className="text-[10px] text-text-muted mt-0.5">{sub}</p>
    </div>
  );
}
