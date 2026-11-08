import { config } from './config.js';
import { createStore } from './store.js';

const store = createStore('sessions');

export const LEAD_FIELDS = ['name', 'company', 'sector', 'service', 'details', 'preferredTime', 'email'];
const emptyLead = () => Object.fromEntries(LEAD_FIELDS.map((f) => [f, null]));

const blank = (phone, waName) => ({ phone, waName: waName || null, lang: null, lead: emptyLead(), history: [], updatedAt: Date.now() });

const isExpired = (s) => Date.now() - s.updatedAt > config.whatsapp.sessionTtlHours * 3600 * 1000;

export const get = (phone, waName) => {
  const existing = store.get(phone);
  if (!existing) return store.set(phone, blank(phone, waName));
  if (isExpired(existing)) existing.history = [];
  if (waName) existing.waName = waName;
  return existing;
};

export const save = (session) => {
  session.updatedAt = Date.now();
  return store.set(session.phone, session);
};

export const remember = (session, role, content) => {
  if (!content) return;
  session.history.push({ role, content: String(content).slice(0, 2000) });
  const limit = config.openai.historyLimit;
  if (session.history.length > limit) session.history.splice(0, session.history.length - limit);
};

/** Copies non-empty values from the model's lead into the session; returns true if anything changed. */
export const mergeLead = (session, lead) => {
  let changed = false;
  for (const field of LEAD_FIELDS) {
    const value = typeof lead?.[field] === 'string' ? lead[field].trim() : '';
    if (value && value !== session.lead[field]) {
      session.lead[field] = value.slice(0, 500);
      changed = true;
    }
  }
  return changed;
};

export const clearAll = () => store.clear();
