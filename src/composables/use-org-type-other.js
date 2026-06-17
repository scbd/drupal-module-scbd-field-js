// src/composables/use-org-type-other.js
//
// The synthetic "Other" organization type appended to the orgTypes domain (the thesaurus has
// no such term). Its localized `title` is generated from the `other` key of each requested
// locale's translation file via useTranslations — so it is no longer a hand-maintained,
// English-mostly constant and gains every locale that ships a translation.

import { useTranslations } from './use-translations.js';

/**
 * Build the "Other" org type with a `title` lstring covering the requested locales.
 * @param {string|string[]} [locales] one or more BCP-47 tags (or bare prefixes).
 * @returns {{ identifier: string, title: Record<string, string> }}
 */
export function useOrgTypeOther(locales = ['en']) {
  const { messages, t } = useTranslations(locales);
  const title = Object.fromEntries(Object.keys(messages).map((lang) => [lang, t('other', lang)]));
  return { identifier: 'ORG-TYPE-OTHER', title };
}
