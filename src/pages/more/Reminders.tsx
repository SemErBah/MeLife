import { Bell, BellOff, Check, Copy, Moon, Send, Unlink } from 'lucide-react';
import { CATEGORIES } from '../../constants';
import { TrackerIcon } from '../../components/TrackerIcon';
import { Toggle } from '../../components/ui';
import { useSheets } from '../../store/useSheets';
import { useStore } from '../../store/useStore';
import { confirmAction, run, toast } from '../../store/useUI';
import type { Reminder, Settings } from '../../types';

const newCode = () => Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');

export default function Reminders() {
  const { settings, saveSettings, trackers, saveTracker, tasks } = useStore();
  const today = useStore((s) => s.today());
  const openRoutine = useSheets((s) => s.openRoutine);
  const linked = !!settings.telegramChatId;
  const planning = settings.planning ?? {};
  const setPlanning = (patch: Partial<NonNullable<Settings['planning']>>) => run(() => saveSettings({ planning: { ...planning, ...patch } }));
  const paused = settings.pauseDate === today;

  const withReminders = trackers.filter((t) => t.active && (t.reminders?.length ?? 0) > 0);
  const timedTasks = tasks.filter((t) => t.forDate && t.forDate >= today && t.time && t.remindBefore && !t.done)
    .sort((a, b) => `${a.forDate}${a.time}`.localeCompare(`${b.forDate}${b.time}`)).slice(0, 8);

  const toggleReminder = (trackerId: string, i: number, on: boolean) => {
    const t = trackers.find((x) => x.id === trackerId)!;
    const reminders: Reminder[] = (t.reminders ?? []).map((r, j) => (j === i ? { ...r, on } : r));
    run(() => saveTracker({ ...t, reminders }));
  };

  const connect = () => run(() => saveSettings({ telegramLinkCode: newCode() }));
  const unlink = async () => {
    if (await confirmAction({ title: 'Telegram bağlantısı kaldırılsın mı?', message: 'Anımsatıcılar artık gelmez. İstediğin zaman yeniden bağlayabilirsin.', confirmLabel: 'Kaldır' })) {
      run(() => saveSettings({ telegramChatId: 0, telegramLinkCode: '' }), 'Bağlantı kaldırıldı');
    }
  };

  return (
    <div className="space-y-5">
      {/* Telegram */}
      <section className="settings-group">
        <h3>Telegram</h3>
        <div className="p-5 space-y-4">
          {linked ? (
            <>
              <p className="text-sm flex items-center gap-2"><Check size={16} className="text-accent" /> Bağlı. Anımsatıcılar Telegram'dan soru olarak gelir.</p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => run(() => saveSettings({ telegramTest: Date.now() }), 'Birkaç dakika içinde deneme mesajı gelecek')} className="btn btn-ghost btn-sm"><Send size={15} /> Deneme gönder</button>
                <button onClick={unlink} className="btn btn-ghost btn-sm"><Unlink size={15} /> Kaldır</button>
              </div>
            </>
          ) : settings.telegramLinkCode ? (
            <div className="space-y-3">
              <p className="text-sm text-text-muted leading-relaxed">Telegram'da MeLife botunu aç ve şunu gönder:</p>
              <button onClick={() => { navigator.clipboard?.writeText(`/start ${settings.telegramLinkCode}`); toast('Kopyalandı'); }}
                className="w-full rounded-2xl bg-surface-el px-4 py-3 flex items-center justify-between font-mono text-lg font-bold min-h-0">
                /start {settings.telegramLinkCode} <Copy size={16} className="text-text-muted" />
              </button>
              <p className="text-xs text-text-muted">Bağlantı birkaç dakika içinde kurulur; bu sayfa kendiliğinden "Bağlı" olur.</p>
              <button onClick={connect} className="text-xs font-semibold text-text-muted" style={{ minHeight: 32 }}>Yeni kod üret</button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-text-muted leading-relaxed">
                Anımsatıcılar Telegram'dan gelir: <i>"Dişlerini fırçaladın mı?"</i> → <b>Evet ✓</b> · <b>15 dk sonra</b> · <b>Bugün geç</b>.
                Uygulamayı açmadan cevaplarsın.
              </p>
              <button onClick={connect} className="btn btn-primary w-full"><Send size={16} /> Telegram'a bağlan</button>
            </div>
          )}
        </div>
      </section>

      {/* Genel */}
      <section className="settings-group">
        <h3>Sessizlik</h3>
        <div className="p-5 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-sm flex items-center gap-2"><BellOff size={16} /> Bugün bana dokunma</p>
              <p className="text-xs text-text-muted mt-0.5">Bugün hiçbir anımsatıcı gelmez; yarın kendiliğinden açılır.</p>
            </div>
            <Toggle checked={paused} onChange={(v) => run(() => saveSettings({ pauseDate: v ? today : '' }), v ? 'Bugün sessiz' : undefined)} label="Bugün bana dokunma" />
          </div>
          <div>
            <p className="field-label flex items-center gap-1.5"><Moon size={12} /> Sessiz saatler</p>
            <div className="flex items-center gap-2">
              <input type="time" className="input num w-[120px]" value={settings.quietStart ?? ''} onChange={(e) => run(() => saveSettings({ quietStart: e.target.value }))} />
              <span className="text-text-muted">–</span>
              <input type="time" className="input num w-[120px]" value={settings.quietEnd ?? ''} onChange={(e) => run(() => saveSettings({ quietEnd: e.target.value }))} />
            </div>
            <p className="text-[11px] text-text-muted mt-1.5">Bu aralıkta hiçbir şey gönderilmez. Ör: 00:30 – 07:00.</p>
          </div>
        </div>
      </section>

      {settings.telegramChatId && (
        <section className="now-card space-y-1.5">
          <p className="eyebrow">Bota yazabilirsin</p>
          <p className="text-sm leading-relaxed">Düz bir mesaj → <b>Aklımdakiler</b>. <b>/g</b> ile başlarsan → <b>günlüğüne</b> yazılır. Ör: <i>/g Bugün sahada inverter arızasını çözdük #saha</i></p>
          <p className="text-[11px] text-text-muted">Bot birkaç dakikada bir uyanır; cevabı 5 dakika içinde gelir.</p>
        </section>
      )}

      {/* Planlama soruları */}
      <section className="settings-group">
        <h3>Planlama soruları</h3>
        <div className="p-5 space-y-4">
          <PlanRow label="Sabah: “Bugüne bakalım mı?”" value={planning.morning} def="08:00" onChange={(v) => setPlanning({ morning: v })} />
          <PlanRow label="Akşam: “Günü kapatalım mı?”" value={planning.evening} def="22:00" onChange={(v) => setPlanning({ evening: v })} />
          <PlanRow label="Pazar: “Haftayı kapatalım mı?”" value={planning.sunday} def="20:00" onChange={(v) => setPlanning({ sunday: v })} />
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-semibold">Pazar akşamı haftanın mektubu</p>
            <Toggle checked={!!planning.letter} onChange={(v) => setPlanning({ letter: v })} label="Haftanın mektubu" />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold">Para soruları</p>
              <p className="text-xs text-text-muted mt-0.5">"Maaş yattı mı?", "Fatura ödendi mi?"</p>
            </div>
            <Toggle checked={planning.money !== false} onChange={(v) => setPlanning({ money: v })} label="Para soruları" />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold">İnsanlar</p>
              <p className="text-xs text-text-muted mt-0.5">Doğum günleri ve "uzun zamandır konuşmadın" soruları (10:30)</p>
            </div>
            <Toggle checked={planning.people !== false} onChange={(v) => setPlanning({ people: v })} label="İnsan hatırlatmaları" />
          </div>
        </div>
      </section>

      {/* Tüm anımsatıcılar */}
      <section className="settings-group">
        <h3>Rutin anımsatıcıları</h3>
        <div className="p-3">
          {withReminders.length === 0 ? (
            <p className="text-sm text-text-muted px-2 pb-2">Henüz yok. Bir rutini açıp "Anımsatıcı ekle" ile saat ve mesaj belirleyebilirsin.</p>
          ) : withReminders.flatMap((t) => (t.reminders ?? []).map((r, i) => (
            <div key={`${t.id}-${i}`} className="row-item" style={{ '--c': CATEGORIES[t.category].color } as React.CSSProperties}>
              <button onClick={() => openRoutine(t.id)} className="flex items-center gap-3 flex-1 min-w-0 text-left min-h-0">
                <span className="cat-bubble sm"><TrackerIcon name={t.icon} size={15} /></span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-semibold truncate"><span className="num">{r.time}</span> · {t.name}</span>
                  <span className="block text-xs text-text-muted truncate">{r.message || `${t.name} yaptın mı?`}{t.paused ? ' · rutin duraklatıldı' : ''}</span>
                </span>
              </button>
              <Toggle checked={r.on} onChange={(v) => toggleReminder(t.id, i, v)} label={`${t.name} ${r.time}`} />
            </div>
          )))}
        </div>
      </section>

      {timedTasks.length > 0 && (
        <section className="settings-group">
          <h3>Görev hatırlatmaları</h3>
          <ul className="p-3 space-y-1">
            {timedTasks.map((t) => (
              <li key={t.id} className="row-item"><Bell size={15} className="text-text-muted shrink-0" />
                <span className="flex-1 text-sm truncate">{t.text}</span>
                <span className="text-xs text-text-muted num shrink-0">{t.forDate === today ? '' : `${t.forDate!.slice(8)}.${t.forDate!.slice(5, 7)} `}{t.time} · {t.remindBefore} dk önce</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!linked && (
        <p className="text-[11px] text-text-muted text-center">Telegram bağlanana kadar anımsatıcılar sadece kaydedilir; gönderilmez.</p>
      )}
    </div>
  );
}

function PlanRow({ label, value, def, onChange }: { label: string; value?: string; def: string; onChange: (v: string) => void }) {
  const on = !!value;
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm font-semibold flex-1">{label}</p>
      {on && <input type="time" className="input num w-[110px] py-1.5" value={value} onChange={(e) => onChange(e.target.value)} />}
      <Toggle checked={on} onChange={(v) => onChange(v ? def : '')} label={label} />
    </div>
  );
}

