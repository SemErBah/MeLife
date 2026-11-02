import { useState } from 'react';

/* Defter kilidi: 4 haneli kod. Bir gizlilik perdesidir, şifreleme değildir.
   Kodun özeti yalnızca bu cihazda tutulur; açıkken uygulama kapanana kadar açık kalır. */

export const KEY = 'melife-notebook-pin';
const OPEN = 'melife-notebook-open';

export async function digest(pin: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`melife:${pin}`));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const pinSet = () => { try { return !!localStorage.getItem(KEY); } catch { return false; } };
const isOpen = () => { try { return sessionStorage.getItem(OPEN) === '1'; } catch { return false; } };

export async function setPin(pin: string | null) {
  try {
    if (pin) localStorage.setItem(KEY, await digest(pin));
    else localStorage.removeItem(KEY);
    sessionStorage.setItem(OPEN, '1');
  } catch { /* yok say */ }
}

export function useNotebookLock() {
  const [open, setOpen] = useState(() => !pinSet() || isOpen());
  return { locked: !open, unlock: () => { try { sessionStorage.setItem(OPEN, '1'); } catch { /* */ } setOpen(true); } };
}
