import { ExternalLink, Minus, Pencil, Play, Plus, Wallet } from 'lucide-react';
import { useState } from 'react';
import { CATEGORIES, SCALE_FACES } from '../constants';
import { TrackerIcon } from './TrackerIcon';
import { useDay } from '../hooks/useDay';
import { useSheets } from '../store/useSheets';
import { useStore } from '../store/useStore';
import { useTimer } from '../store/useTimer';
import { run } from '../store/useUI';
import { fmtMinutes, longDate, sleepMinutes } from '../utils/date';
import Modal from './Modal';
import { Field } from './ui';
import { ReduceBody } from './Reduce';
import RoutineHistory from './RoutineHistory';

/** Tek bir tracker'ın o günkü kaydını ayrıntılı düzenleme */
export default function TrackerSheet() {
  const sheet = useSheets((s) => s.tracker);
  const close = useSheets((s) => s.close);
  return (
    <Modal isOpen={!!sheet} onClose={close} title="Kayıt">
      {sheet && <Body key={`${sheet.id}-${sheet.date}`} id={sheet.id} date={sheet.date} />}
    </Modal>
  );
}

function Body({ id, date }: { id: string; date: string }) {
  const { items, day } = useDay(date);
  const all = useStore((s) => s.trackers);
  const { setEntry, bumpEntry, setSleep, setTrackerNote, setTab } = useStore();
  const close = useSheets((s) => s.close);
  const openRoutine = useSheets((s) => s.openRoutine);
  const timer = useTimer();

  const t = all.find((x) => x.id === id);
  const view = items.find((x) => x.t.id === id);
  const value = view?.value ?? day?.entries?.[id] ?? 0;
  const savedNote = day?.notes?.[id] ?? '';

  const [draft, setDraft] = useState(String(value || ''));
  const [note, setNote] = useState(savedNote);
  const [bed, setBed] = useState(day?.sleep?.bed ?? '00:00');
  const [wake, setWake] = useState(day?.sleep?.wake ?? '07:00');

  const [seenValue, setSeenValue] = useState(value);
  if (seenValue !== value) { setSeenValue(value); setDraft(String(value || '')); }

  if (!t) return <p className="text-sm text-text-muted">Bu kayıt bulunamadı.</p>;
  if (t.mode === 'reduce' && t.reduce) return <ReduceBody t={t} />;
  const color = CATEGORIES[t.category].color;
  const step = t.step ?? 1;

  const saveNote = () => { if (note !== savedNote) run(() => setTrackerNote(t.id, note.trim(), date)); };
  const saveNumber = () => {
    const n = Number(draft.replace(',', '.'));
    if (!Number.isNaN(n)) run(() => setEntry(t.id, n, date), 'Kaydedildi');
  };

  return (
    <div className="space-y-6" style={{ '--c': color } as React.CSSProperties}>
      {/* Başlık */}
      <div className="flex items-center gap-3">
        <span className="cat-bubble" style={{ width: 52, height: 52, borderRadius: 18 }}><TrackerIcon name={t.icon} size={24} /></span>
        <div className="min-w-0">
          <p className="text-lg font-bold leading-tight">{t.name}</p>
          <p className="text-xs text-text-muted mt-0.5">
            {longDate(date)} · {CATEGORIES[t.category].label}{t.time ? ` · ${t.time}` : ''}
          </p>
        </div>
      </div>
      {t.hint && <p className="text-sm text-text-muted -mt-3">{t.hint}</p>}

      {/* Türe göre düzenleyici */}
      {t.type === 'check' && (
        <button
         
          onClick={() => run(() => setEntry(t.id, value ? 0 : 1, date))}
          className={`btn w-full py-4 ${value ? 'btn-ghost' : 'btn-primary'}`}
        >
          {value ? 'Yapılmadı olarak işaretle' : 'Yaptım ✓'}
        </button>
      )}

      {t.type === 'counter' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <button disabled={value <= 0} onClick={() => run(() => bumpEntry(t.id, -step, date))} className="step-btn" style={{ minWidth: 56, minHeight: 56 }} aria-label="Azalt"><Minus size={20} /></button>
            <div className="text-center">
              <p className="text-4xl font-extrabold num" style={{ color }}>{value.toLocaleString('tr-TR')}</p>
              <p className="text-xs text-text-muted mt-1">{t.target ? `hedef ${t.target.toLocaleString('tr-TR')} ` : ''}{t.unit}</p>
            </div>
            <button onClick={() => run(() => bumpEntry(t.id, step, date))} className="step-btn tinted" style={{ minWidth: 56, minHeight: 56 }} aria-label="Arttır"><Plus size={20} /></button>
          </div>
          <div className="flex gap-2 justify-center flex-wrap">
            {[step * 2, step * 4].map((n) => (
              <button key={n} onClick={() => run(() => bumpEntry(t.id, n, date))} className="pill">+{n.toLocaleString('tr-TR')} {t.unit}</button>
            ))}
          </div>
          {t.unit === 'sayfa' && <BookLink step={step} trackerId={t.id} date={date} />}
        </div>
      )}

      {(t.type === 'duration' || t.type === 'number') && (
        <div className="space-y-3">
          {t.type === 'duration' && (
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-extrabold num" style={{ color }}>{fmtMinutes(value)}</p>
              {t.target && <p className="text-xs text-text-muted">/ hedef {fmtMinutes(t.target)}</p>}
            </div>
          )}
          <Field label={t.type === 'duration' ? 'Toplam süre (dakika)' : `Değer${t.unit ? ` (${t.unit})` : ''}`}>
            <div className="flex gap-2">
              <input className="input num" inputMode="decimal" value={draft}
                onChange={(e) => setDraft(e.target.value.replace(/[^\d.,]/g, ''))} placeholder="0" />
              <button onClick={saveNumber} className="btn btn-primary shrink-0">Kaydet</button>
            </div>
          </Field>
          {t.type === 'duration' && (
            <div className="flex gap-2 flex-wrap">
              {[10, 15, 30, 60].map((m) => (
                <button key={m} onClick={() => run(() => bumpEntry(t.id, m, date))} className="pill">+{m} dk</button>
              ))}
              {!timer.running && (
                <button onClick={() => { close(); timer.start(t.id); }} className="pill active gap-1.5"><Play size={12} fill="currentColor" /> Sayacı başlat</button>
              )}
            </div>
          )}
        </div>
      )}

      {t.type === 'scale' && (
        <div className="grid grid-cols-5 gap-2">
          {SCALE_FACES.map((f, i) => (
            <button
              key={f}
             
              onClick={() => run(() => setEntry(t.id, value === i + 1 ? 0 : i + 1, date))}
              className={`chip-tile text-3xl py-3 ${value === i + 1 ? 'active' : ''}`}
              aria-label={`${i + 1} / 5`}
            >
              {f}
              <span className="text-[10px] font-bold text-text-muted">{i + 1}</span>
            </button>
          ))}
        </div>
      )}

      {t.type === 'sleep' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Yattım"><input type="time" className="input num" value={bed} onChange={(e) => setBed(e.target.value)} /></Field>
            <Field label="Kalktım"><input type="time" className="input num" value={wake} onChange={(e) => setWake(e.target.value)} /></Field>
          </div>
          <p className="text-sm text-text-muted">Uyku: <b className="text-text-main">{fmtMinutes(sleepMinutes(bed, wake))}</b>{t.target ? ` · hedef ${fmtMinutes(t.target)}` : ''}</p>
          <button onClick={() => run(() => setSleep(t.id, bed, wake, date), 'Uyku kaydedildi')} className="btn btn-primary w-full">Kaydet</button>
        </div>
      )}

      {/* Not */}
      <Field label="Not (isteğe bağlı)">
        <textarea
          className="input min-h-[72px] resize-none"
          value={note}
         
          onChange={(e) => setNote(e.target.value)}
          onBlur={saveNote}
          placeholder={t.category === 'social' ? 'Nereye, kiminle, ne kadar?' : 'Kısa bir not…'}
        />
      </Field>

      {t.key === 'money' && (
        <button onClick={() => { close(); setTab('money'); }} className="btn btn-ghost w-full">
          <Wallet size={16} /> Para sekmesine git
        </button>
      )}
      <RoutineHistory t={t} />

      <button onClick={() => openRoutine(t.id)} className="btn btn-ghost w-full">
        <Pencil size={16} /> Rutini düzenle
      </button>
      {t.link && (
        <a href={t.link} target="_blank" rel="noreferrer" className="btn btn-ghost w-full">
          <ExternalLink size={16} /> Bağlantıyı aç
        </a>
      )}
    </div>
  );
}

