Object.assign(process.env, {
  WHATSAPP_TOKEN: 'wa-token',
  WHATSAPP_PHONE_NUMBER_ID: '111',
  WHATSAPP_VERIFY_TOKEN: 'verify-me',
  WHATSAPP_APP_SECRET: 'app-secret',
  OPENAI_API_KEY: 'sk-test',
  OWNER_WHATSAPP_NUMBER: '+965 5000 0000',
  ADMIN_TOKEN: 'admin-pass',
  KNOWLEDGE_URL: '',
  DATA_DIR: '',
});

const realFetch = globalThis.fetch;
export const calls = [];
export const replies = [];

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Queue the next assistant turn (or an Error to simulate an OpenAI failure). */
export const queueReply = (value) => replies.push(value);

globalThis.fetch = async (url, options = {}) => {
  const u = String(url);
  if (u.startsWith('http://127.0.0.1')) return realFetch(url, options);
  const body = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
  calls.push({ url: u, body });
  if (u.includes('/chat/completions')) {
    const next = replies.shift();
    if (!next || next instanceof Error) return json({ error: { message: 'boom' } }, 500);
    const result = { lang: 'en', handoff: false, ...next, lead: { name: null, company: null, sector: null, service: null, details: null, preferredTime: null, email: null, ...next.lead } };
    return json({ choices: [{ message: { content: JSON.stringify(result) } }] });
  }
  if (u.includes('/audio/transcriptions')) return json({ text: 'كم سعر باقة النمو؟' });
  if (u.endsWith('/media-1')) return json({ url: 'https://lookaside.example/media-1', mime_type: 'audio/ogg; codecs=opus' });
  if (u.startsWith('https://lookaside.example')) return new Response(Buffer.from('OggS'));
  if (u.includes('graph.facebook.com')) return json({ messages: [{ id: 'wamid.out' }] });
  throw new Error(`unexpected fetch ${u}`);
};

export const sent = () => calls.filter((c) => c.url.endsWith('/111/messages') && c.body?.to);
export const toOwner = () => sent().filter((c) => c.body.to === '96550000000');
export const chats = () => calls.filter((c) => c.url.includes('/chat/completions'));
export const reset = () => { calls.length = 0; replies.length = 0; };
