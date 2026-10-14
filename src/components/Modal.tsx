import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export default function Modal({ isOpen, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[999] flex items-end lg:items-center justify-center" role="dialog" aria-modal="true" aria-label={title}>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />

          {/* Panel — iOS bottom sheet style on mobile */}
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="relative z-10 w-full max-w-lg rounded-t-3xl lg:rounded-2xl overflow-hidden flex flex-col"
            style={{
              background: 'var(--modal-bg)',
              border: '1px solid var(--border)',
              maxHeight: '92dvh',
              boxShadow: 'var(--shadow-elevated)',
              /* iOS safe area at bottom */
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            }}
          >
            {/* iOS drag handle */}
            <div className="flex justify-center pt-3 pb-1 lg:hidden">
              <div className="w-10 h-1 rounded-full bg-text-muted/30" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-3 lg:py-4 border-b border-border">
              <h2 className="text-lg font-semibold text-text-main">{title}</h2>
              <button
                onClick={onClose}
                className="icon-btn text-text-muted hover:text-text-main hover:bg-surface-hover -mr-2"
                aria-label="Kapat"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body — iOS momentum scroll */}
            <div
              className="flex-1 overflow-y-auto px-6 pt-5 pb-12 lg:pb-6"
              style={{
                WebkitOverflowScrolling: 'touch',
                overscrollBehavior: 'contain',
              }}
            >
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
