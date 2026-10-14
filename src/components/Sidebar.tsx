import { motion } from 'framer-motion';
import { LogOut, Moon, Sun } from 'lucide-react';
import { useStore } from '../store/useStore';
import { NAV_TABS } from './navTabs';
import Logo from './Logo';

export default function Sidebar() {
  const { activeTab, setTab, signOut, user, settings, setTheme } = useStore();
  const isDark = settings.theme === 'dark';

  return (
    <aside
      className="hidden lg:flex flex-col w-[260px] h-screen fixed left-0 top-0 z-40"
      style={{ background: 'var(--sidebar-bg)', borderRight: '1px solid var(--sidebar-border)' }}
    >
      <div className="flex items-center gap-3 px-6 py-7">
        <Logo size={44} />
        <div>
          <p className="text-lg font-extrabold tracking-tight text-text-main">MeLife</p>
          <p className="text-[10px] text-text-muted uppercase tracking-widest">Düzen Merkezi</p>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-1" aria-label="Ana menü">
        {NAV_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setTab(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors duration-200 ${
                isActive ? 'text-accent' : 'text-text-muted hover:text-text-main hover:bg-surface-hover'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-xl bg-accent-dim"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <span className="relative z-10">{tab.icon}</span>
              <span className="relative z-10">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {user && (
        <div className="px-4 py-5 border-t border-border flex items-center gap-2">
          {user.photo ? (
            <img src={user.photo} alt="" className="w-8 h-8 rounded-lg shrink-0" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-accent-dim text-accent flex items-center justify-center text-xs font-bold shrink-0">
              {(user.name || user.email || 'M')[0].toUpperCase()}
            </div>
          )}
          <p className="text-xs text-text-muted font-medium truncate flex-1 min-w-0">{user.local ? 'Yerel mod' : user.name || user.email}</p>
          <button onClick={() => setTheme(isDark ? 'light' : 'dark')} className="icon-btn text-text-muted hover:text-accent hover:bg-accent-dim" title="Temayı değiştir" aria-label="Temayı değiştir">
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          {!user.local && (
            <button onClick={signOut} className="icon-btn text-text-muted hover:text-danger hover:bg-danger-dim" title="Çıkış yap" aria-label="Çıkış yap">
              <LogOut size={16} />
            </button>
          )}
        </div>
      )}
    </aside>
  );
}
