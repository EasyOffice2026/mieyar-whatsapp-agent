import { config } from './config.js';

const headers = (extra = {}) => ({ Authorization: `Bearer ${config.openai.apiKey}`, ...extra });

const fail = async (response, what) => {
  const body = await response.json().catch(() => ({}));
  throw new Error(body?.error?.message || `${what} failed with status ${response.status}`);
};

const EXTENSIONS = { 'audio/ogg': 'ogg', 'audio/opus': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/aac': 'aac', 'audio/amr': 'amr', 'audio/wav': 'wav' };
const extensionFor = (mimeType) => EXTENSIONS[String(mimeType || '').split(';')[0].trim()] || 'ogg';

// Arabic first: with an English-only prompt, Kuwaiti voice notes tend to come back translated into English.
const TRANSCRIBE_PROMPT = 'استفسار عن خدمات محاسبة ومسك دفاتر واستشارات مالية في الكويت، باللهجة الكويتية أو بالإنجليزي. Accounting and bookkeeping enquiry in Kuwaiti Arabic or English; write it in the language spoken, never translate.';

export const transcribe = async (buffer, mimeType) => {
  const model = config.openai.transcribeModel;
  const form = new FormData();
  form.append('model', model);
  form.append('response_format', 'json');
  form.append('prompt', TRANSCRIBE_PROMPT);
  form.append('file', new Blob([buffer], { type: mimeType }), `voice.${extensionFor(mimeType)}`);
  const response = await fetch(`${config.openai.baseUrl}/audio/transcriptions`, { method: 'POST', headers: headers(), body: form });
  if (!response.ok) await fail(response, 'Transcription');
  const data = await response.json();
  return String(data.text || '').trim();
};

/** Chat completion constrained to a strict JSON schema; returns the parsed object. */
export const completeJson = async ({ system, messages, schema, schemaName }) => {
  const response = await fetch(`${config.openai.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      model: config.openai.chatModel,
      temperature: 0.3,
      messages: [{ role: 'system', content: system }, ...messages],
      response_format: { type: 'json_schema', json_schema: { name: schemaName, strict: true, schema } },
    }),
  });
  if (!response.ok) await fail(response, 'Chat completion');
  const data = await response.json();
  return JSON.parse(data.choices?.[0]?.message?.content || '{}');
};
