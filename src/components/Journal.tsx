import { Camera, RefreshCw, Star, Trash2, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { SCALE_FACES } from '../constants';
import { useStore } from '../store/useStore';
import { run, toast, undoToast } from '../store/useUI';
import type { JournalEntry } from '../types';
import { longDate, nowHHMM } from '../utils/date';
import { haptic } from '../utils/haptic';
import { compressImage } from '../utils/image';
import { extractPeople, extractTags, MOOD_COLOR } from '../utils/journal';
import { promptFor } from '../utils/prompts';
import VoiceButton from './VoiceButton';

/* ═══ Yazma alanı (yeni kayıt ya da düzenleme) ════════ */

export function JournalEditor({ entry, date, onDone, autoFocus }: {
  entry?: JournalEntry; date?: string; onDone?: () => void; autoFocus?: boolean;
}) {
  const { saveItem, removeItem, restoreItem, people } = useStore();
  const today = useStore((s) => s.today());
  const day = entry?.date ?? date ?? today;
  const [shift, setShift] = useState(0);
  const prompt = entry?.prompt ?? promptFor(day, shift);
  const [title, setTitle] = useState(entry?.title ?? '');
  const [text, setText] = useState(entry?.text ?? '');
  const [mood, setMood] = useState(entry?.mood ?? 0);
  const [photo, setPhoto] = useState(entry?.photo ?? '');
  const [important, setImportant] = useState(!!entry?.important);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const pick = async (f?: File) => {
    if (!f) return;
    setBusy(true);
    try { setPhoto(await compressImage(f)); } catch { toast('Fotoğraf eklenemedi', 'error'); }
    setBusy(false);
  };

  const save = async () => {
    const body = text.trim();
    if (!body && !photo) return;
    const data: Partial<JournalEntry> = {
      date: day,
      time: entry?.time ?? nowHHMM(),
      title: title.trim(),
      text: body,
      mood: mood || 0,
      tags: extractTags(`${title} ${body}`),
      people: extractPeople(`${title} ${body}`, people),
      photo,
      important,
      prompt: body ? prompt : '',
      updatedAt: Date.now(),
      ...(entry ? {} : { createdAt: Date.now(), source: 'app' as const }),
    };
    if (await run(() => saveItem<JournalEntry>('journal', data, entry?.id), entry ? 'Kaydedildi' : 'Günlüğe yazıldı')) {
      haptic();
      if (!entry) { setTitle(''); setText(''); setMood(0); setPhoto(''); setImportant(false); }
      onDone?.();
    }
  };

  const remove = async () => {
    if (!entry) return;
    const snap = { ...entry } as unknown as Record<string, unknown>;
    if (await run(() => removeItem('journal', entry.id))) {
      onDone?.();
      undoToast('Kayıt silindi', () => restoreItem('journal', entry.id, snap));
    }
  };

  return (
    <div className="space-y-4">
      {/* Günün sorusu */}
      <div className="flex items-start gap-2">
        <p className="font-display text-lg leading-snug flex-1">{prompt}</p>
        {!entry && (
          <button type="button" onClick={() => setShift((n) => n + 1)} className="icon-btn text-text-muted hover:bg-surface-el rounded-full shrink-0" aria-label="Başka soru" title="Başka soru">
            <RefreshCw size={16} />
          </button>
        )}
      </div>

      <input className="input py-2 text-[15px] font-semibold" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Başlık (isteğe bağlı)" maxLength={80} />
      <textarea
        className="input journal-text min-h-[140px] resize-y"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Aklından geçeni yaz… #etiket ve @kişi kullanabilirsin."
        autoFocus={autoFocus}
      />

      {photo && (
        <div className="relative">
          <img src={photo} alt="" className="w-full max-h-72 object-cover rounded-2xl" />
          <button type="button" onClick={() => setPhoto('')} className="absolute top-2 right-2 icon-btn rounded-full bg-black/50 text-white" aria-label="Fotoğrafı kaldır"><X size={16} /></button>
        </div>
      )}

      {/* Ruh hali */}
      <div className="grid grid-cols-5 gap-2">
        {SCALE_FACES.map((f, i) => (
          <button key={f} type="button" onClick={() => setMood(mood === i + 1 ? 0 : i + 1)} aria-pressed={mood === i + 1}
            className={`chip-tile text-2xl py-1.5 ${mood === i + 1 ? 'active' : ''}`} aria-label={`Ruh hali ${i + 1}/5`}>{f}</button>
        ))}
      </div>

      <div className="flex items-center gap-1">
        <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        <button type="button" onClick={() => file.current?.click()} disabled={busy} className="icon-btn rounded-full text-text-muted hover:bg-surface-el" aria-label="Fotoğraf ekle" title="Fotoğraf"><Camera size={18} /></button>
        <VoiceButton onText={(t) => setText((cur) => (cur ? `${cur.trimEnd()} ${t}` : t))} />
        <button type="button" onClick={() => setImportant(!important)} aria-pressed={important}
          className={`icon-btn rounded-full ${important ? 'text-warning' : 'text-text-muted hover:bg-surface-el'}`} aria-label="Önemli an" title="Önemli an (hayat çizelgesine düşer)">
          <Star size={18} fill={important ? 'currentColor' : 'none'} />
        </button>
        <span className="flex-1" />
        {entry && <button type="button" onClick={remove} className="icon-btn rounded-full text-text-muted hover:text-danger" aria-label="Sil"><Trash2 size={17} /></button>}
        <button type="button" onClick={save} disabled={busy || (!text.trim() && !photo)} className="btn btn-primary btn-sm">{entry ? 'Kaydet' : 'Yaz'}</button>
      </div>
    </div>
  );
}

/* ═══ Akıştaki kart ═══════════════════════════════════ */

export function JournalCard({ e, onOpen, showDate }: { e: JournalEntry; onOpen: () => void; showDate?: boolean }) {
  const people = useStore((s) => s.people);
  const names = (e.people ?? []).map((id) => people.find((p) => p.id === id)?.name.split(' ')[0]).filter(Boolean);
  return (
    <button onClick={onOpen} className="card w-full text-left p-4 space-y-2 min-h-0 hover:bg-surface-el transition-colors relative overflow-hidden">
      {e.mood ? <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: MOOD_COLOR[e.mood] }} /> : null}
      <div className="flex items-center gap-2 text-xs text-text-muted">
        {showDate && <span className="font-semibold">{longDate(e.date)}</span>}
        {e.time && <span className="num">{e.time}</span>}
        {e.mood ? <span>{SCALE_FACES[e.mood - 1]}</span> : null}
        {e.important && <Star size={12} className="text-warning" fill="currentColor" />}
        {e.source === 'telegram' && <span className="pill" style={{ minHeight: 20, padding: '0 8px', fontSize: 10 }}>Telegram</span>}
      </div>
      {e.title && <p className="font-display text-lg font-semibold leading-snug">{e.title}</p>}
      {e.text && <p className="journal-text text-[15px] line-clamp-5">{e.text}</p>}
      {e.photo && <img src={e.photo} alt="" className="w-full max-h-56 object-cover rounded-xl" loading="lazy" />}
      {(e.tags?.length || names.length) ? (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {e.tags?.map((t) => <span key={t} className="text-[11px] font-semibold text-accent">#{t}</span>)}
          {names.map((n) => <span key={n} className="text-[11px] font-semibold text-[var(--cat-social)]">@{n}</span>)}
        </div>
      ) : null}
    </button>
  );
}
