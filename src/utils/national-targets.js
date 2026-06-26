// src/utils/national-targets.js
//
// "National Targets 7" come from the api.cbd.int Solr index (index/select) rather than the
// thesaurus domains handled by useTaxonomies, so their fetch + query-building lives here.
// Each doc is normalized to the { identifier, name } shape the field widget consumes.

import { ofetch } from 'ofetch';

const INDEX_URL = 'https://api.cbd.int/api/v2013/index/select';

// Solr-injection guards (S1): only clean ISO/locale codes are interpolated into the query.
// `government_s` takes ISO-3166-1 alpha-2 codes; locales build `title_<LANG>_t/_s` field names.
// These whitelists reject Solr metacharacters (space, `(`, `)`, `:`, `*`, quotes). They are applied
// at the boundary (getNationalTargets7) AND re-asserted inside indexQuery (defense-in-depth, CR-8 /
// SEC-2): indexQuery fails closed for any caller, and the re-assertion is idempotent — sanitized
// input yields byte-identical output, so the boundary caller's behavior is unchanged.
const COUNTRY_RE = /^[a-z]{2}$/i;
const LOCALE_RE = /^[a-z]{2,3}(-[a-z0-9]+)?$/i;

/** Drop any country token that is not a clean ISO-3166-1 alpha-2 code. */
const safeCountries = (countries = []) => countries.filter((c) => COUNTRY_RE.test(c));
/** Drop any locale token that carries Solr metacharacters or is otherwise malformed. */
const safeLocales = (locales = []) => locales.filter((l) => LOCALE_RE.test(l));
/** Fall back to 'en' when the primary locale is malformed (still needed for field names). */
const safeLocale = (locale) => (LOCALE_RE.test(locale) ? locale : 'en');

/** Map Drupal locale codes to the index's `title_<LANG>_t` field language. */
const mapLocaleFromDrupal = (locale) =>
  locale === 'zh-hans' ? 'zh' : locale === 'fil' ? 'tl' : locale;

/** Extra `title_<LANG>_t` fields to request as name fallbacks for the non-primary locales. */
const extraTitleFields = (locales = [], locale) =>
  locales.length === 1 && locales[0] === locale
    ? ''
    : locales.filter((l) => l !== locale).map((l) => `, title_${mapLocaleFromDrupal(l).toUpperCase()}_t`).join('');

/**
 * Build the Solr `index/select` request body. Sort on the `_s` string twin, never the `_t` text field.
 *
 * Whitelists (COUNTRY_RE / LOCALE_RE) are re-asserted here via the boundary helpers so the function
 * fails closed regardless of caller (defense-in-depth, CR-8 / SEC-2). This is idempotent with the
 * boundary sanitizer in getNationalTargets7 — already-sanitized input produces byte-identical output —
 * while an invalid DIRECT call drops bad country/locale values (locale falls back to 'en') instead of
 * injecting Solr metacharacters into the df/sort/fl field names.
 *
 * @param {string[]} [countries] ISO-3166-1 alpha-2 country codes; non-conforming values are dropped.
 * @param {number} [start]
 * @param {number} [rows]
 * @param {string} [locale] primary locale; falls back to 'en' if malformed.
 * @param {string[]} [locales] alternate locales for fallback name fields; malformed values dropped.
 * @returns {string} JSON request body for `index/select`.
 */
export const indexQuery = (countries = [], start = 0, rows = 1000, locale = 'en', locales = ['en']) => {
  const ctry = safeCountries(countries);
  const loc = safeLocale(locale);
  const locs = safeLocales(locales);
  const governmentQuery = ctry.length ? `AND government_s : (${ctry.join(' ')})` : '';
  return JSON.stringify({
    df: `text_${loc.toUpperCase()}_txt`,
    fq: ['_state_s:public', 'realm_ss:ort'],
    q: `(schema_s : (nationalTarget7)${governmentQuery})`,
    sort: `title_${loc.toUpperCase()}_s asc`,
    fl: `identifier:uniqueIdentifier_s, name:title_${mapLocaleFromDrupal(loc).toUpperCase()}_t${extraTitleFields(locs, loc)}`,
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
export async function getNationalTargets7({ countries = [], start = 0, rows = 1000, locale, locales } = {}) {
  // Sanitize once at the boundary, then thread the safe values through query + normalize (S1).
  const loc = safeLocale(locale);
  const locs = safeLocales(locales ?? [loc]);
  const ctry = safeCountries(countries);
  try {
    const { response } = await ofetch(INDEX_URL, {
      method: 'post',
      body: indexQuery(ctry, start, rows, loc, locs),
      headers: { 'Content-Type': 'application/json' },
      // Abort a hung Solr request instead of leaving the field in a perpetual loading state —
      // matches fetchDomain's 20s ceiling in use-taxonomies.js (SEC-1 / CWE-400).
      timeout: 20000,
    });
    return response.docs.map((doc) => normalizeNationalTarget(mapLocaleFromDrupal(loc), locs, doc));
  } catch (error) {
    // Resolve to [] (like getData) so one failure can't reject the shared Promise.all batch (C3).
    console.error('Error fetching national targets:', error);
    return [];
  }
}
