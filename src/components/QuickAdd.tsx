import { motion } from 'framer-motion';
import { ArrowLeftRight, Banknote, BookHeart, Lightbulb, ListTodo, Minus, Plus, Repeat } from 'lucide-react';
import { useState } from 'react';
import { CATEGORIES } from '../constants';
import { TrackerIcon } from './TrackerIcon';
import { useMoneySheets, type MoneySheet } from '../finance/store/useMoneySheets';
import { useDay } from '../hooks/useDay';
import { useSheets } from '../store/useSheets';
import { useStore } from '../store/useStore';
import { run } from '../store/useUI';
import Modal from './Modal';
import { useLogContact } from '../hooks/useLogContact';

const MONEY_OPTIONS: { label: string; icon: React.ReactNode; sheet: MoneySheet }[] = [
  { label: 'Harcama', icon: <Minus size={18} />, sheet: { t: 'editor', preset: { kind: 'expense' } } },
  { label: 'Gelir', icon: <Plus size={18} />, sheet: { t: 'editor', preset: { kind: 'income', isIncome: true } } },
  { label: 'Transfer', icon: <ArrowLeftRight size={18} />, sheet: { t: 'editor', preset: { kind: 'transfer' } } },
  { label: 'Maaş yattı', icon: <Banknote size={18} />, sheet: { t: 'salary' } },
  { label: 'Fatura', icon: <Repeat size={18} />, sheet: { t: 'bill' } },
];

/** + butonu: görev, not, rutin kaydı ya da para */
export default function QuickAdd() {
  const { quick, setQuick } = useSheets();
  const openMoney = useMoneySheets((s) => s.open);
  const close = () => setQuick(false);

  return (
    <>
      <motion.button
        whileTap={{ scale: 0.92 }}
        onClick={() => setQuick(true)}
        className="fab-pos z-50 w-14 h-14 rounded-full bg-accent hidden lg:flex items-center justify-center"
        style={{ color: 'var(--base)', boxShadow: '0 10px 28px -8px color-mix(in srgb, var(--accent-base) 70%, transparent)' }}
        aria-label="Hızlı ekle"
      >
        <Plus size={26} strokeWidth={2.6} />
      </motion.button>
      <Modal isOpen={quick} onClose={close} title="Hızlı ekle">
        {quick && <Body onMoney={(sheet) => { close(); openMoney(sheet); }} />}
      </Modal>
    </>
  );
}

function Body({ onMoney }: { onMoney: (s: MoneySheet) => void }) {
  const today = useStore((s) => s.today());
  const addInbox = useStore((s) => s.addInbox);
  const { items } = useDay(today);
  const { openTracker, openTask, setQuick } = useSheets();
  const [text, setText] = useState('');

  const saveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = text.trim();
    if (!v) return;
    if (await run(() => addInbox(v), "Aklımdakiler'e eklendi")) { setText(''); setQuick(false); }
  };

  return (
    <div className="space-y-7">
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => openTask(null)} className="btn btn-primary py-3.5"><ListTodo size={18} /> Görev</button>
        <button onClick={() => { setQuick(false); useStore.getState().setTab('notes'); }} className="btn btn-ghost py-3.5"><BookHeart size={18} /> Günlüğe yaz</button>
      </div>

      <TalkedTo />

      <div>
        <p className="field-label">Para</p>
        <div className="grid grid-cols-5 gap-1.5">
          {MONEY_OPTIONS.map((o) => (
            <button key={o.label} onClick={() => onMoney(o.sheet)} className="chip-tile py-2.5 px-1">
              <span className="cat-bubble sm" style={{ '--c': 'var(--accent-base)' } as React.CSSProperties}>{o.icon}</span>
              <span className="text-[10px] font-semibold leading-tight text-center">{o.label}</span>
            </button>
          ))}
        </div>
      </div>

      {items.length > 0 && (
        <div>
          <p className="field-label">Bugüne kayıt ekle</p>
          <div className="grid grid-cols-4 gap-2">
            {items.map(({ t, done }) => (
              <button
                key={t.id}
                onClick={() => openTracker(t.id, today)}
                className={`chip-tile ${done ? 'active' : ''}`}
                style={{ '--c': CATEGORIES[t.category].color } as React.CSSProperties}
              >
                <span className="cat-bubble sm"><TrackerIcon name={t.icon} size={16} /></span>
                <span className="text-[11px] font-semibold leading-tight text-center line-clamp-2">{t.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={saveNote} className="space-y-3">
        <p className="section-title"><Lightbulb size={18} className="text-warning" /> Aklımdakiler</p>
        <p className="text-xs text-text-muted -mt-2">Kafandakini boşalt. Pazar günü ayıklarsın.</p>
        <textarea
          className="input min-h-[84px] resize-none"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ör: inverter garanti belgesini bul"
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveNote(e); }}
        />
        <button type="submit" disabled={!text.trim()} className="btn btn-primary w-full">Not olarak kaydet</button>
      </form>
    </div>
  );
}

/** "Kişiyle konuştum": en uzun süredir konuşulmayanlar önce */
function TalkedTo() {
  const people = useStore((s) => s.people);
  const setQuick = useSheets((s) => s.setQuick);
  const logContact = useLogContact();
  if (!people.length) return null;
  const sorted = [...people].sort((a, b) => (a.lastContact ?? '').localeCompare(b.lastContact ?? '')).slice(0, 8);
  return (
    <div>
      <p className="field-label">Kişiyle konuştum</p>
      <div className="flex flex-wrap gap-1.5">
        {sorted.map((p) => (
          <button key={p.id} onClick={async () => { if (await logContact(p.id, 'talk')) setQuick(false); }} className="pill">{p.name.split(' ')[0]}</button>
        ))}
      </div>
    </div>
  );
}
