import fs from 'fs';
import { config } from './config.js';

const FALLBACK = JSON.parse(fs.readFileSync(new URL('./packages.fallback.json', import.meta.url), 'utf8'));

let cache = { at: 0, data: null };

/** Package data published by the website at /knowledge.json, cached; the bundled copy is used if it cannot be fetched. */
export const getPackages = async () => {
  if (!config.knowledge.url) return FALLBACK;
  if (cache.data && Date.now() - cache.at < config.knowledge.cacheSeconds * 1000) return cache.data;
  try {
    const response = await fetch(config.knowledge.url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`status ${response.status}`);
    const data = await response.json();
    if (!data?.monthlyPackages?.en) throw new Error('unexpected shape');
    cache = { at: Date.now(), data };
    return data;
  } catch (error) {
    console.error('[knowledge] using bundled package data:', error.message);
    return cache.data || FALLBACK;
  }
};

export const clearCache = () => { cache = { at: 0, data: null }; };

const period = { monthly: { en: 'per month', ar: 'شهرياً' }, oneTime: { en: 'one-time', ar: 'لمرة واحدة' } };

const describe = (pkgs, lang) =>
  pkgs.map((p) => `- ${p.name}: KD ${p.price} ${period[p.period]?.[lang] || ''}. ${p.desc} Includes: ${p.features.join('; ')}.`).join('\n');

export const packagesText = (data) =>
  [
    'MONTHLY ACCOUNTING & BOOKKEEPING PACKAGES (English names):',
    describe(data.monthlyPackages.en, 'en'),
    'Same packages, Arabic names:',
    describe(data.monthlyPackages.ar, 'ar'),
    '',
    'ONE-TIME BUSINESS PLAN (English name):',
    describe(data.smePackages.en, 'en'),
    'Same packages, Arabic names:',
    describe(data.smePackages.ar, 'ar'),
    '',
    `ADD-ON SERVICES (priced on request): ${data.addOns.en.join('; ')}`,
  ].join('\n');

export const SERVICES = `
COMPANY: Mieyar Accounting Consultancy (شركة معيار للاستشارات المحاسبية), Kuwait.
Tagline: Bookkeeping · Financial Management · Advisory. Serves businesses of every size and industry in Kuwait: trading and distribution, retail and e-commerce, restaurants and cafés, healthcare, contracting and real estate, professional services, salons and fitness, startups and home businesses.

SERVICES
1. Accounting & Bookkeeping (monthly packages above): recording transactions, bank and delivery-platform reconciliations, payroll, monthly closing, financial statements, zakat calculation, year-end and audit support.
2. Financial Management: financial statements, cash-flow planning, budgets, KPIs and dashboards.
3. SME one-time plans (above): Startup Plan (costing, pricing, 1-year cash flow and feasibility), F&B Launch Plan for restaurants and cafés (menu costing and pricing, break-even, 2-year cash flow, sales targets and feasibility) and Expansion Plan for new projects and expansions in any industry (3-year financial plan, feasibility, CAPEX/OPEX, P&L, staffing budget, KPIs and dashboard).
4. Industry-tailored accounting (price on request): bookkeeping and reporting adapted to the visitor's sector, e.g. stock and costing for trading/retail, delivery-platform reconciliations for F&B, insurance receivables for healthcare, project costing for contracting.
5. Inventory stocktaking (add-on, price on request): counts, reconciliation with records and a variance report.
6. Advisory (price on request):
   - Business strategy: business plans, feasibility studies, market research, growth strategy, mentoring founders.
   - Financial advisory: financial analysis, budgeting and forecasting, costing and pricing, business valuation, benchmarking, bank and investor presentations.
   - Process & controls: organisational structure, process improvement, internal controls and governance, risk assessment, accounting system selection and setup, KPI frameworks.

HOW WE WORK: 1) free initial consultation to understand the business, 2) proposal with the right package, 3) onboarding of documents and systems, 4) monthly delivery and reporting.
`;
