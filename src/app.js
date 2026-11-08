import express from 'express';
import { config, isWhatsappConfigured, isOpenAiConfigured } from './config.js';
import * as wa from './whatsapp.js';
import * as leads from './leads.js';
import { handleInbound } from './flow.js';

export const app = express();
app.use(express.json({ limit: '2mb', verify: (req, _res, buf) => { req.rawBody = buf; } }));

app.get('/', (_req, res) => res.redirect(config.websiteUrl));

app.get('/health', (_req, res) =>
  res.json({ ok: true, whatsapp: isWhatsappConfigured(), openai: isOpenAiConfigured(), owner: Boolean(config.owner.whatsappNumber), ownerTemplate: Boolean(config.owner.templateName) }),
);

// Meta webhook verification handshake.
app.get('/webhook', (req, res) => {
  if (config.whatsapp.verifyToken && req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === config.whatsapp.verifyToken) {
    return res.status(200).send(req.query['hub.challenge']);
  }
  return res.sendStatus(403);
});

// Meta retries webhooks it did not get a 200 for; remembering recent ids avoids double replies.
const seen = new Map();
const isDuplicate = (id) => {
  if (!id) return false;
  if (seen.has(id)) return true;
  seen.set(id, Date.now());
  if (seen.size > 5000) for (const key of [...seen.keys()].slice(0, 1000)) seen.delete(key);
  return false;
};

// Messages from one visitor are handled in order, one at a time.
const queues = new Map();
const enqueue = (phone, task) => {
  const next = (queues.get(phone) || Promise.resolve()).then(task).catch((error) => console.error('[webhook] failed handling message', error));
  queues.set(phone, next);
  next.finally(() => queues.get(phone) === next && queues.delete(phone));
  return next;
};

app.post('/webhook', (req, res) => {
  if (!wa.verifySignature(req.rawBody, req.get('x-hub-signature-256'))) {
    console.error('[webhook] rejected: invalid signature (check WHATSAPP_APP_SECRET)');
    return res.sendStatus(401);
  }
  res.sendStatus(200);
  for (const entry of req.body?.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
      if (config.whatsapp.phoneNumberId && value.metadata?.phone_number_id && value.metadata.phone_number_id !== config.whatsapp.phoneNumberId) continue;
      const contacts = value.contacts || [];
      for (const message of value.messages || []) {
        if (isDuplicate(message.id)) continue;
        const waName = contacts.find((c) => c.wa_id === message.from)?.profile?.name;
        wa.markAsRead(message.id);
        enqueue(message.from, () => handleInbound({ phone: message.from, waName, ...wa.extractInput(message) }));
      }
    }
  }
});

const requireAdmin = (req, res, next) => {
  if (!config.adminToken) return res.sendStatus(404);
  const [scheme, encoded] = String(req.get('authorization') || '').split(' ');
  const [user, pass] = Buffer.from(encoded || '', 'base64').toString().split(':');
  if (scheme === 'Basic' && user === 'admin' && pass === config.adminToken) return next();
  res.set('WWW-Authenticate', 'Basic realm="Mieyar leads"').sendStatus(401);
};

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const COLUMNS = [['updatedAt', 'Last message'], ['name', 'Name'], ['phone', 'WhatsApp'], ['company', 'Company'], ['sector', 'Sector'], ['service', 'Interested in'], ['details', 'Details'], ['preferredTime', 'Best time'], ['email', 'Email'], ['handoffAt', 'Asked for consultant']];
const cell = (lead, key) => {
  if (key === 'phone') return `<a href="https://wa.me/${esc(lead.phone)}">+${esc(lead.phone)}</a>`;
  if (key === 'updatedAt' || key === 'handoffAt') return lead[key] ? new Date(lead[key]).toLocaleString('en-GB', { timeZone: 'Asia/Kuwait' }) : '';
  return esc(lead[key]);
};

app.get('/admin/leads', requireAdmin, (req, res) => {
  const all = leads.list();
  if (req.query.format === 'json') return res.json(all);
  res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mieyar leads</title>
<style>body{font-family:system-ui,sans-serif;margin:24px;color:#1d2433}h1{color:#10243f}table{border-collapse:collapse;width:100%;font-size:14px}th,td{border:1px solid #e6e1d6;padding:8px;text-align:start;vertical-align:top}th{background:#10243f;color:#fff}tr:nth-child(even){background:#faf7f0}a{color:#10243f}</style></head>
<body><h1>WhatsApp leads (${all.length})</h1><table><thead><tr>${COLUMNS.map(([, h]) => `<th>${h}</th>`).join('')}</tr></thead><tbody>
${all.map((l) => `<tr>${COLUMNS.map(([k]) => `<td dir="auto">${cell(l, k)}</td>`).join('')}</tr>`).join('\n')}
</tbody></table></body></html>`);
});
