import { Sparkles } from 'lucide-react';
import { ICONS } from '../constants';

export function TrackerIcon({ name, size = 20 }: { name: string; size?: number }) {
  const Icon = ICONS[name] ?? Sparkles;
  return <Icon size={size} strokeWidth={2.2} />;
}
