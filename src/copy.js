export const detectLang = (text) => (/[\u0600-\u06FF]/.test(String(text || '')) ? 'ar' : 'en');

export const copy = {
  en: {
    buttons: [
      { id: 'menu_services', title: 'Our services' },
      { id: 'menu_packages', title: 'Packages & prices' },
      { id: 'menu_human', title: 'Talk to a consultant' },
    ],
    unsupported: 'Sorry, I can only read text and voice messages. How can I help you?',
    voiceFailed: "Sorry, I couldn't hear that voice note clearly. Could you type your question or send it again?",
    fallback: 'Thank you for contacting Mieyar Accounting Consultancy. A consultant will get back to you shortly on this number.',
  },
  ar: {
    buttons: [
      { id: 'menu_services', title: 'خدماتنا' },
      { id: 'menu_packages', title: 'الباقات والأسعار' },
      { id: 'menu_human', title: 'التحدث مع مستشار' },
    ],
    unsupported: 'عذراً، أقدر أقرأ الرسائل النصية والصوتية بس. شلون أقدر أساعدك؟',
    voiceFailed: 'عذراً، ما قدرت أسمع الرسالة الصوتية زين. ممكن تكتب سؤالك أو ترسلها مرة ثانية؟',
    fallback: 'شكراً لتواصلك مع شركة معيار للاستشارات المحاسبية. بيتواصل وياك أحد مستشارينا قريباً على هذا الرقم.',
  },
};

const LABELS = { name: 'Name', company: 'Company', sector: 'Sector', service: 'Interested in', details: 'Details', preferredTime: 'Best time', email: 'Email' };

export const ownerSummary = (entry, reason) =>
  [
    reason === 'handoff' ? '*Visitor asked for a consultant*' : '*New website lead*',
    ...Object.entries(LABELS).filter(([k]) => entry[k]).map(([k, label]) => `${label}: ${entry[k]}`),
    entry.waName ? `WhatsApp name: ${entry.waName}` : null,
    `Chat: https://wa.me/${entry.phone}`,
  ]
    .filter(Boolean)
    .join('\n');
