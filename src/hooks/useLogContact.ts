import { useStore } from '../store/useStore';
import { run } from '../store/useUI';
import type { Contact, Person } from '../types';
import { haptic } from '../utils/haptic';

/** "Konuştuk / Görüştük" — kişi kartında ve Bugün'de kullanılır */
export function useLogContact() {
  const { people, saveItem } = useStore();
  const today = useStore((s) => s.today());
  return (id: string, kind: Contact['kind'], note?: string) => {
    const p = people.find((x) => x.id === id);
    if (!p) return Promise.resolve(false);
    haptic();
    const contacts = [{ date: today, kind, ...(note ? { note } : {}) }, ...(p.contacts ?? [])].slice(0, 60);
    const first = p.name.split(' ')[0];
    return run(() => saveItem<Person>('people', { lastContact: today, contacts }, id), kind === 'talk' ? `${first} ile konuştun 💬` : `${first} ile görüştün ☕`);
  };
}
