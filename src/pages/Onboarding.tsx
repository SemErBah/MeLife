import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { useState } from 'react';
import Logo from '../components/Logo';
import { CATEGORIES } from '../constants';
import { TrackerIcon } from '../components/TrackerIcon';
import { REDUCE_TEMPLATES, TEMPLATES } from '../services/seed';
import { useStore } from '../store/useStore';
import { run } from '../store/useUI';

/** İlk açılış: dayatma yok — ne takip etmek istediğini sen seçersin (ya da hiçbir şey). */
export default function Onboarding() {
  const { addTemplates, finishOnboarding } = useStore();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const toggle = (tid: string) => setPicked((cur) => {
    const next = new Set(cur);
    if (next.has(tid)) next.delete(tid); else next.add(tid);
    return next;
  });

  const finish = async (withPicked: boolean) => {
    setBusy(true);
    await run(async () => {
      if (withPicked) await addTemplates([...TEMPLATES, ...REDUCE_TEMPLATES].filter((t) => picked.has(t.tid)));
      await finishOnboarding();
    });
    setBusy(false);
  };

  return (
    <div className="min-h-dvh overflow-y-auto bg-base">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="max-w-xl mx-auto px-5 py-10 space-y-8">
        <div className="space-y-4">
          <Logo size={56} />
          <h1 className="text-3xl font-extrabold tracking-tight leading-tight">MeLife'a hoş geldin.</h1>
          <p className="text-text-muted leading-relaxed">
            Burada kural yok. Gününü ve haftanı planlarsın, istediğin şeyleri takip edersin.
            Uygulama ara sıra nazikçe sorar: <i>"dişlerini fırçaladın mı?"</i> O kadar.
          </p>
        </div>

        <div>
          <p className="section-title mb-1">Neleri takip etmek istersin?</p>
          <p className="text-xs text-text-muted mb-4">İstediğin kadar seç ya da hiçbirini seçme. Sonra her şeyi değiştirebilirsin.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {TEMPLATES.map((t) => {
              const on = picked.has(t.tid);
              return (
                <button
                  key={t.tid}
                  onClick={() => toggle(t.tid)}
                  className={`relative flex items-center gap-2.5 p-3 rounded-2xl border-[1.5px] text-left transition-colors ${on ? 'border-accent bg-accent-dim' : 'border-border-light bg-surface hover:border-border'}`}
                  style={{ '--c': CATEGORIES[t.category].color } as React.CSSProperties}
                  aria-pressed={on}
                >
                  <span className="cat-bubble sm"><TrackerIcon name={t.icon} size={16} /></span>
                  <span className="text-[13px] font-semibold leading-tight flex-1 min-w-0">{t.name}</span>
                  {on && <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-accent flex items-center justify-center text-[var(--base)]"><Check size={11} strokeWidth={3.5} /></span>}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="section-title mb-1">Azaltmak istediğin bir şey var mı?</p>
          <p className="text-xs text-text-muted mb-4">Kademeli olarak, kendi temponla. Sayıları sonra ayarlarsın.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {REDUCE_TEMPLATES.map((t) => {
              const on = picked.has(t.tid);
              return (
                <button
                  key={t.tid}
                  onClick={() => toggle(t.tid)}
                  className={`relative flex items-center gap-2.5 p-3 rounded-2xl border-[1.5px] text-left transition-colors ${on ? 'border-accent bg-accent-dim' : 'border-border-light bg-surface hover:border-border'}`}
                  style={{ '--c': CATEGORIES[t.category].color } as React.CSSProperties}
                  aria-pressed={on}
                >
                  <span className="cat-bubble sm"><TrackerIcon name={t.icon} size={16} /></span>
                  <span className="text-[13px] font-semibold leading-tight flex-1 min-w-0">{t.name}</span>
                  {on && <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-accent flex items-center justify-center text-[var(--base)]"><Check size={11} strokeWidth={3.5} /></span>}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <button disabled={busy || picked.size === 0} onClick={() => finish(true)} className="btn btn-primary w-full py-4 text-base">
            {picked.size ? `${picked.size} şeyle başla` : 'Bir şey seç ya da geç'}
          </button>
          <button disabled={busy} onClick={() => finish(false)} className="btn btn-ghost w-full">Şimdilik hiçbiri, boş başla</button>
        </div>
      </motion.div>
    </div>
  );
}
