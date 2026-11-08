import { config } from './config.js';
import { createStore } from './store.js';
import * as wa from './whatsapp.js';
import { ownerSummary } from './copy.js';

const store = createStore('leads');

export const isComplete = (lead) => Boolean(lead.name && lead.service && (lead.company || lead.sector || lead.details));

export const list = () => store.values().sort((a, b) => b.updatedAt - a.updatedAt);

/** Saves the visitor's lead and tells the owner once it is complete, and again when the visitor asks for a person. */
export const record = async (session, { handoff }) => {
  const now = Date.now();
  const entry = store.get(session.phone) || { phone: session.phone, createdAt: now, notifiedAt: null, handoffAt: null };
  Object.assign(entry, { waName: session.waName, lang: session.lang, ...session.lead, updatedAt: now });
  if (handoff && !entry.handoffAt) entry.handoffAt = now;

  const reason = handoff && !entry.handoffNotified ? 'handoff' : isComplete(session.lead) && !entry.notifiedAt ? 'new' : null;
  store.set(session.phone, entry);
  if (!reason) return { notified: false };

  const sent = await notifyOwner(entry, reason);
  if (sent) {
    entry.notifiedAt ??= now;
    if (reason === 'handoff') entry.handoffNotified = true;
    store.set(session.phone, entry);
  }
  return { notified: sent, reason };
};

const notifyOwner = async (entry, reason) => {
  const to = config.owner.whatsappNumber;
  if (!to) {
    console.warn('[leads] OWNER_WHATSAPP_NUMBER not set, lead saved only:', entry.phone);
    return false;
  }
  const text = ownerSummary(entry, reason);
  try {
    if (config.owner.templateName) await wa.sendTemplate(to, config.owner.templateName, config.owner.templateLang, text);
    else await wa.sendText(to, text);
    return true;
  } catch (error) {
    console.error('[leads] owner notification failed', error.message);
    return false;
  }
};

export const clearAll = () => store.clear();
