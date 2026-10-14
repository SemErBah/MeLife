import { useStore } from '../store/useStore';

/** Sağ üstte yuvarlak profil düğmesi → "Daha" (rutinler, ayarlar). Telefonda alt menüde yer olmadığı için. */
export default function ProfileButton() {
  const user = useStore((s) => s.user);
  const openMore = useStore((s) => s.openMore);
  const initial = (user?.name || user?.email || 'M')[0].toUpperCase();
  return (
    <button
      onClick={() => openMore(null)}
      className="lg:hidden w-10 h-10 min-h-0 min-w-0 rounded-full bg-surface-el text-text-main font-bold text-sm flex items-center justify-center shrink-0"
      aria-label="Daha: rutinler ve ayarlar"
    >
      {user?.photo ? <img src={user.photo} alt="" className="w-full h-full rounded-full" referrerPolicy="no-referrer" /> : initial}
    </button>
  );
}
