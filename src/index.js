import { app } from './app.js';
import { config, isWhatsappConfigured, isOpenAiConfigured } from './config.js';

app.listen(config.port, () => {
  console.log(`Mieyar WhatsApp agent listening on :${config.port}`);
  if (!isWhatsappConfigured()) console.warn('WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID not set: replies will not be delivered');
  if (!isOpenAiConfigured()) console.warn('OPENAI_API_KEY not set: visitors get the fallback reply');
  if (!config.owner.whatsappNumber) console.warn('OWNER_WHATSAPP_NUMBER not set: leads are only saved');
});
