/* MeLife anımsatıcıları — GitHub Actions ile çalışır.
   GitHub zamanlayıcısı saatlerce gecikebildiği için her çalışma ~5,5 saat açık kalır ve dakikada bir bakar;
   sıradaki çalışma bu bitince devralır. Veri her dakika baştan okunmaz: Firestore canlı dinlenir (kota dostu).
   1) Telegram'dan gelen düğme yanıtlarını ve /start bağlantılarını işler (bot yalnızca bildirim gönderir)
   2) Zamanı gelen nazik soruları gönderir (tekrar göndermez)
   Gerekenler: TELEGRAM_BOT_TOKEN, FIREBASE_SERVICE_ACCOUNT (JSON) */

import { cert, initializeApp } from 'firebase-admin/app';
import { FieldPath, FieldValue, getFirestore, type DocumentReference, type Firestore, type Query } from 'firebase-admin/firestore';
import type { Contact, DayLog, Person, Settings, Task, Tracker } from '../src/types';
import type { Cashflow, Transaction, UserConfig } from '../src/finance/types';
import { ACK, doneValue, istanbulClock, ONLY_NOTIFY, parseAction, planUserMessages, type Clock } from './core';
import { answer, editText, getUpdates, send, type Update } from './telegram';
import { weekSummary } from '../src/utils/review';
import { weeklyLetter } from '../src/utils/letter';
import { addDays, weekStart } from '../src/utils/date';
import { isSpending } from '../src/finance/utils/effects';

const APP_URL = process.env.APP_URL || 'https://melife-app.web.app';
const MAX_WINDOW_MIN = 30; // kesinti sonrası eski anımsatıcı yağmuru olmasın
const RUN_MINUTES = Number(process.env.RUN_MINUTES || 330); // iş zaman aşımının (350 dk) altında kalsın
const TICK_MS = 60_000;

const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!sa) throw new Error('FIREBASE_SERVICE_ACCOUNT tanımlı değil');
initializeApp({ credential: cert(JSON.parse(sa)) });
const db: Firestore = getFirestore();

/* ── Canlı dinleme ─────────────────────────────────────── */

let broken = false; // dinleme koparsa bu çalışma erken biter, sıradaki temiz başlar

function watch<T>(q: Query): Promise<() => T[]> {
  return new Promise((resolve, reject) => {
    let items: T[] = [];
    let first = true;
    q.onSnapshot((snap) => {
      items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
      if (first) { first = false; resolve(() => items); }
    }, (e) => { console.error('dinleme koptu', e); broken = true; if (first) reject(e); });
  });
}

function watchDoc<T>(ref: DocumentReference): Promise<() => T | undefined> {
  return new Promise((resolve, reject) => {
    let data: T | undefined;
    let first = true;
    ref.onSnapshot((snap) => {
      data = snap.exists ? (snap.data() as T) : undefined;
      if (first) { first = false; resolve(() => data); }
    }, (e) => { console.error('dinleme koptu', e); broken = true; if (first) reject(e); });
  });
}

interface Live {
  trackers: () => Tracker[];
  tasks: () => Task[];
  snoozes: () => { id: string; trackerId?: string; fireAt: number }[];
  days: () => DayLog[];
  sent: () => { id: string }[];
  people: () => Person[];
  cashflows: () => Cashflow[];
  transactions: () => Transaction[];
  config: () => UserConfig | undefined;
}

interface UserRef { uid: string; ref: DocumentReference; settings: () => Settings; live?: Live }

async function loadUsers(): Promise<UserRef[]> {
  const refs = await db.collection('users').listDocuments();
  const out: UserRef[] = [];
  for (const ref of refs) {
    const settings = await watchDoc<Settings>(ref.collection('settings').doc('main'));
    if (settings()) out.push({ uid: ref.id, ref, settings: () => settings() ?? ({} as Settings) });
  }
  return out;
}

/** Telegram'a bağlı kullanıcının verisini ilk ihtiyaçta dinlemeye başla */
async function liveOf(user: UserRef): Promise<Live> {
  if (user.live) return user.live;
  const { ref, uid } = user;
  const since = addDays(istanbulClock(new Date()).date, -15);
  const [trackers, tasks, snoozes, days, sent, people, cashflows, transactions, config] = await Promise.all([
    watch<Tracker>(ref.collection('trackers')),
    watch<Task>(ref.collection('tasks')),
    watch<{ id: string; trackerId?: string; fireAt: number }>(ref.collection('snoozes')),
    watch<DayLog>(ref.collection('days').where(FieldPath.documentId(), '>=', since)),
    watch<{ id: string }>(ref.collection('sent').where('at', '>', Date.now() - 2 * 86_400_000)),
    watch<Person>(ref.collection('people')),
    watch<Cashflow>(db.collection('cashflows').where('userId', '==', uid)),
    watch<Transaction>(db.collection('transactions').where('userId', '==', uid)),
    watchDoc<UserConfig>(ref.collection('app').doc('config')),
  ]);
  user.live = { trackers, tasks, snoozes, days, sent, people, cashflows, transactions, config };
  return user.live;
}

