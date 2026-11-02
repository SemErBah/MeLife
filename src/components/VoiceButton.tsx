import { Mic, MicOff } from 'lucide-react';
import { useRef, useState } from 'react';

/* Sesle yazma — tarayıcının konuşma tanıması (Chrome: Android, tablet, masaüstü). Desteklenmiyorsa görünmez. */

interface Recognition {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void; stop: () => void;
}

const Ctor = (): (new () => Recognition) | undefined => {
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};

const voiceSupported = () => typeof window !== 'undefined' && !!Ctor();

export default function VoiceButton({ onText, className = '' }: { onText: (text: string) => void; className?: string }) {
  const [on, setOn] = useState(false);
  const rec = useRef<Recognition | null>(null);
  if (!voiceSupported()) return null;

  const toggle = () => {
    if (on) { rec.current?.stop(); return; }
    const R = Ctor()!;
    const r = new R();
    r.lang = 'tr-TR';
    r.continuous = true;
    r.interimResults = false;
    r.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) onText(res[0].transcript.trim());
      }
    };
    r.onend = () => setOn(false);
    r.onerror = () => setOn(false);
    rec.current = r;
    r.start();
    setOn(true);
  };

  return (
    <button type="button" onClick={toggle} className={`icon-btn rounded-full ${on ? 'bg-danger-dim text-danger animate-pulse' : 'text-text-muted hover:bg-surface-el'} ${className}`}
      aria-label={on ? 'Dinlemeyi durdur' : 'Sesle yaz'} aria-pressed={on} title="Sesle yaz">
      {on ? <MicOff size={18} /> : <Mic size={18} />}
    </button>
  );
}
