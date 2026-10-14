import { Bell, BellOff, Pause, Play, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { CATEGORIES, ICONS, TRACKER_TYPES } from '../constants';
import { TrackerIcon } from './TrackerIcon';
import { newTrackerId, REDUCE_TEMPLATES, TEMPLATES, type Template } from '../services/seed';
import { useSheets } from '../store/useSheets';
import { useStore } from '../store/useStore';
import { confirmAction, run } from '../store/useUI';
import type { Category, ReducePlan, Reminder, Tracker, TrackerMode, TrackerType } from '../types';
import { WEEKDAY_LETTERS } from '../utils/date';
import Modal from './Modal';
import { Field, Segmented, Toggle } from './ui';

/** Rutin ekle / düzenle — her şey isteğe bağlı, sadece isim gerekli */
export default function RoutineEditor() {
  const sheet = useSheets((s) => s.routine);
  const close = useSheets((s) => s.close);
  const tracker = useStore((s) => s.trackers.find((t) => t.id === sheet?.id));
  return (
    <Modal isOpen={!!sheet} onClose={close} title={sheet?.id ? 'Düzenle' : sheet?.mode === 'reduce' ? 'Azaltmak istediğim' : 'Yeni rutin'}>
      {sheet && <Body key={`${sheet.id ?? 'new'}-${sheet.mode ?? ''}`} initial={tracker} presetMode={sheet.mode} />}
    </Modal>
  );
}

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Pzt → Paz

const blank = (mode: TrackerMode = 'build'): Omit<Tracker, 'id' | 'order'> => (mode === 'reduce'
  ? { name: '', icon: 'cigarette', category: 'health', type: 'counter', step: 1, unit: 'adet', active: true, mode,
      reduce: { start: 10, stepPerWeek: 1, floor: 0, startDate: '' } }
  : { name: '', icon: 'sparkles', category: 'order', type: 'check', active: true });

function Body({ initial, presetMode }: { initial?: Tracker; presetMode?: TrackerMode }) {
  const { trackers, saveTracker, removeTracker, addTemplates } = useStore();
  const close = useSheets((s) => s.close);
  const isNew = !initial;
  const today = useStore((s) => s.today());
  const [t, setT] = useState<Omit<Tracker, 'id' | 'order'>>(initial ?? blank(presetMode));
  const isReduce = t.mode === 'reduce';
  const setPlan = (patch: Partial<ReducePlan>) => setT((cur) => ({ ...cur, reduce: { ...cur.reduce!, ...patch } }));
  const [showIcons, setShowIcons] = useState(false);
  const set = (patch: Partial<Tracker>) => setT((cur) => ({ ...cur, ...patch }));
  const num = (v: string) => (v.trim() === '' ? undefined : Math.max(0, Number(v.replace(',', '.')) || 0));

  const usedNames = new Set(trackers.map((x) => x.name));
  const templates = (isReduce ? REDUCE_TEMPLATES : TEMPLATES).filter((tpl) => !usedNames.has(tpl.name));

  const pickTemplate = (tpl: Template) => {
    const { tid: _tid, suggested: _s, ...rest } = tpl;
    setT({ ...rest, active: true });
  };

  const save = async () => {
    const name = t.name.trim();
    if (!name) return;
    const ids = new Set(trackers.map((x) => x.id));
    const data: Tracker = {
      ...t,
      ...(isReduce ? { type: 'counter' as const, step: 1, reduce: { ...t.reduce!, startDate: t.reduce!.startDate || today } } : {}),
      name,
      id: initial?.id ?? newTrackerId(name, ids),
      order: initial?.order ?? trackers.length,
      reminders: (t.reminders ?? []).filter((r) => r.time),
    };
    if (await run(() => saveTracker(data), isNew ? 'Rutin eklendi' : 'Kaydedildi')) close();
  };

  const remove = async () => {
    if (!initial) return;
    const ok = await confirmAction({
      title: `"${initial.name}" silinsin mi?`,
      message: 'Rutin listeden kalkar. Geçmiş kayıtların istatistiklerde görünmez olur.\nSadece ara vermek istiyorsan "Duraklat"ı kullan.',
      confirmLabel: 'Sil', danger: true,
    });
    if (ok && await run(() => removeTracker(initial.id), 'Silindi')) close();
  };

  const reminders = t.reminders ?? [];
  const setReminder = (i: number, patch: Partial<Reminder>) =>
    set({ reminders: reminders.map((r, j) => (j === i ? { ...r, ...patch } : r)) });

  const color = CATEGORIES[t.category].color;

  return (
    <div className="space-y-6" style={{ '--c': color } as React.CSSProperties}>
      {/* Yapmak mı, azaltmak mı? (yalnızca yeni) */}
      {isNew && (
        <Segmented<TrackerMode> value={t.mode ?? 'build'} onChange={(m) => setT(blank(m))} options={[
          { value: 'build', label: 'Yapmak istediğim' },
          { value: 'reduce', label: 'Azaltmak istediğim' },
        ]} />
      )}

      {/* Şablonlar (yalnızca yeni) */}
      {isNew && templates.length > 0 && (
        <div>
          <p className="field-label">Hazır şablondan seç (isteğe bağlı)</p>
          <div className="flex flex-wrap gap-1.5">
            {templates.map((tpl) => (
              <button key={tpl.tid} onClick={() => pickTemplate(tpl)} className={`pill ${t.name === tpl.name ? 'active' : ''}`}>
                <TrackerIcon name={tpl.icon} size={13} /> {tpl.name}
              </button>
            ))}
          </div>
          {!isReduce && templates.length > 1 && (
            <button
              onClick={async () => { if (await run(() => addTemplates(templates.filter((x) => x.suggested)), 'Önerilenler eklendi')) close(); }}
              className="text-xs font-semibold text-accent mt-2" style={{ minHeight: 32 }}
            >
              ya da önerilenlerin hepsini ekle →
            </button>
          )}
        </div>
      )}

      {/* İsim + ikon */}
      <div className="flex gap-3 items-end">
        <button onClick={() => setShowIcons(!showIcons)} className="cat-bubble" style={{ width: 52, height: 52, borderRadius: 18 }} aria-label="İkon seç">
          <TrackerIcon name={t.icon} size={24} />
        </button>
        <div className="flex-1">
          <Field label="İsim">
            <input className="input" value={t.name} onChange={(e) => set({ name: e.target.value })} placeholder={isReduce ? 'Ör: Sigara' : 'Ör: Diş fırçala'} autoFocus={!isNew} maxLength={40} />
          </Field>
        </div>
      </div>
      {showIcons && (
        <div className="grid grid-cols-8 gap-1.5">
          {Object.keys(ICONS).map((k) => (
            <button key={k} onClick={() => { set({ icon: k }); setShowIcons(false); }} className={`chip-tile py-2 ${t.icon === k ? 'active' : ''}`} aria-label={k}>
              <TrackerIcon name={k} size={18} />
            </button>
          ))}
        </div>
      )}

      {/* Kategori */}
      <Field label="Alan">
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(CATEGORIES) as Category[]).map((c) => (
            <button key={c} onClick={() => set({ category: c })} className={`pill ${t.category === c ? 'active' : ''}`}
              style={t.category === c ? { color: CATEGORIES[c].color, borderColor: CATEGORIES[c].color } : undefined}>
              <span className="w-2 h-2 rounded-full" style={{ background: CATEGORIES[c].color }} /> {CATEGORIES[c].label}
            </button>
          ))}
        </div>
      </Field>

      {/* Azaltma planı */}
      {isReduce && t.reduce && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Şu an günde kaç?"><input className="input num" inputMode="numeric" value={t.reduce.start || ''} onChange={(e) => setPlan({ start: num(e.target.value) ?? 0 })} /></Field>
            <Field label="Birim"><input className="input" value={t.unit ?? ''} onChange={(e) => set({ unit: e.target.value || undefined })} placeholder="adet" /></Field>
            <Field label="Her hafta kaç azalsın?" hint="0 = sınır sabit kalır"><input className="input num" inputMode="numeric" value={t.reduce.stepPerWeek} onChange={(e) => setPlan({ stepPerWeek: num(e.target.value) ?? 0 })} /></Field>
            <Field label="Nereye kadar?" hint="0 = tamamen bırakmak"><input className="input num" inputMode="numeric" value={t.reduce.floor} onChange={(e) => setPlan({ floor: num(e.target.value) ?? 0 })} /></Field>
          </div>
          {t.reduce.start > 0 && (
            <p className="text-xs text-text-muted rounded-xl bg-surface-el px-3 py-2.5 leading-relaxed">
              {t.reduce.stepPerWeek > 0
                ? <>Bu hafta en fazla <b className="text-text-main">{t.reduce.start}</b>, gelecek hafta <b className="text-text-main">{Math.max(t.reduce.floor, t.reduce.start - t.reduce.stepPerWeek)}</b>… Bu tempoyla yaklaşık <b className="text-text-main">{Math.ceil(Math.max(0, t.reduce.start - t.reduce.floor) / t.reduce.stepPerWeek)} hafta</b> sonra {t.reduce.floor === 0 ? 'bırakmış olursun' : `günde ${t.reduce.floor}'e inersin`}. Tempoyu istediğin an değiştirebilirsin.</>
                : <>Sınır her gün <b className="text-text-main">{t.reduce.start}</b> olarak kalır.</>}
            </p>
          )}
          <div className="grid grid-cols-3 gap-3">
            <Field label="Paket fiyatı ₺"><input className="input num" inputMode="decimal" value={t.reduce.unitPrice ?? ''} onChange={(e) => setPlan({ unitPrice: num(e.target.value) })} placeholder="—" /></Field>
            <Field label="Pakette"><input className="input num" inputMode="numeric" value={t.reduce.perPack ?? ''} onChange={(e) => setPlan({ perPack: num(e.target.value) })} placeholder="20" /></Field>
            <Field label="Ara (dk)"><input className="input num" inputMode="numeric" value={t.reduce.minGapMin ?? ''} onChange={(e) => setPlan({ minGapMin: num(e.target.value) })} placeholder="—" /></Field>
          </div>
          <p className="text-[11px] text-text-muted -mt-2">Fiyat girersen cebinde kalan parayı, ara girersen iki tane arasında hedef süreyi gösteririm. İkisi de isteğe bağlı.</p>
        </div>
      )}

      {/* Tür */}
      {!isReduce && <>
      <Field label="Nasıl kaydedeceksin?">
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(TRACKER_TYPES) as TrackerType[]).map((k) => (
            <button key={k} onClick={() => set({ type: k })} className={`chip-tile px-2 ${t.type === k ? 'active' : ''}`}>
              <span className="text-sm font-bold">{TRACKER_TYPES[k].label}</span>
              <span className="text-[10px] text-text-muted leading-tight text-center">{TRACKER_TYPES[k].desc}</span>
            </button>
          ))}
        </div>
      </Field>

      {/* Türe göre ayrıntı */}
      {(t.type === 'counter' || t.type === 'duration' || t.type === 'number') && (
        <div className="grid grid-cols-3 gap-3">
          {t.type !== 'duration' && (
            <Field label="Birim"><input className="input" value={t.unit ?? ''} onChange={(e) => set({ unit: e.target.value || undefined })} placeholder="ml" /></Field>
          )}
          <Field label={t.type === 'duration' ? 'Hedef (dk)' : 'Günlük hedef'}>
            <input className="input num" inputMode="decimal" value={t.target ?? ''} onChange={(e) => set({ target: num(e.target.value) })} placeholder="—" />
          </Field>
          {t.type === 'counter' && (
            <Field label="+ adım"><input className="input num" inputMode="decimal" value={t.step ?? ''} onChange={(e) => set({ step: num(e.target.value) })} placeholder="1" /></Field>
          )}
          {t.type === 'duration' && (
            <Field label="Sayılır (dk)"><input className="input num" inputMode="decimal" value={t.doneAt ?? ''} onChange={(e) => set({ doneAt: num(e.target.value) })} placeholder="hedef" /></Field>
          )}
        </div>
      )}

      {/* Günler + saat */}
      <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
        <Field label="Hangi günler?" hint={!t.days?.length ? 'Seçmezsen her gün' : undefined}>
          <div className="flex gap-1">
            {DAY_ORDER.map((d) => {
              const on = !!t.days?.includes(d);
              return (
                <button key={d} type="button"
                  onClick={() => set({ days: on ? t.days!.filter((x) => x !== d) : [...(t.days ?? []), d] })}
                  className={`flex-1 min-w-0 h-10 rounded-xl text-xs font-bold transition-colors ${on ? 'bg-accent text-[var(--base)]' : 'bg-surface-el text-text-muted'}`}
                  style={{ minHeight: 40 }}
                >{WEEKDAY_LETTERS[d]}</button>
              );
            })}
          </div>
        </Field>
        <Field label="Saat">
          <input type="time" className="input num w-[110px]" value={t.time ?? ''} onChange={(e) => set({ time: e.target.value || undefined })} />
        </Field>
      </div>

      <Field label="Haftalık niyet (isteğe bağlı)" hint="Ör: haftada 4 gün. Sadece bilgi olarak gösterilir.">
        <input className="input num" inputMode="numeric" value={t.weeklyTimes ?? ''} onChange={(e) => set({ weeklyTimes: num(e.target.value) || undefined })} placeholder="—" />
      </Field>

      </>}

      <Field label="Kısa not (isteğe bağlı)">
        <input className="input" value={t.hint ?? ''} onChange={(e) => set({ hint: e.target.value || undefined })} placeholder="Ör: Instagram'dan önce" maxLength={60} />
      </Field>

      {/* Odak modu */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-semibold text-sm">Odak modunda da göster</p>
          <p className="text-xs text-text-muted mt-0.5">Sınav haftası gibi yoğun günlerde de görünsün ve anımsatsın.</p>
        </div>
        <Toggle checked={!!t.focus} onChange={(v) => set({ focus: v || undefined })} label="Odak modunda da göster" />
      </div>

      {/* Anımsatıcılar */}
      <div>
        <p className="field-label flex items-center gap-1.5"><Bell size={13} /> Anımsatıcılar</p>
        <div className="space-y-2">
          {reminders.map((r, i) => (
            <div key={i} className="rounded-2xl border border-border p-3 space-y-2">
              <div className="flex items-center gap-2">
                <input type="time" className="input num w-[110px] py-2" value={r.time} onChange={(e) => setReminder(i, { time: e.target.value })} />
                <input className="input py-2 flex-1" value={r.message ?? ''} onChange={(e) => setReminder(i, { message: e.target.value || undefined })} placeholder={`${t.name || 'Bunu'} yaptın mı?`} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted flex items-center gap-1.5">
                  {r.on ? <Bell size={12} /> : <BellOff size={12} />} {r.on ? 'Açık' : 'Kapalı'}
                </span>
                <div className="flex items-center gap-2">
                  <Toggle checked={r.on} onChange={(on) => setReminder(i, { on })} label="Anımsatıcı açık" />
                  <button onClick={() => set({ reminders: reminders.filter((_, j) => j !== i) })} className="icon-btn text-text-muted hover:text-danger" aria-label="Anımsatıcıyı sil"><X size={16} /></button>
                </div>
              </div>
            </div>
          ))}
          <button onClick={() => set({ reminders: [...reminders, { time: t.time ?? '09:00', on: true }] })} className="pill">
            <Plus size={13} /> Anımsatıcı ekle
          </button>
          <p className="text-[11px] text-text-muted">Telegram'dan soru olarak gelir; zaten yaptıysan gelmez. Bağlamak için: Daha → Anımsatıcılar.</p>
        </div>
      </div>

      {/* Kaydet */}
      <div className="space-y-2 pt-2">
        <button onClick={save} disabled={!t.name.trim()} className="btn btn-primary w-full">{isNew ? 'Ekle' : 'Kaydet'}</button>
        {!isNew && (
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => run(() => saveTracker({ ...initial!, paused: !initial!.paused }), initial!.paused ? 'Devam ediyor' : 'Duraklatıldı').then((ok) => ok && close())} className="btn btn-ghost">
              {initial!.paused ? <><Play size={16} /> Devam et</> : <><Pause size={16} /> Duraklat</>}
            </button>
            <button onClick={remove} className="btn btn-soft-danger"><Trash2 size={16} /> Sil</button>
          </div>
        )}
      </div>
    </div>
  );
}
