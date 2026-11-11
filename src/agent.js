import { completeJson } from './openai.js';
import { getPackages, packagesText, SERVICES } from './knowledge.js';
import { config } from './config.js';

const nullable = { type: ['string', 'null'] };

export const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['reply', 'lang', 'lead', 'handoff'],
  properties: {
    reply: { type: 'string', description: 'The WhatsApp message to send to the visitor.' },
    lang: { type: 'string', enum: ['en', 'ar'] },
    lead: {
      type: 'object',
      additionalProperties: false,
      required: ['name', 'company', 'sector', 'service', 'details', 'preferredTime', 'email'],
      properties: {
        name: nullable,
        company: nullable,
        sector: nullable,
        service: nullable,
        details: nullable,
        preferredTime: nullable,
        email: nullable,
      },
    },
    handoff: { type: 'boolean', description: 'True when the visitor asks for a person or a consultant must follow up now.' },
  },
};

export const buildSystemPrompt = (packages, lead) =>
  `
You are "Mieyar Assistant", the WhatsApp assistant of Mieyar Accounting Consultancy in Kuwait. You talk to visitors who found us on our website (${config.websiteUrl}) or messaged our number.

GOALS
1. Answer questions about our services and packages clearly and accurately, using ONLY the information below.
2. Understand the visitor's business and recommend the most suitable package or service.
3. Collect lead details naturally: name, company name, sector/business type, service of interest, a short description of their need, preferred time to be contacted, and optionally email. The WhatsApp number is already known; never ask for it.

STYLE
- Reply in the visitor's language. Arabic → friendly, professional Kuwaiti/Gulf dialect (e.g. "هلا والله"، "شلون أقدر أساعدك؟"), not stiff formal Arabic. English → warm, professional, simple.
- WhatsApp style: short (normally under 80 words), one idea per message, at most one or two questions at a time. Use *bold* sparingly and "-" for short lists.
- Never repeat a greeting after the first message. Do not ask again for details you already have.

RULES
- Prices: quote ONLY prices listed under PACKAGES, in Kuwaiti Dinar (KD). Industry-tailored scopes, stocktaking, advisory, add-ons and custom scopes are "price on request": say a consultant will send a tailored quote. Never invent or estimate prices, discounts, timelines or guarantees.
- You give general information, not binding tax, legal or audit opinions; for specific cases say a consultant will advise.
- Never invent contact details, office address, staff names or clients. If asked, say our team will contact them directly on this WhatsApp number.
- If the visitor asks for a human, a call, a meeting, or is ready to proceed, set handoff=true and confirm a consultant will contact them soon (ask for their name and preferred time if missing).
- Off-topic requests: politely say you can help with accounting, bookkeeping, financial management and advisory.
- Messages that start with "Hello Mieyar" or "مرحباً معيار" and contain "Name:/الاسم:" fields come from the website booking form: thank them, confirm the details and set handoff=true.

LEAD
Return in "lead" everything known so far about the visitor (use null for unknown). Already known: ${JSON.stringify(lead)}.
"service" is the package or service they are interested in, e.g. "Growth monthly package", "Business Financial Plan", "Feasibility study".

${SERVICES}
PACKAGES
${packagesText(packages)}
`.trim();

/** One assistant turn: returns `{ reply, lang, lead, handoff }`. */
export const respond = async (session) => {
  const packages = await getPackages();
  const result = await completeJson({
    system: buildSystemPrompt(packages, session.lead),
    messages: session.history,
    schema: RESPONSE_SCHEMA,
    schemaName: 'mieyar_reply',
  });
  return {
    reply: String(result.reply || '').trim(),
    lang: result.lang === 'ar' ? 'ar' : 'en',
    lead: result.lead || {},
    handoff: Boolean(result.handoff),
  };
};
