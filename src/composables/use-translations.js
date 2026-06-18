// src/composables/use-translations.js
//
// Loads the CHM widget's UI-label translations (domain names, the "Other" org type, ...) ON
// DEMAND: only the locales a caller actually asks for are fetched, each via its own dynamic
// import (import.meta.glob, lazy). English is bundled statically as the always-present fallback,
// so the default call (no locales) costs zero dynamic imports. Adding a locale is still just
// dropping a JSON file into src/i18n/locales/ — no central list to keep in sync.
//
// `messages` is REACTIVE: a requested locale is merged in once its import resolves, so any
// template reading `t()` re-renders when its translations arrive. For a non-reactive snapshot
// (e.g. option labels baked into a plain array), await the returned `ready` promise first.
//
// A requested locale with no translation file (or one that fails to load) is skipped with a
// single console warning and `t()` falls back to English.

import { reactive } from 'vue';
import en from '@/i18n/locales/en.json';

// Lazy loaders keyed by language prefix: { fr: () => import('.../fr.json'), ... }. English is
// excluded — it is always present via the static import above.
const loaders = Object.fromEntries(
  // NOTE: keep this glob RELATIVE — the `@` alias does not resolve inside import.meta.glob patterns
  // (Vite 6 silently matches zero files), which would break on-demand locale loading.
  Object.entries(import.meta.glob('../i18n/locales/*.json', { import: 'default' }))
    .map(([path, load]) => [path.match(/([\w-]+)\.json$/)[1], load])
    .filter(([lang]) => lang !== 'en'),
);

// Module-wide so each locale file loads at most once and each missing locale warns at most once,
// across every useTranslations call (the component and useOrgTypeOther both call it).
const cache = {}; // lang -> Promise<messages>
const warned = new Set();

const warnOnce = (lang, why, err) => {
  if (warned.has(lang)) return;
  warned.add(lang);
  console.warn(`[scbd-field] ${why} for locale "${lang}"; using English`, ...(err ? [err] : []));
};

/** Normalize a tag / array of tags to a deduped list of language prefixes ('en-US' -> 'en'). */
const toLangs = (locales) =>
  [...new Set([locales].flat().filter(Boolean).map((l) => String(l).split('-')[0]))];

/**
 * UI-label translations scoped to the requested locales (English is always included as the
 * fallback) and loaded on demand. Call once in `setup`.
 * @param {string|string[]} [locales] one or more BCP-47 tags (or bare prefixes).
 * @returns {{
 *   messages: Record<string, Record<string, string>>,
 *   t: (key: string, locale?: string) => string,
 *   ready: Promise<void>,
 * }}
 */
export function useTranslations(locales = ['en']) {
  const langs = toLangs(locales);
  const messages = reactive({ en });

  const load = async (lang) => {
    if (lang === 'en') return; // always present
    if (!loaders[lang]) return warnOnce(lang, 'no translations');
    try {
      messages[lang] = await (cache[lang] ??= loaders[lang]());
    } catch (err) {
      warnOnce(lang, 'failed to load translations', err);
    }
  };

  // Resolves once every requested locale is loaded (or has fallen back); never rejects.
  const ready = Promise.all(langs.map(load)).then(() => {});

  /** Localized label for `key`, falling back to the requested locale's language, then English, then the raw key. */
  const t = (key, locale) => {
    const lang = String(locale || langs[0] || 'en').split('-')[0];
    return messages[lang]?.[key] ?? messages.en?.[key] ?? key;
  };

  return { messages, t, ready };
}
