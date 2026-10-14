import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info';

interface Toast { id: number; message: string; type: ToastType; action?: { label: string; run: () => void } }

interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  resolve: (ok: boolean) => void;
}

interface UIState {
  toasts: Toast[];
  confirmRequest: ConfirmRequest | null;
  toast: (message: string, type?: ToastType, action?: Toast['action']) => void;
  dismissToast: (id: number) => void;
  confirm: (opts: Omit<ConfirmRequest, 'resolve'>) => Promise<boolean>;
  closeConfirm: (ok: boolean) => void;
}

let nextId = 1;

export const useUI = create<UIState>((set, get) => ({
  toasts: [],
  confirmRequest: null,

  toast: (message, type = 'success', action) => {
    const id = nextId++;
    set({ toasts: [...get().toasts, { id, message, type, action }] });
    setTimeout(() => get().dismissToast(id), action ? 5500 : 3200);
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),

  confirm: (opts) =>
    new Promise<boolean>((resolve) => {
      get().confirmRequest?.resolve(false);
      set({ confirmRequest: { ...opts, resolve } });
    }),
  closeConfirm: (ok) => {
    get().confirmRequest?.resolve(ok);
    set({ confirmRequest: null });
  },
}));

/** Bileşen dışından da çağrılabilen kısayollar */
export const toast = (message: string, type?: ToastType) => useUI.getState().toast(message, type);

/** Silme sonrası 5 sn'lik "Geri al" */
export const undoToast = (message: string, undo: () => Promise<unknown>) =>
  useUI.getState().toast(message, 'info', { label: 'Geri al', run: () => { run(undo, 'Geri alındı'); } });
export const confirmAction = (opts: Omit<ConfirmRequest, 'resolve'>) => useUI.getState().confirm(opts);

/** Veri yazma çağrılarını saran yardımcı: hata olursa kullanıcıya gösterir. */
export async function run(action: () => Promise<unknown>, success?: string): Promise<boolean> {
  try {
    await action();
    if (success) toast(success);
    return true;
  } catch (err) {
    console.error(err);
    toast('İşlem kaydedilemedi. Bağlantınızı kontrol edip tekrar deneyin.', 'error');
    return false;
  }
}
