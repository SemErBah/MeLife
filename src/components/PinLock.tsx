import { Delete, Lock } from 'lucide-react';
import { useState } from 'react';

import { digest, KEY } from '../utils/pin';

export default function PinLock({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPinText] = useState('');
  const [wrong, setWrong] = useState(false);

  const press = async (d: string) => {
    const next = (pin + d).slice(0, 4);
    setPinText(next);
    setWrong(false);
    if (next.length === 4) {
      let ok = false;
      try { ok = (await digest(next)) === localStorage.getItem(KEY); } catch { /* */ }
      if (ok) onUnlock();
      else { setWrong(true); setTimeout(() => setPinText(''), 400); }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-16">
      <span className="cat-bubble" style={{ '--c': 'var(--accent-base)', width: 56, height: 56, borderRadius: 20 } as React.CSSProperties}><Lock size={24} /></span>
      <p className="font-display text-xl font-semibold">Defter kilitli</p>
      <div className={`flex gap-3 ${wrong ? 'animate-pop' : ''}`}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`w-3.5 h-3.5 rounded-full ${i < pin.length ? (wrong ? 'bg-danger' : 'bg-accent') : 'bg-surface-hover'}`} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((k) => k === '' ? <span key="e" /> : (
          <button key={k} onClick={() => (k === '⌫' ? setPinText(pin.slice(0, -1)) : press(k))}
            className="w-16 h-16 rounded-full bg-surface-el text-xl font-semibold num hover:bg-surface-hover" aria-label={k === '⌫' ? 'Sil' : k}>
            {k === '⌫' ? <Delete size={20} className="mx-auto" /> : k}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-text-muted max-w-xs text-center">Kodu unutursan: Ayarlar'da kilidi kaldırmak için aynı cihazda hesabınla giriş yapman yeterli.</p>
    </div>
  );
}
