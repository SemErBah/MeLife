import { BellRing, BookOpen, CalendarDays, ChartColumn, ChevronLeft, ChevronRight, GraduationCap, History, Repeat, Settings2, Sparkles, Users } from 'lucide-react';
import { lazy, Suspense } from 'react';
import ProfileButton from '../components/ProfileButton';
import { useStore, type MoreView } from '../store/useStore';
import { daysBetween } from '../utils/date';
import Routines from './more/Routines';
import SettingsPage from './more/SettingsPage';

// Büyük sayfalar ihtiyaç anında yüklenir
const Library = lazy(() => import('./more/Library'));
const Courses = lazy(() => import('./more/Courses'));
const Calendar = lazy(() => import('./more/Calendar'));
const Stats = lazy(() => import('./more/Stats'));
const Reminders = lazy(() => import('./more/Reminders'));
const People = lazy(() => import('./more/People'));
const Dreams = lazy(() => import('./more/Dreams'));
const Timeline = lazy(() => import('./more/Timeline'));

const VIEWS: Record<MoreView, { title: string; icon: React.ReactNode; render: () => React.ReactNode }> = {
  people: { title: 'İnsanlar', icon: <Users size={18} />, render: () => <People /> },
  dreams: { title: 'Hayaller & niyetler', icon: <Sparkles size={18} />, render: () => <Dreams /> },
  timeline: { title: 'Hayat çizelgesi', icon: <History size={18} />, render: () => <Timeline /> },
  routines: { title: 'Rutinlerim', icon: <Repeat size={18} />, render: () => <Routines /> },
  library: { title: 'Kütüphane', icon: <BookOpen size={18} />, render: () => <Library /> },
  courses: { title: 'Ders & sınavlar', icon: <GraduationCap size={18} />, render: () => <Courses /> },
  calendar: { title: 'Takvim', icon: <CalendarDays size={18} />, render: () => <Calendar /> },
  stats: { title: 'İstatistik', icon: <ChartColumn size={18} />, render: () => <Stats /> },
  reminders: { title: 'Anımsatıcılar', icon: <BellRing size={18} />, render: () => <Reminders /> },
  settings: { title: 'Ayarlar', icon: <Settings2 size={18} />, render: () => <SettingsPage /> },
};

export default function More() {
  const view = useStore((s) => s.moreView);
  const openMore = useStore((s) => s.openMore);

  if (view) {
    const v = VIEWS[view];
    return (
      <div className={`page max-w-3xl ${view === 'dreams' ? 'lg:max-w-5xl' : ''}`}>
        <header className="flex items-center gap-2">
          <button onClick={() => openMore(null)} className="icon-btn text-text-muted hover:bg-surface-el rounded-full -ml-2" aria-label="Geri"><ChevronLeft size={20} /></button>
          <h1 className="page-title flex-1">{v.title}</h1>
          <ProfileButton />
        </header>
        <Suspense fallback={<div className="skeleton h-48 rounded-3xl" />}>{v.render()}</Suspense>
      </div>
    );
  }

  return (
    <div className="page max-w-3xl lg:max-w-5xl">
      <header className="flex items-center justify-between">
        <h1 className="page-title">Daha</h1>
      </header>
      <Hub />
    </div>
  );
}

function Hub() {
  const { trackers, library, exams, courses, settings, people, dreams, yearGoals, moments, journal } = useStore();
  const today = useStore((s) => s.today());
  const openMore = useStore((s) => s.openMore);

  const nextExam = exams.find((e) => e.date >= today);
  const doing = library.filter((l) => l.status === 'doing').length;
  const passed = courses.filter((c) => c.status === 'passed').length;

  const year = Number(today.slice(0, 4));
  const goals = yearGoals.filter((g) => g.year === year).length;
  const lifeCount = moments.length + journal.filter((e) => e.important).length + dreams.filter((d) => d.status === 'done').length;
  const sub: Record<MoreView, string> = {
    people: people.length ? `${people.length} kişi` : 'Sevdiklerin, doğum günleri',
    dreams: goals || dreams.length ? `${goals} niyet · ${dreams.filter((d) => d.status !== 'done').length} hayal` : 'Bir gün… listesi, yılın niyetleri',
    timeline: lifeCount ? `${lifeCount} önemli an` : 'Hayatının önemli anları',
    routines: `${trackers.filter((t) => t.active && !t.paused).length} aktif`,
    library: doing ? `${doing} şey devam ediyor` : library.length ? `${library.length} kayıt` : 'Kitap, film, kurs, podcast',
    courses: nextExam
      ? `Sıradaki sınav ${daysBetween(today, nextExam.date) === 0 ? 'bugün' : `${daysBetween(today, nextExam.date)} gün sonra`}`
      : courses.length ? `${courses.length} ders · ${passed} geçti` : 'Dersler, sınavlar, çalışma süresi',
    calendar: 'Geçmiş günler ve haftalar',
    stats: 'Uyku, su, ders, ruh hali, para',
    reminders: settings.telegramChatId ? 'Telegram bağlı' : 'Telegram ile nazik sorular',
    settings: 'Ad, odak modu, tema, yedek',
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
      {(Object.keys(VIEWS) as MoreView[]).map((k) => (
        <button key={k} onClick={() => openMore(k)} className="card p-4 text-left min-h-0 flex flex-col gap-3 hover:bg-surface-el transition-colors">
          <span className="flex items-center justify-between">
            <span className="cat-bubble sm" style={{ '--c': 'var(--accent-base)' } as React.CSSProperties}>{VIEWS[k].icon}</span>
            <ChevronRight size={16} className="text-text-muted" />
          </span>
          <span>
            <span className="block font-display text-[17px] font-semibold leading-tight">{VIEWS[k].title}</span>
            <span className="block text-xs text-text-muted mt-1 leading-snug">{sub[k]}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
