// src/utils/nationalTargets.js
//
// "National Targets 7" come from the api.cbd.int Solr index (index/select) rather than the
// thesaurus domains handled by useTaxonomies, so their fetch + query-building lives here.
// Each doc is normalized to the { identifier, name } shape the field widget consumes.

import { ofetch } from 'ofetch';

const INDEX_URL = 'https://api.cbd.int/api/v2013/index/select';

/** Map Drupal locale codes to the index's `title_<LANG>_t` field language. */
const mapLocaleFromDrupal = (locale) =>
  locale === 'zh-hans' ? 'zh' : locale === 'fil' ? 'tl' : locale;

/** Extra `title_<LANG>_t` fields to request as name fallbacks for the non-primary locales. */
const extraTitleFields = (locales = [], locale) =>
  locales.length === 1 && locales[0] === locale
    ? ''
    : locales.filter((l) => l !== locale).map((l) => `, title_${mapLocaleFromDrupal(l).toUpperCase()}_t`).join('');

/** Build the Solr `index/select` request body. Sort on the `_s` string twin, never the `_t` text field. */
const indexQuery = (countries = [], start = 0, rows = 1000, locale = 'en', locales = ['en']) => {
  const governmentQuery = countries.length ? `AND government_s : (${countries.join(' ')})` : '';
  return JSON.stringify({
    df: `text_${locale.toUpperCase()}_txt`,
    fq: ['_state_s:public', 'realm_ss:ort'],
    q: `(schema_s : (nationalTarget7)${governmentQuery})`,
    sort: `title_${locale.toUpperCase()}_s asc`,
    fl: `identifier:uniqueIdentifier_s, name:title_${mapLocaleFromDrupal(locale).toUpperCase()}_t${extraTitleFields(locales, locale)}`,
    wt: 'json',
    start,
    rows,
  });
};

/** Fall back to the first available alternate-locale title when the primary `name` is empty. */
const normalizeNationalTarget = (currentLocale, locales, doc) => {
  if (doc.name) return doc;
  const alt = locales
    .filter((l) => l !== currentLocale)
    .map((l) => doc[`title_${mapLocaleFromDrupal(l).toUpperCase()}_t`])
    .find(Boolean);
  return alt ? { ...doc, name: alt } : doc;
};

/**
 * Fetch National Targets 7 for the given countries/locales.
 * @param {{ countries?: string[], start?: number, rows?: number, locale: string, locales: string[] }} [ctx]
 * @returns {Promise<Array<{ identifier: string, name: string }>>}
 */
export async function getNationalTargets7({ countries = [], start = 0, rows = 25, locale, locales } = {}) {
  try {
    const { response } = await ofetch(INDEX_URL, {
      method: 'post',
      body: indexQuery(countries, start, rows, locale, locales),
      headers: { 'Content-Type': 'application/json' },
    });
    return response.docs.map((doc) => normalizeNationalTarget(mapLocaleFromDrupal(locale), locales, doc));
  } catch (error) {
    console.error('Error fetching national targets:', error);
    throw error;
  }
}
