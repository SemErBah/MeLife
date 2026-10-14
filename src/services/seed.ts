import type { Tracker } from '../types';

/* Rutin şablonları — hiçbiri dayatılmaz; istediğini seçersin, sonra her şeyi değiştirebilirsin.
   Anımsatıcılar soru sorar ("…mı?"), emir vermez. */

export type Template = Omit<Tracker, 'id' | 'order' | 'active'> & { tid: string; suggested?: boolean };

const SUNDAY = [0];

export const TEMPLATES: Template[] = [
  { tid: 'dis-sabah', suggested: true, name: 'Diş fırçala (sabah)', icon: 'brush', category: 'order', type: 'check', time: '07:00',
    reminders: [{ time: '07:15', message: 'Dişlerini fırçaladın mı? 🙂', on: true }] },
  { tid: 'dis-gece', suggested: true, name: 'Diş fırçala (gece)', icon: 'brush', category: 'order', type: 'check', time: '23:30',
    reminders: [{ time: '23:30', message: 'Yatmadan dişlerini fırçaladın mı?', on: true }] },
  { tid: 'yatak', name: 'Yatağı topla', icon: 'bed', category: 'order', type: 'check', time: '07:05' },
  { tid: 'ders', suggested: true, key: 'study', name: 'Ders çalış', icon: 'graduation', category: 'mind', type: 'duration', time: '21:15',
    unit: 'dk', target: 60, doneAt: 10, weeklyTimes: 4, hint: '10 dakika bile sayılır',
    reminders: [{ time: '21:15', message: 'Ders için 10 dakikan var mı?', on: true }] },
  { tid: 'kitap', name: 'Kitap oku', icon: 'book', category: 'mind', type: 'counter', time: '23:35', unit: 'sayfa', target: 10, step: 5 },
  { tid: 'su', suggested: true, key: 'water', name: 'Su', icon: 'droplet', category: 'health', type: 'counter', unit: 'ml', target: 2500, step: 250,
    reminders: [{ time: '14:00', message: 'Su içtin mi? 💧', on: true }] },
  { tid: 'uyku', suggested: true, key: 'sleep', name: 'Uyku', icon: 'moon', category: 'health', type: 'sleep', target: 420 },
  { tid: 'spor', name: 'Spor', icon: 'dumbbell', category: 'health', type: 'duration', unit: 'dk', target: 45, doneAt: 20, weeklyTimes: 2 },
  { tid: 'tuz', name: 'Tuzu azalttım', icon: 'salad', category: 'health', type: 'check', time: '21:00' },
  { tid: 'disari', suggested: true, name: 'Dışarı çıktım', icon: 'footprints', category: 'social', type: 'check' },
  { tid: 'ruh-hali', suggested: true, name: 'Ruh hali', icon: 'smile', category: 'mood', type: 'scale' },
  { tid: 'enerji', name: 'Enerji', icon: 'zap', category: 'mood', type: 'scale' },
  { tid: 'oda', name: 'Oda & çamaşır', icon: 'shirt', category: 'order', type: 'check', time: '10:00', days: SUNDAY },
  { tid: 'para', key: 'money', name: 'Para takibi', icon: 'wallet', category: 'work', type: 'check', time: '20:20', days: SUNDAY, hint: 'Para sekmesinde' },
  { tid: 'ekran', name: 'Ekran süresi', icon: 'phone', category: 'mood', type: 'number', unit: 'dk' },
];

/** Azaltmak istenen alışkanlıklar — plan başlangıç tarihi eklenirken bugüne ayarlanır */
export const REDUCE_TEMPLATES: Template[] = [
  { tid: 'sigara', name: 'Sigara', icon: 'cigarette', category: 'health', type: 'counter', mode: 'reduce', unit: 'adet', step: 1,
    reduce: { start: 20, stepPerWeek: 2, floor: 0, startDate: '', unitPrice: undefined, perPack: 20, minGapMin: 45 } },
  { tid: 'instagram', name: 'Instagram açma', icon: 'phone', category: 'mood', type: 'counter', mode: 'reduce', unit: 'kez', step: 1,
    reduce: { start: 30, stepPerWeek: 5, floor: 5, startDate: '' } },
  { tid: 'tatli', name: 'Tatlı / şeker', icon: 'candy', category: 'health', type: 'counter', mode: 'reduce', unit: 'kez', step: 1,
    reduce: { start: 4, stepPerWeek: 1, floor: 1, startDate: '' } },
];

/** Şablondan yeni rutin — aynı kimlik varsa sonuna ek alır */
export function fromTemplate(tpl: Template, existingIds: Set<string>, order: number): Tracker {
  const { tid, suggested: _s, ...rest } = tpl;
  let id = tid;
  for (let i = 2; existingIds.has(id); i++) id = `${tid}-${i}`;
  return { ...rest, id, order, active: true };
}

export function newTrackerId(name: string, existingIds: Set<string>): string {
  const base = name.toLocaleLowerCase('tr-TR')
    .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'rutin';
  let id = base;
  for (let i = 2; existingIds.has(id); i++) id = `${base}-${i}`;
  return id;
}
