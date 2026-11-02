import { Footprints, Play, Shuffle } from 'lucide-react';
import { useState } from 'react';
import { useSheets } from '../store/useSheets';
import { useStore } from '../store/useStore';
import { useTimer } from '../store/useTimer';
import { run } from '../store/useUI';
import { taskSort } from '../utils/trackers';
import { nowToMin } from '../utils/date';
import { suggestTasks, type Energy } from '../utils/suggest';
import Modal from './Modal';

export const PICK = '__pick';

const IDEAS = ['Dosyayı / defteri aç', '5 dk sadece bak', 'İlk cümleyi yaz', 'Gereken şeyleri masaya koy', 'Kime ne soracağını yaz'];

/** "Başlayamıyorum": işi en küçük ilk adıma indir, 5 dakikalık sayaçla başla */
export default function StartSmall() {
  const start = useSheets((s) => s.start);
  const openStart = useSheets((s) => s.openStart);
  return (
    <Modal isOpen={!!start} onClose={() => openStart(null)} title={start === PICK ? 'Şimdi ne yapsam?' : 'Küçük başla'}>
      {start === PICK ? <Pick /> : start ? <Step key={start} taskId={start} /> : null}
    </Modal>
  );
}

const ENERGY: { id: Energy; emoji: string; label: string }[] = [
  { id: 'low', emoji: '🪫', label: 'Yorgunum' },
  { id: 'ok', emoji: '🙂', label: 'İdare eder' },
  { id: 'high', emoji: '⚡', label: 'Enerjik' },
];

/** "Şimdi ne yapsam?": enerjini sor, tek bir öneri getir; istersen listeden kendin seç */
function Pick() {
  const today = useStore((s) => s.today());
  const now = useStore((s) => s.now);
  const dayStartHour = useStore((s) => s.settings.dayStartHour);
  const all = useStore((s) => s.tasks);
  const tasks = all.filter((t) => t.forDate === today && !t.done).sort(taskSort(dayStartHour));
  const openStart = useSheets((s) => s.openStart);
  const [energy, setEnergy] = useState<Energy | null>(null);
  const [shift, setShift] = useState(0);
  const list = energy ? suggestTasks(all, energy, today, nowToMin(now, dayStartHour), dayStartHour) : [];
  const pick = list.length ? list[shift % list.length] : undefined;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-text-muted mb-2">Enerjin şu an nasıl?</p>
        <div className="grid grid-cols-3 gap-2">
          {ENERGY.map((e) => (
            <button key={e.id} onClick={() => { setEnergy(e.id); setShift(0); }} className={`chip-tile py-3 ${energy === e.id ? 'active' : ''}`}>
              <span className="text-2xl leading-none">{e.emoji}</span>
              <span className="text-xs font-semibold">{e.label}</span>
            </button>
          ))}
        </div>
      </div>

      {energy && (pick ? (
        <div className="now-card space-y-3">
          <p className="eyebrow">{energy === 'low' ? 'Hafif bir şeyle başla' : energy === 'high' ? 'Enerjin varken büyüğüne dokun' : 'Şuna ne dersin?'}</p>
          <p className="font-display text-[20px] font-semibold leading-snug">{pick.text}</p>
          <div className="flex gap-2">
            <button onClick={() => openStart(pick.id)} className="btn btn-primary flex-1"><Play size={15} fill="currentColor" /> Başla</button>
            {list.length > 1 && <button onClick={() => setShift(shift + 1)} className="btn btn-ghost shrink-0"><Shuffle size={15} /> Başka</button>}
          </div>
        </div>
      ) : (
        <p className="text-sm text-text-muted">{energy === 'low' ? 'Açık iş yok. Belki biraz dinlenmek tam da yapılacak şeydir. 🌿' : "Açık iş yok. Plan'a bir şey ekleyebilir ya da günün tadını çıkarabilirsin."}</p>
      ))}

      {tasks.length > 0 && (
        <div>
          <p className="field-label">Ya da kendin seç</p>
          {tasks.map((t) => (
            <button key={t.id} onClick={() => openStart(t.id)} className="row-item w-full text-left min-h-0">
              <Footprints size={16} className="text-accent shrink-0" />
              <span className="flex-1 text-[15px] font-medium">{t.text}</span>
              {t.effort && <span className="text-xs">{t.effort === 'light' ? '🍃' : '🧠'}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Step({ taskId }: { taskId: string }) {
  const task = useStore((s) => s.tasks.find((t) => t.id === taskId));
  const updateTask = useStore((s) => s.updateTask);
  const openStart = useSheets((s) => s.openStart);
  const startTask = useTimer((s) => s.startTask);
  const busy = useTimer((s) => !!s.running);
  const [step, setStep] = useState('');
  if (!task) return null;

  const go = async () => {
    const s = step.trim();
    if (s) {
      const note = task.note ? `İlk adım: ${s}\n${task.note}` : `İlk adım: ${s}`;
      await run(() => updateTask(task.id, { note }));
    }
    openStart(null);
    startTask(task.id, s || task.text, 5);
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow">Görev</p>
        <p className="font-display text-xl font-semibold mt-1">{task.text}</p>
      </div>
      <p className="text-sm text-text-muted leading-relaxed">
        Başlamak zor geliyorsa iş büyük görünüyordur. <b className="text-text-main">En küçük ilk adım ne?</b> Sadece onu yapacağız, 5 dakika.
      </p>
      <input className="input" value={step} onChange={(e) => setStep(e.target.value)} placeholder="Ör: Word dosyasını aç" autoFocus maxLength={80}
        onKeyDown={(e) => { if (e.key === 'Enter') go(); }} />
      <div className="flex flex-wrap gap-1.5">
        {IDEAS.map((i) => <button key={i} type="button" onClick={() => setStep(i)} className={`pill ${step === i ? 'active' : ''}`}>{i}</button>)}
      </div>
      <button onClick={go} disabled={busy} className="btn btn-primary w-full py-4"><Play size={16} fill="currentColor" /> 5 dakika başla</button>
      {busy && <p className="text-xs text-text-muted text-center">Şu an başka bir sayaç çalışıyor; önce onu bitir.</p>}
      <p className="text-[11px] text-text-muted text-center">5 dakika sonra istersen bırakırsın. Başlamak, bitirmekten daha önemli.</p>
    </div>
  );
}
