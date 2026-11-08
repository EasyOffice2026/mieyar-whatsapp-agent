# Mieyar WhatsApp Agent

WhatsApp AI assistant for **Mieyar Accounting Consultancy**. Website visitors (and anyone who messages the business number) chat with it in English or Kuwaiti Arabic, by text or voice note. It answers from the website's services and packages, recommends a package, collects lead details and sends each lead to the owner's WhatsApp.

Standalone service: it has its own data and only reads the public package list from the website (`/knowledge.json`).

## How it works

1. Meta WhatsApp Cloud API posts each message to `POST /webhook` (signature checked with `WHATSAPP_APP_SECRET`).
2. Voice notes are downloaded and transcribed with OpenAI (`TRANSCRIBE_MODEL`).
3. OpenAI (`CHAT_MODEL`) answers using the service descriptions in `src/knowledge.js` and the live prices from `KNOWLEDGE_URL`, and returns the reply plus the lead details it has learnt, as strict JSON.
4. The first reply includes three quick buttons: Our services / Packages & prices / Talk to a consultant.
5. When a lead has a name, a service and a business type, or the visitor asks for a person, a summary with a `wa.me` link is sent to `OWNER_WHATSAPP_NUMBER`.
6. Leads are listed at `/admin/leads` (user `admin`, password `ADMIN_TOKEN`; add `?format=json` for JSON).

Prices are never invented: only prices published on the website are quoted; clinics, inventory, advisory and add-ons are "price on request".

## Run locally

```bash
cp .env.example .env   # fill in the keys
npm install
npm run dev            # http://localhost:4200/health
npm test
npm run lint
```

## Configuration

See `.env.example`. Required for live use: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `OPENAI_API_KEY`, `OWNER_WHATSAPP_NUMBER`.

Owner notifications are sent as a normal text, which WhatsApp only delivers within 24 hours of the owner's last message to the bot. For reliable delivery create a Utility template in WhatsApp Manager with one body variable (for example `New Mieyar lead: {{1}}`) and set `OWNER_TEMPLATE_NAME` / `OWNER_TEMPLATE_LANG`.

## Deploy (Fly.io)

```bash
fly apps create mieyar-whatsapp-agent
fly volumes create agent_data --size 1 --region fra -a mieyar-whatsapp-agent
fly secrets set WHATSAPP_TOKEN=... WHATSAPP_PHONE_NUMBER_ID=... WHATSAPP_VERIFY_TOKEN=... \
  WHATSAPP_APP_SECRET=... OPENAI_API_KEY=... OWNER_WHATSAPP_NUMBER=... ADMIN_TOKEN=... -a mieyar-whatsapp-agent
fly deploy
```

Then in the Meta app: WhatsApp → Configuration → Webhook, callback URL `https://mieyar-whatsapp-agent.fly.dev/webhook`, verify token = `WHATSAPP_VERIFY_TOKEN`, and subscribe to the `messages` field.
