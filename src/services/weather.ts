/* Güneş kartı için Open-Meteo (ücretsiz, anahtarsız). Sonuç 3 saat önbellekte tutulur. */

export interface SunDay {
  code: number;        // WMO hava kodu
  tMax: number;
  tMin: number;
  sunrise: string;     // "06:58"
  sunset: string;
  radiation: number;   // günlük toplam kısa dalga ışınım, MJ/m²
  rain: number;        // yağış olasılığı %
  wind: number;        // en yüksek rüzgâr km/sa
  uv: number;
}

export interface Place { name: string; lat: number; lon: number; admin?: string }

const CACHE = 'melife-weather';
const TTL = 3 * 3600_000;

export async function fetchSun(lat: number, lon: number, now = Date.now()): Promise<SunDay | null> {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  try {
    const c = JSON.parse(localStorage.getItem(CACHE) ?? 'null');
    if (c && c.key === key && now - c.at < TTL) return c.data;
  } catch { /* */ }
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&timezone=auto&forecast_days=1`
    + '&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,shortwave_radiation_sum,precipitation_probability_max,wind_speed_10m_max,uv_index_max';
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const j = await r.json();
    const d = j.daily;
    const data: SunDay = {
      code: d.weather_code[0], tMax: d.temperature_2m_max[0], tMin: d.temperature_2m_min[0],
      sunrise: String(d.sunrise[0]).slice(11, 16), sunset: String(d.sunset[0]).slice(11, 16),
      radiation: d.shortwave_radiation_sum[0] ?? 0, rain: d.precipitation_probability_max[0] ?? 0,
      wind: d.wind_speed_10m_max[0] ?? 0, uv: d.uv_index_max[0] ?? 0,
    };
    try { localStorage.setItem(CACHE, JSON.stringify({ key, at: now, data })); } catch { /* */ }
    return data;
  } catch { return null; }
}

export async function searchPlace(q: string): Promise<Place[]> {
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=tr&format=json`);
  if (!r.ok) return [];
  const j = await r.json();
  return (j.results ?? []).map((p: { name: string; latitude: number; longitude: number; admin1?: string }) => ({ name: p.name, lat: p.latitude, lon: p.longitude, admin: p.admin1 }));
}

/** WMO kodu → kısa Türkçe durum + emoji */
export function sky(code: number): { label: string; emoji: string } {
  if (code === 0) return { label: 'Açık', emoji: '☀️' };
  if (code <= 2) return { label: 'Az bulutlu', emoji: '🌤' };
  if (code === 3) return { label: 'Kapalı', emoji: '☁️' };
  if (code <= 48) return { label: 'Sisli', emoji: '🌫' };
  if (code <= 67 || (code >= 80 && code <= 82)) return { label: 'Yağmurlu', emoji: '🌧' };
  if (code <= 77 || code === 85 || code === 86) return { label: 'Karlı', emoji: '❄️' };
  return { label: 'Fırtınalı', emoji: '⛈' };
}

/** Saha (GES bakım) için tek cümlelik yorum. Saf fonksiyon, test edilir. */
export function fieldNote(d: SunDay): string {
  if (d.code >= 95) return 'Fırtına bekleniyor; çatı ve panel işini ertelemek iyi olabilir.';
  if (d.wind >= 40) return `Rüzgâr ${Math.round(d.wind)} km/sa'e çıkıyor; yüksekte çalışırken dikkat.`;
  if (d.rain >= 60) return 'Yağmur ihtimali yüksek; panel temizliği için uygun değil, ofis işine iyi gün.';
  if (d.tMax >= 33) return 'Çok sıcak; saha işini sabah erken ya da akşamüstüne almak iyi olabilir. Su yanında olsun.';
  if (d.tMax <= 2) return 'Soğuk ve olası buzlanma; panel üstünde dikkatli ol.';
  if (d.radiation >= 18) return 'Işınım yüksek; üretim ölçümü ve performans kontrolü için iyi gün.';
  if (d.radiation >= 10) return 'Saha için fena değil bir gün.';
  return 'Işık zayıf; üretim düşük görünebilir, endişelenme.';
}