/* ── 1) Gelen güncellemeler ────────────────────────────── */

async function handleUpdates(users: UserRef[], offset: number, waitSec: number): Promise<number> {
  let updates: Update[] = [];
  try { updates = await getUpdates(offset, waitSec); } catch (e) { console.error(e); await new Promise((r) => setTimeout(r, 5000)); return offset; }
  const byChat = (chatId: number) => users.find((u) => u.settings().telegramChatId === chatId);

  for (const u of updates) {
    offset = Math.max(offset, u.update_id + 1);
    try {
      // /start KOD → hesabı bağla
      const msg = u.message;
      if (msg?.text?.startsWith('/start')) {
        const code = msg.text.split(/\s+/)[1]?.trim().toUpperCase();
        const user = code ? users.find((x) => x.settings().telegramLinkCode?.toUpperCase() === code) : undefined;
        if (user) {
          await user.ref.collection('settings').doc('main').set({ telegramChatId: msg.chat.id, telegramLinkCode: '' }, { merge: true });
          const name = user.settings().displayName?.split(' ')[0];
          await send(msg.chat.id, `Bağlandı ✓ ${name ? `Merhaba ${name}! ` : ''}Anımsatıcıların artık buradan gelecek. Hepsi isteğe bağlı; istediğin zaman susturabilirsin.`);
        } else {
          await send(msg.chat.id, 'Merhaba! Bağlanmak için MeLife → Daha → Anımsatıcılar → "Telegram\'a bağlan" ile aldığın kodu gönder: <b>/start KOD</b>');
        }
        continue;
      }

      // Bot yalnızca bildirim gönderir; yazılan mesajlar kaydedilmez
      if (msg?.text) {
        if (byChat(msg.chat.id)) await send(msg.chat.id, ONLY_NOTIFY);
        continue;
      }

      // Düğmeler
      const cq = u.callback_query;
      if (cq?.data && cq.message) {
        const user = byChat(cq.message.chat.id);
        const action = parseAction(cq.data);
        if (!user || !action) { await answer(cq.id, 'Bu mesaj artık geçerli değil'); continue; }
        if (action.kind === 'done') {
          const tSnap = await user.ref.collection('trackers').doc(action.trackerId).get();
          const dayRef = user.ref.collection('days').doc(action.date);
          const day = (await dayRef.get()).data() as DayLog | undefined;
          if (tSnap.exists) {
            const t = { id: tSnap.id, ...tSnap.data() } as Tracker;
            const value = doneValue(t, day?.entries?.[t.id] ?? 0);
            await dayRef.set({ date: action.date, updatedAt: Date.now(), entries: { [t.id]: value } }, { merge: true });
          }
        } else if (action.kind === 'later') {
          await user.ref.collection('snoozes').add({ trackerId: action.trackerId, date: action.date, fireAt: Date.now() + 15 * 60_000 });
        } else if (action.kind === 'skip') {
          await user.ref.collection('sent').doc(`skip_${action.trackerId}_${action.date}`).set({ at: Date.now() });
        } else if (action.kind === 'task') {
          await user.ref.collection('tasks').doc(action.taskId).set({ done: true }, { merge: true });
        } else if (action.kind === 'contact') {
          const pRef = user.ref.collection('people').doc(action.personId);
          const person = (await pRef.get()).data() as Person | undefined;
          if (person) {
            const contacts: Contact[] = [{ date: action.date, kind: 'talk' as const }, ...(person.contacts ?? [])].slice(0, 60);
            await pRef.set({ lastContact: action.date, contacts }, { merge: true });
          }
        }
        await answer(cq.id, ACK[action.kind]);
        await editText(cq.message.chat.id, cq.message.message_id, `${cq.message.text ?? ''}\n\n<i>${ACK[action.kind]}</i>`);
      }
    } catch (e) {
      console.error('güncelleme işlenemedi', u.update_id, e);
    }
  }
  return offset;
}

/* ── 2) Gönderilecekler ────────────────────────────────── */

