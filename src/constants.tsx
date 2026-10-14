import {
  BedDouble, BookOpen, Candy, Cigarette, Brain, Briefcase, Brush, CalendarCheck, Coffee, Droplet, Dumbbell, Flame, Footprints,
  Gamepad2, GraduationCap, Heart, House, Leaf, ListTodo, Moon, Music, PenLine, Pill, Salad, Shirt, Smartphone,
  Smile, Sparkles, Sun, Utensils, Wallet, Wrench, Zap, type LucideIcon,
} from 'lucide-react';
import type { Area, Category, CourseStatus, ExamKind, LibKind, LibStatus, TrackerType } from './types';

export const ICONS: Record<string, LucideIcon> = {
  brush: Brush, bed: BedDouble, graduation: GraduationCap, list: ListTodo, book: BookOpen, shirt: Shirt,
  calendar: CalendarCheck, wallet: Wallet, droplet: Droplet, dumbbell: Dumbbell, salad: Salad, moon: Moon,
  footprints: Footprints, smile: Smile, zap: Zap, brain: Brain, briefcase: Briefcase, wrench: Wrench,
  coffee: Coffee, gamepad: Gamepad2, heart: Heart, house: House, leaf: Leaf, music: Music, pen: PenLine,
  pill: Pill, phone: Smartphone, sparkles: Sparkles, sun: Sun, utensils: Utensils, flame: Flame,
  cigarette: Cigarette, candy: Candy,
};

export const CATEGORIES: Record<Category, { label: string; color: string }> = {
  health: { label: 'Sağlık', color: 'var(--cat-health)' },
  mind:   { label: 'Zihin', color: 'var(--cat-mind)' },
  order:  { label: 'Düzen', color: 'var(--cat-order)' },
  social: { label: 'Dışarı & Sosyal', color: 'var(--cat-social)' },
  work:   { label: 'İş & Plan', color: 'var(--cat-work)' },
  mood:   { label: 'Ruh hali', color: 'var(--cat-mood)' },
};

export const TRACKER_TYPES: Record<TrackerType, { label: string; desc: string }> = {
  check:    { label: 'Tik', desc: 'Yaptım / yapmadım' },
  counter:  { label: 'Sayaç', desc: 'Su, sayfa gibi artan miktar' },
  duration: { label: 'Süre', desc: 'Sayaçla ya da elle dakika' },
  sleep:    { label: 'Uyku', desc: 'Yatış ve kalkış saati' },
  scale:    { label: 'Ölçek', desc: '1–5 arası puan' },
  number:   { label: 'Sayı', desc: 'Kilo, ekran süresi…' },
};

export const SCALE_FACES = ['😞', '😕', '😐', '🙂', '😄'];

export const AREAS: Record<Area, { label: string; color: string }> = {
  school:   { label: 'Okul',    color: 'var(--cat-mind)' },
  work:     { label: 'İş',      color: 'var(--cat-work)' },
  home:     { label: 'Ev',      color: 'var(--cat-order)' },
  personal: { label: 'Kişisel', color: 'var(--cat-mood)' },
};

export const COURSE_STATUS: Record<CourseStatus, string> = { planned: 'Planlandı', taking: 'Alıyorum', passed: 'Geçti', failed: 'Kaldı' };
export const EXAM_KIND: Record<ExamKind, string> = { vize: 'Vize', final: 'Final', but: 'Bütünleme', quiz: 'Quiz', odev: 'Ödev', proje: 'Proje' };

export const LIB_KIND: Record<LibKind, { label: string; plural: string; unit: string; creator: string }> = {
  book:    { label: 'Kitap',   plural: 'kitap',   unit: 'sayfa', creator: 'Yazar' },
  film:    { label: 'Film',    plural: 'film',    unit: '',      creator: 'Yönetmen' },
  series:  { label: 'Dizi',    plural: 'dizi',    unit: 'bölüm', creator: 'Yapımcı' },
  course:  { label: 'Kurs',    plural: 'kurs',    unit: 'ders',  creator: 'Eğitmen' },
  video:   { label: 'Video',   plural: 'video',   unit: '',      creator: 'Kanal' },
  podcast: { label: 'Podcast', plural: 'podcast', unit: 'bölüm', creator: 'Yayıncı' },
  article: { label: 'Makale',  plural: 'makale',  unit: '',      creator: 'Yazar' },
};
export const LIB_STATUS: Record<LibStatus, string> = { want: 'Listemde', doing: 'Devam ediyor', done: 'Bitti', dropped: 'Yarım bıraktım' };
