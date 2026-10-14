/* MeLife anımsatıcıları — GitHub Actions ile birkaç dakikada bir çalışır.
   1) Telegram'dan gelen düğme yanıtlarını ve /start bağlantılarını işler
   2) Zamanı gelen nazik soruları gönderir (tekrar göndermez)
   Gerekenler: TELEGRAM_BOT_TOKEN, FIREBASE_SERVICE_ACCOUNT (JSON) */

import { cert, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore, type DocumentReference, type Firestore } from 'firebase-admin/firestore';
import type { DayLog, Settings, Task, Tracker } from '../src/types';
import type { Cashflow, Transaction, UserConfig } from '../src/finance/types';
import { ACK, doneValue, istanbulClock, parseAction, planUserMessages, type Clock } from './core';
import { answer, editText, getUpdates, send, type Update } from './telegram';
import { weekSummary } from '../src/utils/review';
import { weeklyLetter } from '../src/utils/letter';
import { addDays, weekStart } from '../src/utils/date';
import { isSpending } from '../src/finance/utils/effects';

const APP_URL = process.env.APP_URL || 'https://melife-app.web.app';
const MAX_WINDOW_MIN = 30; // kesinti sonrası eski anımsatıcı yağmuru olmasın

const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!sa) throw new Error('FIREBASE_SERVICE_ACCOUNT tanımlı değil');
initializeApp({ credential: cert(JSON.parse(sa)) });
const db: Firestore = getFirestore();

interface UserRef { uid: string; ref: DocumentReference; settings: Settings }

async function loadUsers(): Promise<UserRef[]> {
  const refs = await db.collection('users').listDocuments();
  const out: UserRef[] = [];
  for (const ref of refs) {
    const snap = await ref.collection('settings').doc('main').get();
    if (snap.exists) out.push({ uid: ref.id, ref, settings: snap.data() as Settings });
  }
  return out;
}

const list = async <T,>(ref: DocumentReference, col: string) =>
  (await ref.collection(col).get()).docs.map((d) => ({ id: d.id, ...d.data() }) as T);

/* ── 1) Gelen güncellemeler ────────────────────────────── */

