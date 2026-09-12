// "National Targets 7" come from the api.cbd.int Solr index; fetch + query-building lives here. Docs normalize to { identifier, name }.

import { ofetch } from 'ofetch';

const INDEX_URL = 'https://api.cbd.int/api/v2013/index/select';

// Solr-injection guards: only clean ISO/locale codes are interpolated. Applied at the boundary and re-asserted inside indexQuery (defense-in-depth).
const COUNTRY_RE = /^[a-z]{2}$/i;
const LOCALE_RE = /^[a-z]{2,3}(-[a-z]{2,8})?$/i;
/** Page-size guards: an unbounded `rows` lets one caller ask the index for everything. */
const DEFAULT_ROWS = 25;
const MAX_ROWS = 1000;
const MAX_START = 100000;
/** Cap the projection list: one caller passing 100k locales built a 1.2 MB `fl`. */
const MAX_LOCALES = 20;
/** Matches the bound use-taxonomies already applies to its own fetches. */
const REQUEST_TIMEOUT_MS = 20000;

/** Drop any country token that is not a clean ISO-3166-1 alpha-2 code. */
const safeCountries = (countries = []) =>
  [].concat(countries ?? []).filter((c) => typeof c === 'string' && COUNTRY_RE.test(c));
/** Drop any locale token that carries Solr metacharacters or is otherwise malformed. Deduped and capped to MAX_LOCALES. */
const safeLocales = (locales = []) => [
  ...new Set([].concat(locales ?? []).filter((l) => typeof l === 'string' && LOCALE_RE.test(l))),
].slice(0, MAX_LOCALES);
/** Clamp `start` to a non-negative integer; anything else becomes 0. */
const safeIndex = (n) => (Number.isInteger(n) && n >= 0 ? n : 0);
/** Clamp `rows` to 1..MAX_ROWS; anything else becomes the default page size. */
const safeRows = (n) => (Number.isInteger(n) && n > 0 ? Math.min(n, MAX_ROWS) : DEFAULT_ROWS);
/** Cap deep paging. */
const safeIndexCapped = (n) => Math.min(safeIndex(n), MAX_START);

/** Fall back to 'en' for a malformed primary locale. typeof blocks objects with a custom toUpperCase() that injected extra fields into fl/sort. */
const safeLocale = (locale) =>
  (typeof locale === 'string' && LOCALE_RE.test(locale) ? locale : 'en');

/** Map Drupal locale codes to the index's `title_<LANG>_t` field language. */
const mapLocaleFromDrupal = (locale) =>
  locale === 'zh-hans' ? 'zh' : locale === 'fil' ? 'tl' : locale;

/** Extra `title_<LANG>_t` fields to request as name fallbacks for the non-primary locales. */
const extraTitleFields = (locales = [], locale) =>
  locales.length === 1 && locales[0] === locale
    ? ''
    : locales.filter((l) => l !== locale).map((l) => `, title_${mapLocaleFromDrupal(l).toUpperCase()}_t`).join('');

/** Build the Solr index/select request body. Sort on the `_s` string twin, never the `_t` text field. */
export const indexQuery = (countries = [], start = 0, rows = 25, locale = 'en', locales = ['en']) => {
  const ctry = safeCountries(countries);
  const from = safeIndexCapped(start);
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
export async function getNationalTargets7(ctx) {
  // Normalize the whole argument first: destructuring a null/primitive ctx threw a TypeError above the try, breaking the resolve-to-[] contract.
  const { countries = [], start = 0, rows = 25, locale, locales } =
    (ctx && typeof ctx === 'object' ? ctx : {});
  // Sanitize once at the boundary, then thread safe values through query + normalize.
  const loc = safeLocale(locale);
  const locs = safeLocales(locales ?? [loc]);
  const ctry = safeCountries(countries);
  try {
    const { response } = await ofetch(INDEX_URL, {
      method: 'post',
      body: indexQuery(ctry, start, rows, loc, locs),
      headers: { 'Content-Type': 'application/json' },
      // Bounded like use-taxonomies: without this ofetch creates no abort timer, so a stalled connection leaves the promise pending forever and the catch below never runs.
      timeout: REQUEST_TIMEOUT_MS,
    });
    return response.docs.map((doc) => normalizeNationalTarget(mapLocaleFromDrupal(loc), locs, doc));
  } catch (error) {
    // Resolve to [] (like getData) so one failure cannot reject the shared Promise.all batch.
    console.error('Error fetching national targets:', error);
    return [];
  }
}
