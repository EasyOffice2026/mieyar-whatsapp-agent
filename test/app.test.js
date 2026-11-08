import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { queueReply, sent, reset } from './helpers.js';

const { app } = await import('../src/app.js');
let server, base;
before(() => new Promise((resolve) => { server = app.listen(0, '127.0.0.1', () => { base = `http://127.0.0.1:${server.address().port}`; resolve(); }); }));
after(() => server.close());

const sign = (body) => `sha256=${crypto.createHmac('sha256', 'app-secret').update(body).digest('hex')}`;
const message = (id, text) => JSON.stringify({ entry: [{ changes: [{ value: { metadata: { phone_number_id: '111' }, contacts: [{ wa_id: '96540404040', profile: { name: 'Noor' } }], messages: [{ id, from: '96540404040', type: 'text', text: { body: text } }] } }] }] });

test('health reports configuration', async () => {
  const body = await (await fetch(`${base}/health`)).json();
  assert.deepEqual(body, { ok: true, whatsapp: true, openai: true, owner: true, ownerTemplate: false });
});

test('webhook verification handshake', async () => {
  const ok = await fetch(`${base}/webhook?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=42`);
  assert.equal(ok.status, 200);
  assert.equal(await ok.text(), '42');
  assert.equal((await fetch(`${base}/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=42`)).status, 403);
});

test('webhook rejects bad signatures and answers valid messages once', async () => {
  reset();
  const body = message('wamid.1', 'Hello');
  const bad = await fetch(`${base}/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-hub-signature-256': 'sha256=bad' }, body });
  assert.equal(bad.status, 401);

  queueReply({ reply: 'Hi Noor!' });
  const post = () => fetch(`${base}/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-hub-signature-256': sign(body) }, body });
  assert.equal((await post()).status, 200);
  assert.equal((await post()).status, 200);
  for (let i = 0; i < 50 && !sent().length; i++) await new Promise((r) => setTimeout(r, 20));
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(sent().length, 1);
  assert.equal(sent()[0].body.to, '96540404040');
});

test('lead list needs the admin password', async () => {
  assert.equal((await fetch(`${base}/admin/leads`)).status, 401);
  const auth = { Authorization: `Basic ${Buffer.from('admin:admin-pass').toString('base64')}` };
  const res = await fetch(`${base}/admin/leads?format=json`, { headers: auth });
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(await res.json()));
  assert.match(await (await fetch(`${base}/admin/leads`, { headers: auth })).text(), /WhatsApp leads/);
});
