import { useEffect, useState } from 'react';
import { fetchSun, fieldNote, sky, type SunDay } from '../services/weather';
import { useStore } from '../store/useStore';

/** Bugün'ün üstünde küçük güneş kartı. Konum seçilmediyse ya da ağ yoksa görünmez. */
export default function SunCard() {
  const loc = useStore((s) => s.settings.location);
  const [data, setData] = useState<{ key: string; d: SunDay } | null>(null);
  const key = loc ? `${loc.lat},${loc.lon}` : '';

  useEffect(() => {
    if (!loc) return;
    let alive = true;
    fetchSun(loc.lat, loc.lon).then((d) => { if (alive && d) setData({ key: `${loc.lat},${loc.lon}`, d }); });
    return () => { alive = false; };
  }, [loc]);

  if (!loc || !data || data.key !== key) return null;
  const d = data.d;
  const s = sky(d.code);
  return (
    <div className="flex items-start gap-3 -mt-2">
      <span className="text-[26px] leading-none mt-0.5" aria-hidden>{s.emoji}</span>
      <div className="min-w-0 text-sm">
        <p>
          <b>{s.label}</b> · <span className="num">{Math.round(d.tMax)}°/{Math.round(d.tMin)}°</span>
          <span className="text-text-muted"> · güneş <span className="num">{d.sunrise}–{d.sunset}</span> · {loc.name}</span>
        </p>
        <p className="text-text-muted leading-snug">{fieldNote(d)}</p>
      </div>
    </div>
  );
}
