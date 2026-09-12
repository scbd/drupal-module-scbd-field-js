export const omitNil = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v != null));
const isLstring = (v) => v && typeof v === 'object' && !!v.en;
export const byName = (a, b) => (a.name || '').localeCompare(b.name || '');
export const byIdentifier = (a, b) => (a.identifier || '').localeCompare(b.identifier || '');


/**
 * Resolve an lstring (`{ en, fr, ... }`) to a single locale, falling back to English.
 * @param {Record<string, string>|string|undefined} prop
 * @param {string} locale
 * @returns {string|undefined} the localized string, or `undefined` if `prop` is not an lstring
 */
function lstr(prop, locale) {
  if (!prop || typeof prop === 'string' || !isLstring(prop)) return undefined;
  // Object.hasOwn on the locale key: a bare prop[locale] with locale === 'constructor'
  // returns a function, which is truthy, so it short-circuits past prop.en and escapes
  // the never-return-a-non-string contract (B8). byName() then calls .localeCompare on
  // it and throws, and getData()'s catch silently empties the whole domain.
  const hit = Object.hasOwn(prop, locale) ? prop[locale] : undefined;
  const value = hit || prop.en;
  return typeof value === 'string' ? value : undefined;
}

/**
 * Display name for an SCBD thesaurus term: prefer `shortTitle`, fall back to `title`
 * (both per-locale lstrings), then the plain `name` string the API returns. `lstr`
 * yields `undefined` for an empty `{}` shortTitle, so those fall through to title.
 * @param {object} item thesaurus term
 * @param {string} locale display locale
 * @returns {string} always a string — empty when no usable name is present (B8)
 */
export const localizedName = (item, locale) =>
  lstr(item.shortTitle, locale) || lstr(item.title, locale) || lstr(item.name, locale)
    || (typeof item.name === 'string' ? item.name : ''); // never return a non-string (malformed lstring `name`) → no [object Object] (B8)

// Legacy SDG keys (SDG-GOAL-01 ... SDG-GOAL-17) predate the SUSTAINABLE-DEVELOPMENT-GOALS thesaurus,
// whose identifiers are SUSTAINABLE-DEVELOPMENT-GOAL-01 ... -17. Upgrade any legacy key read from a
// saved value to the current identifier so the option still resolves (and is rewritten to the new
// key on the next save). Non-SDG keys pass through untouched.
const SDG_LEGACY_RE = /^SDG-GOAL-0*(\d{1,2})$/;
export const migrateSdgKey = (key) => {
  const m = typeof key === 'string' ? key.match(SDG_LEGACY_RE) : null;
  return m ? `SUSTAINABLE-DEVELOPMENT-GOAL-${m[1].padStart(2, '0')}` : key;
};

// Resolve a flat list of items that carry a `childrenKey` array of sibling identifiers into a
// nested tree. Each item with children is replaced by a copy whose `childrenKey` is swapped for a
// `children` array of resolved objects sorted by name; items without children pass through unchanged.
// Non-mutating: the source items are never altered (R5).
export function buildChildren(data, { idKey = 'identifier', childrenKey = 'narrowerTerms' } = {}) {
  const map = new Map(data.map((it) => [it[idKey], it]));
  return data.map((item) => {
    if (!item[childrenKey]?.length) return item; // no children: pass through untouched
    const { [childrenKey]: childIds, ...rest } = item;
    return { ...rest, children: childIds.map((id) => map.get(id)).filter(Boolean).sort(byName) };
  });
}