async function handleUpdates(users: UserRef[], offset: number): Promise<number> {
  let updates: Update[] = [];
  try { updates = await getUpdates(offset); } catch (e) { console.error(e); return offset; }
  const byChat = (chatId: number) => users.find((u) => u.settings.telegramChatId === chatId);

  for (const u of updates) {
    offset = Math.max(offset, u.update_id + 1);
    try {
      // /start KOD → hesabı bağla
      const msg = u.message;
      if (msg?.text?.startsWith('/start')) {
        const code = msg.text.split(/\s+/)[1]?.trim().toUpperCase();
        const user = code ? users.find((x) => x.settings.telegramLinkCode?.toUpperCase() === code) : undefined;
        if (user) {
          await user.ref.collection('settings').doc('main').set({ telegramChatId: msg.chat.id, telegramLinkCode: '' }, { merge: true });
          user.settings.telegramChatId = msg.chat.id;
          const name = user.settings.displayName?.split(' ')[0];
          await send(msg.chat.id, `Bağlandı ✓ ${name ? `Merhaba ${name}! ` : ''}Anımsatıcıların artık buradan gelecek. Hepsi isteğe bağlı; istediğin zaman susturabilirsin.`);
        } else {
          await send(msg.chat.id, 'Merhaba! Bağlanmak için MeLife → Daha → Anımsatıcılar → "Telegram\'a bağlan" ile aldığın kodu gönder: <b>/start KOD</b>');
        }
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

async function buildLetter(user: UserRef, trackers: Tracker[], tasks: Task[], transactions: Transaction[], clock: Clock): Promise<string> {
  const weekOf = weekStart(clock.date);
  const ids = Array.from({ length: 14 }, (_, i) => addDays(weekOf, i - 7));
  const daySnaps = await Promise.all(ids.map((id) => user.ref.collection('days').doc(id).get()));
  const days = Object.fromEntries(daySnaps.filter((s) => s.exists).map((s) => [s.id, { id: s.id, ...s.data() } as DayLog]));
  const ctx = { tasksFor: () => 0 };
  const s = weekSummary(weekOf, { trackers, days, tasks, ctx }, clock.date);
  const end = addDays(weekOf, 6);
  const spending = transactions.filter((t) => isSpending(t) && t.date >= weekOf && t.date <= end);
  const byCat: Record<string, number> = {};
  spending.forEach((t) => { byCat[t.category] = (byCat[t.category] ?? 0) + t.amount; });
  return weeklyLetter({
    name: user.settings.displayName?.split(' ')[0],
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
  const chatId = user.settings.telegramChatId;
  if (!chatId) return 0;
  const [trackers, tasks, snoozes, daySnap, sentSnap] = await Promise.all([
    list<Tracker>(user.ref, 'trackers'),
    list<Task>(user.ref, 'tasks').then((ts) => ts.filter((t) => t.forDate === clock.date)),
    list<{ id: string; trackerId?: string; fireAt: number }>(user.ref, 'snoozes'),
    user.ref.collection('days').doc(clock.date).get(),
    user.ref.collection('sent').where('at', '>', Date.now() - 2 * 86_400_000).get(),
  ]);
  const skipped = sentSnap.docs.map((d) => d.id).filter((id) => id.startsWith('skip_') && id.endsWith(clock.date)).map((id) => id.slice(5, -clock.date.length - 1));
  const cashflows = (await db.collection('cashflows').where('userId', '==', user.uid).get()).docs.map((d) => ({ id: d.id, ...d.data() }) as Cashflow);
  const transactions = (await db.collection('transactions').where('userId', '==', user.uid).get()).docs.map((d) => ({ id: d.id, ...d.data() }) as Transaction);
  const finCfg = (await user.ref.collection('app').doc('config').get()).data() as UserConfig | undefined;
  const p = user.settings.planning;
  const letter = clock.weekday === 0 && p?.letter && p.sunday ? await buildLetter(user, trackers, await list<Task>(user.ref, 'tasks'), transactions, clock) : undefined;

  const messages = planUserMessages({
    settings: user.settings, trackers, day: daySnap.exists ? ({ id: daySnap.id, ...daySnap.data() } as DayLog) : undefined,
    tasks, cashflows, transactions, snoozes, clock, fromMin, appUrl: APP_URL, skipped, salaryDayHint: finCfg?.salaryDayHint, letter,
  });

  let sent = 0;
  for (const m of messages) {
    // Aynı anahtar daha önce gönderildiyse atla (create başarısız olur)
    try { await user.ref.collection('sent').doc(m.key).create({ at: Date.now() }); } catch { continue; }
    try { await send(chatId, m.text, m.buttons); sent++; } catch (e) { console.error('gönderilemedi', m.key, e); }
  }
  // İşlenen ertelemeleri ve deneme isteğini temizle
  await Promise.all(snoozes.filter((z) => z.fireAt <= clock.ms).map((z) => user.ref.collection('snoozes').doc(z.id).delete()));
  if (user.settings.telegramTest) await user.ref.collection('settings').doc('main').set({ telegramTest: FieldValue.delete() }, { merge: true });
  return sent;
}

async function main() {
  const stateRef = db.collection('system').doc('telegram');
  const state = (await stateRef.get()).data() as { offset?: number; lastRun?: number } | undefined;
  const now = new Date();
  const clock = istanbulClock(now);
  const last = Math.max(state?.lastRun ?? now.getTime() - 10 * 60_000, now.getTime() - MAX_WINDOW_MIN * 60_000);
  const fromMin = istanbulClock(new Date(last)).minutes;

  const users = await loadUsers();
  const offset = await handleUpdates(users, state?.offset ?? 0);

  let total = 0;
  for (const u of users) {
    try { total += await runUser(u, clock, fromMin); } catch (e) { console.error('kullanıcı işlenemedi', u.uid, e); }
  }
  await stateRef.set({ offset, lastRun: now.getTime() }, { merge: true });
  console.log(`${clock.date} ${Math.floor(clock.minutes / 60)}:${String(clock.minutes % 60).padStart(2, '0')} · ${users.length} kullanıcı · ${total} mesaj`);
}

main().catch((e) => { console.error(e); process.exit(1); });
