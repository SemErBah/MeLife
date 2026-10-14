import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { useSheets } from '../store/useSheets';
import { useStore } from '../store/useStore';
import { NAV_TABS } from './navTabs';

/** Telefonda yüzen alt menü: 4 sekme + ortada "ekle". "Daha" sayfası sağ üstteki profil düğmesinde. */
export default function BottomNav() {
  const { activeTab, setTab } = useStore();
  const setQuick = useSheets((s) => s.setQuick);
  const tabs = NAV_TABS.filter((t) => t.id !== 'more');
  const left = tabs.slice(0, 2);
  const right = tabs.slice(2);

  const Item = ({ tab }: { tab: (typeof tabs)[number] }) => {
    const isActive = activeTab === tab.id;
    return (
      <button
        onClick={() => setTab(tab.id)}
        className="relative flex flex-col items-center justify-center gap-0.5 h-14 rounded-2xl"
        aria-current={isActive ? 'page' : undefined}
      >
        {isActive && (
          <motion.span layoutId="nav-dot" className="absolute bottom-1.5 w-1 h-1 rounded-full bg-text-main"
            transition={{ type: 'spring', stiffness: 500, damping: 35 }} />
        )}
        <span className={`transition-colors ${isActive ? 'text-text-main' : 'text-text-muted'}`}>{tab.icon}</span>
        <span className={`text-[10px] transition-colors ${isActive ? 'text-text-main font-semibold' : 'text-text-muted font-medium'}`}>{tab.short}</span>
      </button>
    );
  };

  return (
    <nav
      className="fixed z-50 lg:hidden left-3 right-3 rounded-[28px]"
      style={{
        bottom: 'calc(10px + env(safe-area-inset-bottom))',
        background: 'var(--nav-bg)',
        backdropFilter: 'blur(22px) saturate(1.5)',
        WebkitBackdropFilter: 'blur(22px) saturate(1.5)',
        boxShadow: 'var(--shadow-elevated)',
        border: '1px solid color-mix(in srgb, var(--border) 60%, transparent)',
      }}
      aria-label="Ana menü"
    >
      <div className="grid grid-cols-5 items-center px-2 max-w-lg mx-auto">
        {left.map((t) => <Item key={t.id} tab={t} />)}
        <div className="flex justify-center">
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => setQuick(true)}
            className="w-12 h-12 min-h-0 min-w-0 rounded-full flex items-center justify-center"
            style={{ background: 'var(--accent-base)', color: 'var(--base)', boxShadow: '0 6px 18px -6px color-mix(in srgb, var(--accent-base) 80%, transparent)' }}
            aria-label="Ekle"
          >
            <Plus size={24} strokeWidth={2.5} />
          </motion.button>
        </div>
        {right.map((t) => <Item key={t.id} tab={t} />)}
      </div>
    </nav>
  );
}
