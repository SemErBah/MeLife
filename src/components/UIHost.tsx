import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { useEffect } from 'react';
import { useUI } from '../store/useUI';

const TOAST_STYLE = {
  success: { icon: <CheckCircle2 size={18} />, cls: 'text-emerald' },
  error:   { icon: <XCircle size={18} />,      cls: 'text-danger' },
  info:    { icon: <Info size={18} />,         cls: 'text-accent' },
};

export default function UIHost() {
  const { toasts, dismissToast, confirmRequest, closeConfirm } = useUI();

  useEffect(() => {
    if (!confirmRequest) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeConfirm(false);
      if (e.key === 'Enter') closeConfirm(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmRequest, closeConfirm]);

  return (
    <>
      {/* Toasts */}
      <div
        className="fixed left-0 right-0 z-[1100] flex flex-col items-center gap-2 px-4 pointer-events-none"
        style={{ top: 'calc(12px + env(safe-area-inset-top, 0px))' }}
        aria-live="polite"
      >
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.button
              key={t.id}
              layout
              initial={{ opacity: 0, y: -16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.96 }}
              onClick={() => dismissToast(t.id)}
              className="pointer-events-auto flex items-center gap-3 max-w-sm w-full px-4 py-3 rounded-2xl text-sm font-medium text-left"
              style={{ background: 'var(--modal-bg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-elevated)' }}
            >
              <span className={`shrink-0 ${TOAST_STYLE[t.type].cls}`}>{TOAST_STYLE[t.type].icon}</span>
              <span className="text-text-main flex-1">{t.message}</span>
              {t.action && (
                <span
                  role="button"
                  onClick={(e) => { e.stopPropagation(); t.action!.run(); dismissToast(t.id); }}
                  className="shrink-0 text-accent font-bold px-2 py-1 rounded-lg hover:bg-accent-dim"
                >{t.action.label}</span>
              )}
            </motion.button>
          ))}
        </AnimatePresence>
      </div>

      {/* Confirm dialog */}
      <AnimatePresence>
        {confirmRequest && (
          <div className="fixed inset-0 z-[1050] flex items-center justify-center p-4" role="alertdialog" aria-modal="true">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => closeConfirm(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              className="relative w-full max-w-sm rounded-3xl p-6"
              style={{ background: 'var(--modal-bg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-elevated)' }}
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${confirmRequest.danger ? 'bg-danger-dim text-danger' : 'bg-accent-dim text-accent'}`}>
                <AlertTriangle size={22} />
              </div>
              <h3 className="text-lg font-bold mb-1.5">{confirmRequest.title}</h3>
              <p className="text-sm text-text-muted leading-relaxed whitespace-pre-line">{confirmRequest.message}</p>
              <div className="grid grid-cols-2 gap-3 mt-6">
                <button onClick={() => closeConfirm(false)} className="py-3 rounded-xl text-sm font-semibold bg-surface-el hover:bg-surface-hover transition-colors">
                  Vazgeç
                </button>
                <button
                  onClick={() => closeConfirm(true)}
                  className={`py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 ${confirmRequest.danger ? 'bg-danger' : 'bg-accent'}`}
                  autoFocus
                >
                  {confirmRequest.confirmLabel || 'Onayla'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
