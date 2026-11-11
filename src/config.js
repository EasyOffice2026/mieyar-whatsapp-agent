import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ quiet: true });

const digits = (value) => String(value || '').replace(/\D/g, '');

export const config = {
  port: Number(process.env.PORT || 4200),
  adminToken: process.env.ADMIN_TOKEN || '',
  dataDir: process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : null,
  websiteUrl: (process.env.WEBSITE_URL || 'https://mieyar-website.fly.dev').replace(/\/$/, ''),
  knowledge: {
    url: process.env.KNOWLEDGE_URL || '',
    cacheSeconds: Number(process.env.KNOWLEDGE_CACHE_SECONDS || 600),
  },
  whatsapp: {
    apiVersion: process.env.WHATSAPP_API_VERSION || 'v21.0',
    token: process.env.WHATSAPP_TOKEN || '',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || '',
    appSecret: process.env.WHATSAPP_APP_SECRET || '',
    sessionTtlHours: Number(process.env.SESSION_TTL_HOURS || 24),
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    baseUrl: (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, ''),
    chatModel: process.env.CHAT_MODEL || 'gpt-4o-mini',
    transcribeModel: process.env.TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe',
    historyLimit: Number(process.env.HISTORY_LIMIT || 16),
  },
  owner: {
    whatsappNumber: digits(process.env.OWNER_WHATSAPP_NUMBER),
    templateName: process.env.OWNER_TEMPLATE_NAME || '',
    templateLang: process.env.OWNER_TEMPLATE_LANG || 'en',
  },
};

export const isWhatsappConfigured = () => Boolean(config.whatsapp.token && config.whatsapp.phoneNumberId);
export const isOpenAiConfigured = () => Boolean(config.openai.apiKey);
