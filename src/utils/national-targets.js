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
const LOCALE_RE = /^[a-z]{2,3}(-[a-z]{2,8})?$/i;
/** Page-size guards: an unbounded `rows` lets one caller ask the index for everything. */
const DEFAULT_ROWS = 25;
const MAX_ROWS = 1000;
/** Matches the bound use-taxonomies already applies to its own fetches. */
const REQUEST_TIMEOUT_MS = 20000;

/** Drop any country token that is not a clean ISO-3166-1 alpha-2 code. */
const safeCountries = (countries = []) =>
  [].concat(countries ?? []).filter((c) => typeof c === 'string' && COUNTRY_RE.test(c));
/** Drop any locale token that carries Solr metacharacters or is otherwise malformed. */
const safeLocales = (locales = []) =>
  [].concat(locales ?? []).filter((l) => typeof l === 'string' && LOCALE_RE.test(l));
/** Clamp `start` to a non-negative integer; anything else becomes 0. */
const safeIndex = (n) => (Number.isInteger(n) && n >= 0 ? n : 0);
/** Clamp `rows` to 1..MAX_ROWS; anything else becomes the default page size. */
const safeRows = (n) => (Number.isInteger(n) && n > 0 ? Math.min(n, MAX_ROWS) : DEFAULT_ROWS);

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
export const indexQuery = (countries = [], start = 0, rows = 25, locale = 'en', locales = ['en']) => {
  const ctry = safeCountries(countries);
  const from = safeIndex(start);
  const size = safeRows(rows);
  const loc = safeLocale(locale);
  const locs = safeLocales(locales);
  const fieldLoc = mapLocaleFromDrupal(loc).toUpperCase();
  const governmentQuery = ctry.length ? `AND government_s : (${ctry.join(' ')})` : '';
  return JSON.stringify({
    df: `text_${fieldLoc}_txt`,
    fq: ['_state_s:public', 'realm_ss:ort'],
    q: `(schema_s : (nationalTarget7)${governmentQuery})`,
    sort: `title_${fieldLoc}_s asc`,
    fl: `identifier:uniqueIdentifier_s, name:title_${fieldLoc}_t${extraTitleFields(locs, loc)}`,
    wt: 'json',
    start: from,
    rows: size,
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
  // Sanitize once at the boundary, then thread the safe values through query + normalize (S1).
  const loc = safeLocale(locale);
  const locs = safeLocales(locales ?? [loc]);
  const ctry = safeCountries(countries);
  try {
    const { response } = await ofetch(INDEX_URL, {
      method: 'post',
      body: indexQuery(ctry, start, rows, loc, locs),
      headers: { 'Content-Type': 'application/json' },
      // Bounded like use-taxonomies: without this ofetch creates no abort timer, so a
      // stalled api.cbd.int connection leaves the promise pending forever and the catch
      // below never runs.
      timeout: REQUEST_TIMEOUT_MS,
    });
    return response.docs.map((doc) => normalizeNationalTarget(mapLocaleFromDrupal(loc), locs, doc));
  } catch (error) {
    // Resolve to [] (like getData) so one failure can't reject the shared Promise.all batch (C3).
    console.error('Error fetching national targets:', error);
    return [];
  }
}
