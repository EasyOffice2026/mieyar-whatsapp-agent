import crypto from 'crypto';
import { config, isWhatsappConfigured } from './config.js';

const graphBase = () => `https://graph.facebook.com/${config.whatsapp.apiVersion}`;
const auth = () => ({ Authorization: `Bearer ${config.whatsapp.token}` });

export const truncate = (value, max) => {
  const text = String(value ?? '');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};

const send = async (payload) => {
  if (!isWhatsappConfigured()) {
    console.warn('[whatsapp] not configured, message not delivered:', JSON.stringify(payload).slice(0, 200));
    return { skipped: true };
  }
  const response = await fetch(`${graphBase()}/${config.whatsapp.phoneNumberId}/messages`, {
    method: 'POST',
    headers: { ...auth(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', ...payload }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error?.message || `WhatsApp send failed with status ${response.status}`);
  return body;
};

export const sendText = (to, text) => send({ to, type: 'text', text: { body: truncate(text, 4096), preview_url: false } });

/** Up to 3 quick-reply buttons; WhatsApp caps titles at 20 characters. */
export const sendButtons = (to, text, buttons) =>
  send({
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: truncate(text, 1024) },
      action: { buttons: buttons.slice(0, 3).map((b) => ({ type: 'reply', reply: { id: b.id, title: truncate(b.title, 20) } })) },
    },
  });

/** Approved template with one body parameter (parameters may not contain new lines). */
export const sendTemplate = (to, name, lang, param) =>
  send({
    to,
    type: 'template',
    template: {
      name,
      language: { code: lang },
      components: [{ type: 'body', parameters: [{ type: 'text', text: truncate(String(param).replace(/\s*\n\s*/g, ' | ').replace(/ {4,}/g, ' '), 1000) }] }],
    },
  });

export const markAsRead = async (messageId) => {
  if (!isWhatsappConfigured() || !messageId) return;
  await fetch(`${graphBase()}/${config.whatsapp.phoneNumberId}/messages`, {
    method: 'POST',
    headers: { ...auth(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', status: 'read', message_id: messageId }),
  }).catch((err) => console.error('[whatsapp] mark as read failed', err.message));
};

/** Downloads inbound media (a voice note) as `{ buffer, mimeType }`. */
export const downloadMedia = async (mediaId) => {
  if (!isWhatsappConfigured() || !mediaId) return null;
  const meta = await fetch(`${graphBase()}/${mediaId}`, { headers: auth() });
  const info = await meta.json().catch(() => ({}));
  if (!meta.ok || !info.url) throw new Error(info?.error?.message || `WhatsApp media lookup failed with status ${meta.status}`);
  const file = await fetch(info.url, { headers: auth() });
  if (!file.ok) throw new Error(`WhatsApp media download failed with status ${file.status}`);
  return { buffer: Buffer.from(await file.arrayBuffer()), mimeType: info.mime_type || 'audio/ogg' };
};

export const verifySignature = (rawBody, signatureHeader) => {
  if (!config.whatsapp.appSecret) return true;
  if (!signatureHeader || !rawBody) return false;
  const expected = `sha256=${crypto.createHmac('sha256', config.whatsapp.appSecret).update(rawBody).digest('hex')}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

/** Normalises one webhook message into `{ text, replyId, audioId, unsupported }`. */
export const extractInput = (message) => {
  if (message.type === 'text') return { text: message.text?.body || '' };
  if (message.type === 'interactive') {
    const reply = message.interactive?.button_reply || message.interactive?.list_reply;
    if (reply) return { replyId: reply.id, text: reply.title || '' };
  }
  if (message.type === 'button') return { text: message.button?.text || '' };
  if (message.type === 'audio' && message.audio?.id) return { text: '', audioId: message.audio.id, mimeType: message.audio.mime_type };
  const caption = message[message.type]?.caption;
  if (caption) return { text: caption };
  return { text: '', unsupported: true };
};
