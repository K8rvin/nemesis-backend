// ==========================================
// 🌍 ЛОКАЛИЗАЦИЯ КОНТЕНТА (nodes/choices/achievements)
// ==========================================

const SUPPORTED_LANGS = ['ru', 'en', 'es', 'de', 'pt_br'];

// Цепочка fallback для игрового контента: запрошенный язык -> EN -> RU (исходный текст в БД).
const CONTENT_FALLBACK_CHAIN = {
  ru: [],
  en: [],
  es: ['en'],
  pt_br: ['en'],
  de: ['en'],
};

/**
 * Нормализует значение Accept-Language в один из поддерживаемых кодов.
 * pt-BR / pt-br -> pt_br
 * Неизвестный/отсутствующий -> ru (дефолт).
 */
export function normalizeLang(raw) {
  if (!raw) return 'ru';
  const [primary, secondary] = raw.toLowerCase().split('-');
  if (primary === 'pt' && secondary === 'br') return 'pt_br';
  if (SUPPORTED_LANGS.includes(primary)) return primary;
  return 'ru';
}

function getTranslation(translations, field, lang) {
  if (!translations || typeof translations !== 'object') return undefined;
  const chain = CONTENT_FALLBACK_CHAIN[lang] || [];
  for (const l of [lang, ...chain]) {
    if (translations[l]?.[field] != null) return translations[l][field];
  }
  return undefined;
}

/**
 * Применяет переводы к записи. Поле translations удаляется из ответа.
 */
export function localizeRecord(record, fields, lang) {
  if (!record) return record;
  const localized = { ...record };
  for (const f of fields) {
    const translated = getTranslation(record.translations, f, lang);
    if (translated !== undefined) localized[f] = translated;
  }
  delete localized.translations;
  return localized;
}

export function localizeNode(node, lang) {
  return localizeRecord(node, ['location_name', 'title', 'narrative', 'thought'], lang);
}

export function localizeChoice(choice, lang) {
  return localizeRecord(choice, ['label', 'narrative_override'], lang);
}

export function localizeAchievement(achievement, lang) {
  return localizeRecord(achievement, ['title', 'description'], lang);
}
