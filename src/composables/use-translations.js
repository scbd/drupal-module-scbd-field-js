// src/composables/useTranslations.js
//
// Loads the CHM widget's UI-label translations (domain names, the "Other" org type, ...)
// for a given set of locales. Replaces the hand-maintained src/i18n/index.js barrel: locale
// JSON files are discovered with import.meta.glob, so adding a locale is just dropping a file
// into src/i18n/locales/ — no central list to keep in sync.
//
// The production build is a single-file IIFE (vite lib build), which inlines every chunk, so
// eager vs lazy glob makes no difference to bundle size here. Eager keeps `t()` synchronous —
// no readiness to await in templates — while the returned `messages` is still scoped to the
// locales the caller actually asked for.

const localeModules = import.meta.glob('../i18n/locales/*.json', { eager: true, import: 'default' });

// { en: { gbfTargets: 'GBF Targets', ... }, fr: { ... }, ... } keyed by language prefix.
const byLang = Object.fromEntries(
  Object.entries(localeModules).map(([path, messages]) => [path.match(/([\w-]+)\.json$/)[1], messages]),
);

/** Normalize a tag / array of tags to a deduped list of language prefixes ('en-US' -> 'en'). */
const toLangs = (locales) =>
  [...new Set([locales].flat().filter(Boolean).map((l) => String(l).split('-')[0]))];

/**
 * UI-label translations scoped to the requested locales (English is always included as the
 * fallback). Call once in `setup`.
 * @param {string|string[]} [locales] one or more BCP-47 tags (or bare prefixes).
 * @returns {{
 *   messages: Record<string, Record<string, string>>,
 *   t: (key: string, locale?: string) => string,
 * }}
 */
export function useTranslations(locales = ['en']) {
  const langs = toLangs(locales);
  const messages = Object.fromEntries(
    [...langs, 'en'].filter((l) => byLang[l]).map((l) => [l, byLang[l]]),
  );

  /** Localized label for `key`, falling back to the requested locale's language, then English, then the raw key. */
  const t = (key, locale) => {
    const lang = String(locale || langs[0] || 'en').split('-')[0];
    return messages[lang]?.[key] ?? messages.en?.[key] ?? key;
  };

  return { messages, t };
}
