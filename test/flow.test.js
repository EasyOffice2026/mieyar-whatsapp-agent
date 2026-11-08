import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { calls, queueReply, sent, toOwner, chats, reset } from './helpers.js';

const { handleInbound } = await import('../src/flow.js');
const sessions = await import('../src/sessions.js');
const leads = await import('../src/leads.js');

beforeEach(() => { reset(); sessions.clearAll(); leads.clearAll(); });

test('first reply has quick buttons and the prompt carries website prices', async () => {
  queueReply({ reply: 'Welcome to Mieyar! How can I help?' });
  await handleInbound({ phone: '96511112222', waName: 'Sara', text: 'Hi, how much is bookkeeping?' });

  const system = chats()[0].body.messages[0].content;
  assert.match(system, /Growth: KD 250/);
  assert.match(system, /Startup Plan: KD 350/);
  assert.match(system, /price on request/i);
  const [msg] = sent();
  assert.equal(msg.body.type, 'interactive');
  assert.equal(msg.body.interactive.body.text, 'Welcome to Mieyar! How can I help?');
  assert.equal(msg.body.interactive.action.buttons.length, 3);
  assert.equal(toOwner().length, 0);

  queueReply({ reply: 'The Growth package is KD 250 per month.' });
  await handleInbound({ phone: '96511112222', text: 'And the middle one?' });
  assert.equal(sent().at(-1).body.type, 'text');
  assert.equal(chats()[1].body.messages.filter((m) => m.role !== 'system').length, 3);
});

test('owner gets one summary when the lead is complete and one when a person is requested', async () => {
  const phone = '96533334444';
  queueReply({ reply: 'Hello!' });
  await handleInbound({ phone, text: 'hello' });
  queueReply({ reply: 'Thanks Ahmad, I recommend Growth.', lead: { name: 'Ahmad', sector: 'Restaurant', service: 'Growth monthly package' } });
  await handleInbound({ phone, text: 'I am Ahmad, I run a restaurant and need monthly bookkeeping' });

  assert.equal(toOwner().length, 1);
  const summary = toOwner()[0].body.text.body;
  assert.match(summary, /New website lead/);
  assert.match(summary, /Name: Ahmad/);
  assert.match(summary, /Interested in: Growth monthly package/);
  assert.match(summary, /wa\.me\/96533334444/);

  queueReply({ reply: 'Noted, evenings.', lead: { preferredTime: 'Evening' } });
  await handleInbound({ phone, text: 'call me in the evening' });
  assert.equal(toOwner().length, 1);

  queueReply({ reply: 'A consultant will contact you soon.', handoff: true });
  await handleInbound({ phone, text: 'can I talk to a person?' });
  assert.equal(toOwner().length, 2);
  assert.match(toOwner()[1].body.text.body, /asked for a consultant/);
  assert.match(toOwner()[1].body.text.body, /Best time: Evening/);

  queueReply({ reply: 'Sure.', handoff: true });
  await handleInbound({ phone, text: 'please hurry' });
  assert.equal(toOwner().length, 2);
  assert.equal(leads.list()[0].name, 'Ahmad');
});

test('"Talk to a consultant" button always hands over', async () => {
  queueReply({ reply: 'Hi' });
  await handleInbound({ phone: '96555556666', text: 'hi' });
  queueReply({ reply: 'Sure, a consultant will call you.' });
  await handleInbound({ phone: '96555556666', text: 'Talk to a consultant', replyId: 'menu_human' });
  assert.equal(toOwner().length, 1);
});

test('voice notes are transcribed and answered', async () => {
  queueReply({ reply: 'باقة النمو بـ 250 د.ك شهرياً', lang: 'ar' });
  await handleInbound({ phone: '96577778888', audioId: 'media-1', mimeType: 'audio/ogg' });
  const upload = calls.find((c) => c.url.includes('/audio/transcriptions'));
  assert.ok(upload.body instanceof FormData);
  assert.equal(upload.body.get('file').name, 'voice.ogg');
  assert.equal(chats()[0].body.messages.at(-1).content, 'كم سعر باقة النمو؟');
  assert.deepEqual(sent()[0].body.interactive.action.buttons.map((b) => b.reply.title), ['خدماتنا', 'الباقات والأسعار', 'التحدث مع مستشار']);
});

test('when OpenAI fails the visitor gets a polite fallback and the owner is told', async () => {
  queueReply(new Error('down'));
  await handleInbound({ phone: '96599990000', waName: 'Fahad', text: 'السلام عليكم' });
  assert.match(sent()[0].body.interactive.body.text, /معيار/);
  assert.equal(toOwner().length, 1);
  assert.match(toOwner()[0].body.text.body, /WhatsApp name: Fahad/);
});

test('unsupported media gets a short explanation without calling OpenAI', async () => {
  await handleInbound({ phone: '96512121212', text: '', unsupported: true });
  assert.equal(chats().length, 0);
  assert.match(sent()[0].body.text.body, /text and voice/);
});
