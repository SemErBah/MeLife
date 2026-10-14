import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import BottomNav from './components/BottomNav';
import QuickAdd from './components/QuickAdd';
import RoutineEditor from './components/RoutineEditor';
import TaskEditor from './components/TaskEditor';
import { UrgeOverlay } from './components/Reduce';
import Review from './components/Review';
import StartSmall from './components/StartSmall';
import Money from './finance/Money';
import MoneySheets from './finance/MoneySheets';
import Sidebar from './components/Sidebar';
import TimerOverlay from './components/TimerOverlay';
import TrackerSheet from './components/TrackerSheet';
import UIHost from './components/UIHost';
import Auth from './pages/Auth';
import More from './pages/More';
import Notes from './pages/Notes';
import Onboarding from './pages/Onboarding';
import Today from './pages/Today';
import Week from './pages/Week';
import { useStore } from './store/useStore';
import { useSheets } from './store/useSheets';
import { useMoneySheets } from './finance/store/useMoneySheets';
import { weekStart } from './utils/date';



function Spinner() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-base">
      <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function App() {
  const { init, tick, authReady, dataReady, user, settings, activeTab } = useStore();

  useEffect(() => init(), [init]);

  // "Şimdi" kartı ve gün sınırı için dakikalık saat
  useEffect(() => {
    const id = setInterval(tick, 30_000);
    const onVisible = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible); };
  }, [tick]);

  // Tekrarlayan görevler: veri gelince ve gün değişince önümüzdeki günleri üret
  const ensureRecurring = useStore((s) => s.ensureRecurring);
  const rulesKey = useStore((s) => s.rules.map((r) => `${r.id}:${r.active}:${r.skips?.length ?? 0}`).join(','));
  const todayKey = useStore((s) => s.today());
  useEffect(() => {
    if (dataReady && user) ensureRecurring().catch((e) => console.error('tekrarlayan görev', e));
  }, [dataReady, user, rulesKey, todayKey, ensureRecurring]);

  // Ana ekran kısayolları ve Telegram bağlantıları: /?do=expense|note|task|salary|bills|close-day|close-week
  useEffect(() => {
    if (!dataReady || !user || !settings.onboarded) return;
    const p = new URLSearchParams(location.search);
    const action = p.get('do');
    if (!action) return;
    history.replaceState(null, '', location.pathname);
    const sheets = useSheets.getState();
    const money = useMoneySheets.getState();
    const today = useStore.getState().today();
    if (action === 'expense') money.open({ t: 'editor', preset: { kind: 'expense' } });
    else if (action === 'salary') money.open({ t: 'salary' });
    else if (action === 'bills') useStore.getState().setTab('money');
    else if (action === 'note' || action === 'task') sheets.setQuick(action === 'note') ;
    if (action === 'task') sheets.openTask(null);
    if (action === 'close-day') sheets.openReview({ kind: 'day', date: today });
    if (action === 'close-week') sheets.openReview({ kind: 'week', weekOf: weekStart(today) });
  }, [dataReady, user, settings.onboarded]);

  // Sekme değişince içerik en üstten başlasın
  useEffect(() => {
    document.querySelector('main')?.scrollTo({ top: 0 });
  }, [activeTab]);

  if (!authReady) return <Spinner />;
  if (!user) return <><Auth /><UIHost /></>;
  if (!dataReady) return <Spinner />;
  if (!settings.onboarded) return <><Onboarding /><UIHost /></>;

  const pages: Record<string, React.ReactNode> = {
    today: <Today />,
    week: <Week />,
    notes: <Notes />,
    money: <Money />,
    more: <More />,
  };

  return (
    <>
      <div className="h-dvh flex bg-base overflow-hidden">
        <Sidebar />
        <main className="app-main flex-1 lg:ml-[260px] overflow-y-auto custom-scroll">
          <div className="max-w-6xl mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              >
                {pages[activeTab]}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
        <QuickAdd />
        <BottomNav />
      </div>
      <TimerOverlay />
      <TrackerSheet />
      <RoutineEditor />
      <TaskEditor />
      <UrgeOverlay />
      <Review />
      <StartSmall />
      <MoneySheets />
      <UIHost />
    </>
  );
}