function buildLetter(user: UserRef, live: Live, clock: Clock): string {
  const weekOf = weekStart(clock.date);
  const days = Object.fromEntries(live.days().map((d) => [d.id, d]));
  const trackers = live.trackers();
  const ctx = { tasksFor: () => 0 };
  const s = weekSummary(weekOf, { trackers, days, tasks: live.tasks(), ctx }, clock.date);
  const end = addDays(weekOf, 6);
  const spending = live.transactions().filter((t) => isSpending(t) && t.date >= weekOf && t.date <= end);
  const byCat: Record<string, number> = {};
  spending.forEach((t) => { byCat[t.category] = (byCat[t.category] ?? 0) + t.amount; });
  return weeklyLetter({
    name: user.settings().displayName?.split(' ')[0],
    doneTasks: s.doneTasks.length,
    routines: s.routines.map((r) => ({ name: r.t.name, done: r.done, planned: r.planned })),
    sleepAvg: s.sleepAvg, moodAvg: s.moodAvg,
    studyMinutes: s.durations.filter((d) => d.t.key === 'study').reduce((a, d) => a + d.minutes, 0),
    reduce: s.reduce.map((r) => ({ name: r.t.name, unit: r.t.unit, avg: r.avg, prevAvg: r.prevAvg })),
    spent: spending.reduce((a, t) => a + t.amount, 0),
    topCategory: Object.entries(byCat).sort((a, b) => b[1] - a[1])[0]?.[0],
  });
}

async function runUser(user: UserRef, clock: Clock, fromMin: number) {
  const settings = user.settings();
  const chatId = settings.telegramChatId;
  if (!chatId) return 0;
  const live = await liveOf(user);
  const skipped = live.sent().map((d) => d.id).filter((id) => id.startsWith('skip_') && id.endsWith(clock.date)).map((id) => id.slice(5, -clock.date.length - 1));
  const p = settings.planning;
  const letter = clock.weekday === 0 && p?.letter && p.sunday ? buildLetter(user, live, clock) : undefined;
  const snoozes = live.snoozes();

  const messages = planUserMessages({
    settings, trackers: live.trackers(), day: live.days().find((d) => d.id === clock.date),
    tasks: live.tasks().filter((t) => t.forDate === clock.date), cashflows: live.cashflows(), transactions: live.transactions(),
    snoozes, clock, fromMin, appUrl: APP_URL, skipped, salaryDayHint: live.config()?.salaryDayHint, letter, people: live.people(),
  });

  let sent = 0;
  for (const m of messages) {
    // Aynı anahtar daha önce gönderildiyse atla (create başarısız olur)
    try { await user.ref.collection('sent').doc(m.key).create({ at: Date.now() }); } catch { continue; }
    try { await send(chatId, m.text, m.buttons); sent++; } catch (e) { console.error('gönderilemedi', m.key, e); }
  }
  // İşlenen ertelemeleri ve deneme isteğini temizle
  await Promise.all(snoozes.filter((z) => z.fireAt <= clock.ms).map((z) => user.ref.collection('snoozes').doc(z.id).delete()));
  if (settings.telegramTest) await user.ref.collection('settings').doc('main').set({ telegramTest: FieldValue.delete() }, { merge: true });
  return sent;
}

async function tick(users: UserRef[], lastRun: number | undefined): Promise<number> {
  const now = new Date();
  const clock = istanbulClock(now);
  const last = Math.max(lastRun ?? now.getTime() - 10 * 60_000, now.getTime() - MAX_WINDOW_MIN * 60_000);
  const fromMin = istanbulClock(new Date(last)).minutes;
  let total = 0;
  for (const u of users) {
    try { total += await runUser(u, clock, fromMin); } catch (e) { console.error('kullanıcı işlenemedi', u.uid, e); }
  }
  if (total) console.log(`${clock.date} ${Math.floor(clock.minutes / 60)}:${String(clock.minutes % 60).padStart(2, '0')} · ${total} mesaj`);
  return now.getTime();
}

async function main() {
  const deadline = Date.now() + RUN_MINUTES * 60_000;
  const stateRef = db.collection('system').doc('telegram');
  const state = (await stateRef.get()).data() as { offset?: number; lastRun?: number } | undefined;
  let offset = state?.offset ?? 0;
  let lastRun = state?.lastRun;
  const users = await loadUsers();
  console.log(`${users.length} kullanıcı · ${RUN_MINUTES} dk açık kalacak`);

  while (Date.now() < deadline && !broken) {
    if (!lastRun || Date.now() - lastRun >= TICK_MS) {
      lastRun = await tick(users, lastRun);
      await stateRef.set({ offset, lastRun }, { merge: true });
    }
    // Düğmelere hemen cevap: bir sonraki bakışa kadar Telegram'ı bekle (uzun yoklama)
    const waitSec = Math.max(1, Math.min(50, Math.floor((lastRun + TICK_MS - Date.now()) / 1000), Math.floor((deadline - Date.now()) / 1000)));
    const next = await handleUpdates(users, offset, waitSec);
    if (next !== offset) { offset = next; await stateRef.set({ offset }, { merge: true }); }
  }
  console.log(broken ? 'Dinleme koptu, sıradaki çalışma devralacak' : 'Süre doldu, sıradaki çalışma devralacak');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
