import { useStore } from '../store/useStore';

/** Tik/ekleme anında çok kısa titreşim (Android). Ayarlardan kapatılabilir. */
export function haptic(ms = 12) {
  if (useStore.getState().settings.haptics === false) return;
  try { navigator.vibrate?.(ms); } catch { /* desteklenmiyor */ }
}
