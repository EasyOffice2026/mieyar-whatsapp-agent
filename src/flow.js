import { isOpenAiConfigured } from './config.js';
import * as wa from './whatsapp.js';
import * as sessions from './sessions.js';
import * as leads from './leads.js';
import { respond } from './agent.js';
import { transcribe } from './openai.js';
import { copy, detectLang } from './copy.js';

/** Handles one inbound WhatsApp message end to end. */
export const handleInbound = async ({ phone, waName, text, replyId, audioId, mimeType, unsupported }) => {
  const session = sessions.get(phone, waName);
  let input = String(text || '').trim();

  if (audioId) {
    try {
      const media = await wa.downloadMedia(audioId);
      input = media && isOpenAiConfigured() ? await transcribe(media.buffer, media.mimeType || mimeType) : '';
    } catch (error) {
      console.error('[flow] voice note failed', error.message);
    }
    if (!input) return wa.sendText(phone, copy[session.lang || 'ar'].voiceFailed);
  }
  if (!input) {
    if (unsupported) return wa.sendText(phone, copy[session.lang || 'en'].unsupported);
    return null;
  }

  const firstMessage = session.history.length === 0;
  session.lang ||= detectLang(input);
  sessions.remember(session, 'user', input);

  let result;
  try {
    if (!isOpenAiConfigured()) throw new Error('OPENAI_API_KEY not set');
    result = await respond(session);
  } catch (error) {
    console.error('[flow] assistant failed', error.message);
    result = { reply: copy[detectLang(input)].fallback, lang: detectLang(input), lead: {}, handoff: true };
  }
  if (replyId === 'menu_human') result.handoff = true;

  session.lang = result.lang;
  sessions.mergeLead(session, result.lead);
  sessions.remember(session, 'assistant', result.reply);
  sessions.save(session);

  if (firstMessage) await wa.sendButtons(phone, result.reply, copy[session.lang].buttons);
  else await wa.sendText(phone, result.reply);

  await leads.record(session, { handoff: result.handoff });
  return result;
};
