import { BookHeart, CalendarRange, LayoutGrid, Sun, Wallet } from 'lucide-react';
import type { TabId } from '../types';

export const NAV_TABS: { id: TabId; label: string; short: string; icon: React.ReactNode }[] = [
  { id: 'today', label: 'Bugün', short: 'Bugün', icon: <Sun size={20} /> },
  { id: 'week',  label: 'Hafta', short: 'Hafta', icon: <CalendarRange size={20} /> },
  { id: 'notes', label: 'Defter', short: 'Defter', icon: <BookHeart size={20} /> },
  { id: 'money', label: 'Para',  short: 'Para',  icon: <Wallet size={20} /> },
  { id: 'more',  label: 'Daha',  short: 'Daha',  icon: <LayoutGrid size={20} /> },
];
