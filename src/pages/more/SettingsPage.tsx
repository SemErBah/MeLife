import { Download, LogOut, Moon, Sun, Target } from 'lucide-react';
import { useState } from 'react';
import { Field, Toggle } from '../../components/ui';
import { downloadFullBackup } from '../../services/backup';
import { useStore } from '../../store/useStore';
import { confirmAction, run, toast } from '../../store/useUI';
import { addDays, longDate } from '../../utils/date';
import { pinSet, setPin } from '../../utils/pin';
import { searchPlace, type Place } from '../../services/weather';

export default function SettingsPage() {
  const { user, settings, setTheme, saveSettings, signOut, resetLocal } = useStore();
  const today = useStore((s) => s.today());
  const [name, setName] = useState(settings.displayName ?? '');
  const isDark = settings.theme === 'dark';
  const focusOn = !!settings.focusUntil && settings.focusUntil >= today;

  return (
    <div className="space-y-5">
      <section className="settings-group">
        <h3>Sen</h3>
        <div className="p-5 space-y-4">
          <Field label="Adın" hint="Selamlarken ve Telegram mesajlarında kullanırım.">
            <div className="flex gap-2">
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ör: Semih" maxLength={30} />
              <button onClick={() => run(() => saveSettings({ displayName: name.trim() }), 'Kaydedildi')} disabled={name.trim() === (settings.displayName ?? '')} className="btn btn-primary shrink-0">Kaydet</button>
            </div>
          </Field>
        </div>
      </section>

      <section className="settings-group">
        <h3>Odak modu</h3>
        <div className="p-5 space-y-3">
          <p className="text-sm text-text-muted leading-relaxed">
            Sınav haftası gibi yoğun günlerde yalnızca <b className="text-text-main">"odakta göster"</b> işaretli rutinler görünür, diğer anımsatıcılar susar.
            Rutinleri rutin düzenleme ekranından işaretlersin.
          </p>
          <div className="flex items-center justify-between gap-4">
            <p className="font-semibold text-sm flex items-center gap-2"><Target size={16} /> {focusOn ? `${longDate(settings.focusUntil!)} gününe kadar açık` : 'Kapalı'}</p>
            <Toggle checked={focusOn} onChange={(v) => run(() => saveSettings({ focusUntil: v ? addDays(today, 6) : '' }), v ? 'Odak modu 7 gün açık' : 'Odak modu kapandı')} label="Odak modu" />
          </div>
          {focusOn && (
            <Field label="Bitiş">
              <input type="date" className="input" value={settings.focusUntil} min={today} onChange={(e) => run(() => saveSettings({ focusUntil: e.target.value }))} />
            </Field>
          )}
        </div>
      </section>

      <LocationSettings />

      <NotebookLockSettings />

      <section className="settings-group">
        <h3>Görünüm</h3>
        <div className="p-5 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <p className="font-semibold text-sm flex items-center gap-2">{isDark ? <Moon size={16} /> : <Sun size={16} />} Koyu tema</p>
            <Toggle checked={isDark} onChange={(v) => run(() => setTheme(v ? 'dark' : 'light'))} label="Koyu tema" />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-sm">Dokunma titreşimi</p>
              <p className="text-xs text-text-muted mt-0.5">Tik atınca çok kısa bir titreşim (telefon/tablet).</p>
            </div>
            <Toggle checked={settings.haptics !== false} onChange={(v) => run(() => saveSettings({ haptics: v }))} label="Dokunma titreşimi" />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-sm">Zincir göstergesi</p>
              <p className="text-xs text-text-muted mt-0.5">Art arda kaç gün bir şey kaydettiğini gösterir.</p>
            </div>
            <Toggle checked={settings.showStreak} onChange={(v) => run(() => saveSettings({ showStreak: v }))} label="Zincir göstergesi" />
          </div>
        </div>
      </section>

      <section className="settings-group">
        <h3>Verilerim</h3>
        <div className="p-5 space-y-3">
          <button onClick={() => { downloadFullBackup(); toast('Yedek indirildi'); }} className="btn btn-ghost w-full"><Download size={16} /> Tüm verilerimi indir (.json)</button>
          <p className="text-[11px] text-text-muted">Rutinler, günler, görevler, notlar, dersler, kütüphane ve para: hepsi tek dosyada.</p>
        </div>
      </section>

      <section className="settings-group">
        <h3>Hesap</h3>
        <div className="p-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-accent-dim text-accent flex items-center justify-center font-bold shrink-0">
            {(settings.displayName || user?.email || 'M')[0].toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm truncate">{user?.local ? 'Yerel mod' : user?.email}</p>
            <p className="text-xs text-text-muted">{user?.local ? 'Veriler yalnızca bu tarayıcıda' : 'Tüm cihazlarında senkron'}</p>
          </div>
          {user?.local ? (
            <button
              onClick={async () => { if (await confirmAction({ title: 'Yerel veriler silinsin mi?', message: 'Bu tarayıcıdaki tüm MeLife kayıtları silinir.', confirmLabel: 'Sil', danger: true })) resetLocal(); }}
              className="btn btn-ghost btn-sm shrink-0"
            >Sıfırla</button>
          ) : (
            <button onClick={signOut} className="btn btn-ghost btn-sm shrink-0"><LogOut size={16} /> Çıkış</button>
          )}
        </div>
      </section>
    </div>
  );
}

/** Defter kilidi: 4 haneli kod (bu cihaz için). Şifreleme değil, gizlilik perdesi. */
function NotebookLockSettings() {
  const [has, setHas] = useState(pinSet());
  const [pin, setPinText] = useState('');
  return (
    <section className="settings-group">
      <h3>Defter kilidi</h3>
      <div className="p-5 space-y-3">
        <p className="text-sm text-text-muted leading-relaxed">
          Defter'e girerken 4 haneli kod sorulur. Tableti başkası kullanırsa diye bir gizlilik perdesidir; veriyi şifrelemez. Kod yalnızca bu cihazda tutulur.
        </p>
        {has ? (
          <button onClick={async () => { await setPin(null); setHas(false); toast('Kilit kaldırıldı'); }} className="btn btn-ghost w-full">Kilidi kaldır</button>
        ) : (
          <div className="flex gap-2">
            <input className="input num tracking-[0.5em] text-center w-32" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPinText(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="••••" />
            <button disabled={pin.length !== 4} onClick={async () => { await setPin(pin); setHas(true); setPinText(''); toast('Defter kilitlendi'); }} className="btn btn-primary shrink-0">Kilitle</button>
          </div>
        )}
      </div>
    </section>
  );
}

/** Güneş kartı için konum: şehir ara ya da cihaz konumu */
function LocationSettings() {
  const { settings, saveSettings } = useStore();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [busy, setBusy] = useState(false);
  const loc = settings.location;

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    setBusy(true);
    try { setResults(await searchPlace(q.trim())); } catch { toast('Arama yapılamadı', 'error'); } finally { setBusy(false); }
  };
  const pick = (p: Place) => run(() => saveSettings({ location: { name: p.name, lat: p.lat, lon: p.lon } }), 'Güneş kartı açıldı').then(() => { setResults([]); setQ(''); });
  const useDevice = () => {
    if (!navigator.geolocation) return toast('Bu cihaz konum vermiyor', 'error');
    navigator.geolocation.getCurrentPosition(
      (pos) => pick({ name: 'Konumum', lat: +pos.coords.latitude.toFixed(3), lon: +pos.coords.longitude.toFixed(3) }),
      () => toast('Konum izni verilmedi', 'error'),
      { timeout: 10_000 },
    );
  };

  return (
    <section className="settings-group">
      <h3>Güneş kartı</h3>
      <div className="p-5 space-y-3">
        <p className="text-sm text-text-muted leading-relaxed">
          Bugün ekranında hava, gün doğumu–batımı ve saha için kısa bir yorum. Veri Open-Meteo'dan gelir; yalnızca seçtiğin konum gönderilir.
        </p>
        {loc ? (
          <div className="flex items-center gap-2">
            <p className="flex-1 text-sm">☀️ <b>{loc.name}</b></p>
            <button onClick={() => run(() => saveSettings({ location: null }), 'Güneş kartı kapandı')} className="btn btn-ghost btn-sm">Kaldır</button>
          </div>
        ) : (
          <>
            <form onSubmit={search} className="flex gap-2">
              <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Şehir ya da ilçe" />
              <button type="submit" disabled={!q.trim() || busy} className="btn btn-primary shrink-0">Ara</button>
            </form>
            {results.map((p) => (
              <button key={`${p.lat},${p.lon}`} onClick={() => pick(p)} className="row-item w-full text-left min-h-0 text-sm">{p.name}{p.admin ? <span className="text-text-muted"> · {p.admin}</span> : null}</button>
            ))}
            <button onClick={useDevice} className="btn btn-ghost w-full btn-sm">Konumumu kullan</button>
          </>
        )}
      </div>
    </section>
  );
}