/** "Kitap oku" rutini: okunan sayfayı devam eden bir kitaba da yaz (kütüphane) */
function BookLink({ step, trackerId, date }: { step: number; trackerId: string; date: string }) {
  const books = useStore((s) => s.library).filter((l) => l.kind === 'book' && l.status === 'doing');
  const { saveItem, bumpEntry } = useStore();
  if (!books.length) return null;
  const add = (id: string, n: number) => {
    const b = books.find((x) => x.id === id)!;
    const next = Math.min((b.progress ?? 0) + n, b.total || Infinity);
    const done = !!b.total && next >= b.total;
    return run(async () => {
      await bumpEntry(trackerId, n, date);
      await saveItem('library', { progress: next, updatedAt: Date.now(), ...(done ? { status: 'done', finishedAt: date } : {}) }, id);
    }, done ? `"${b.title}" bitti 🎉` : `+${n} sayfa · ${b.title}`);
  };
  return (
    <div className="rounded-2xl bg-surface-el p-3 space-y-2">
      <p className="text-xs text-text-muted">Hangi kitap? Sayfalar kütüphanede de ilerler.</p>
      {books.map((b) => (
        <div key={b.id} className="flex items-center gap-2">
          <span className="flex-1 text-sm font-medium truncate">{b.title}{b.total ? <span className="text-text-muted num"> · {b.progress ?? 0}/{b.total}</span> : null}</span>
          <button onClick={() => add(b.id, step)} className="pill shrink-0">+{step}</button>
          <button onClick={() => add(b.id, step * 2)} className="pill shrink-0">+{step * 2}</button>
        </div>
      ))}
    </div>
  );
}
