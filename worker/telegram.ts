/* Telegram Bot API — yalnızca ihtiyaç duyulan çağrılar */

import type { Button } from './core';

const token = () => {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error('TELEGRAM_BOT_TOKEN tanımlı değil');
  return t;
};

async function call<T>(method: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${token()}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { ok: boolean; result: T; description?: string };
  if (!json.ok) throw new Error(`Telegram ${method}: ${json.description}`);
  return json.result;
}

const keyboard = (buttons?: Button[][]) =>
  buttons?.length
    ? { inline_keyboard: buttons.map((row) => row.map((b) => (b.url ? { text: b.text, url: b.url } : { text: b.text, callback_data: b.data }))) }
    : undefined;

export function send(chatId: number, text: string, buttons?: Button[][]) {
  return call<{ message_id: number }>('sendMessage', {
    chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: keyboard(buttons),
  });
}

export function editText(chatId: number, messageId: number, text: string) {
  return call('editMessageText', { chat_id: chatId, message_id: messageId, text, parse_mode: 'HTML' }).catch(() => undefined);
}

export function answer(callbackId: string, text: string) {
  return call('answerCallbackQuery', { callback_query_id: callbackId, text }).catch(() => undefined);
}

export interface Update {
  update_id: number;
  message?: { chat: { id: number }; text?: string; from?: { first_name?: string } };
  callback_query?: { id: string; data?: string; message?: { chat: { id: number }; message_id: number; text?: string } };
}

export function getUpdates(offset: number) {
  return call<Update[]>('getUpdates', { offset, timeout: 0, allowed_updates: ['message', 'callback_query'] });
}
