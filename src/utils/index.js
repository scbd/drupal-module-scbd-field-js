export const omitNil = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v != null));
export const isLstring = (v) => v && typeof v === 'object' && !!v.en;
export const byName = (a, b) => (a.name || '').localeCompare(b.name || '');
export const byIdentifier = (a, b) => (a.identifier || '').localeCompare(b.identifier || '');


/**
 * Resolve an lstring (`{ en, fr, ... }`) to a single locale, falling back to English.
 * @param {Record<string, string>|string|undefined} prop
 * @param {string} locale
 * @returns {string|undefined} the localized string, or `undefined` if `prop` is not an lstring
 */
export function lstr(prop, locale) {
  if (!prop || typeof prop === 'string' || !isLstring(prop)) return undefined;
  return prop[locale] || prop.en;
}

/**
 * Display name for an SCBD thesaurus term: prefer `shortTitle`, fall back to `title`
 * (both per-locale lstrings), then the plain `name` string the API returns. `lstr`
 * yields `undefined` for an empty `{}` shortTitle, so those fall through to title.
 * @param {object} item thesaurus term
 * @param {string} locale display locale
 * @returns {string|undefined}
 */
export const localizedName = (item, locale) =>
  lstr(item.shortTitle, locale) || lstr(item.title, locale) || lstr(item.name, locale) || item.name;

// Legacy SDG keys (SDG-GOAL-01 ... SDG-GOAL-17) predate the SUSTAINABLE-DEVELOPMENT-GOALS thesaurus,
// whose identifiers are SUSTAINABLE-DEVELOPMENT-GOAL-01 ... -17. Upgrade any legacy key read from a
// saved value to the current identifier so the option still resolves (and is rewritten to the new
// key on the next save). Non-SDG keys pass through untouched.
export const SDG_LEGACY_RE = /^SDG-GOAL-0*(\d{1,2})$/;
export const migrateSdgKey = (key) => {
  const m = typeof key === 'string' ? key.match(SDG_LEGACY_RE) : null;
  return m ? `SUSTAINABLE-DEVELOPMENT-GOAL-${m[1].padStart(2, '0')}` : key;
};

// Resolve a flat list of items that carry a `childrenKey` array of sibling identifiers into a
// nested tree. The `childrenKey` array is replaced with a `children` array of resolved objects
// sorted by name; the raw key is deleted. Items whose `childrenKey` is absent or empty are left flat.
export function buildChildren(data, { idKey = 'identifier', childrenKey = 'narrowerTerms' } = {}) {
  const map = new Map(data.map((it) => [it[idKey], it]));
  data.forEach((s) => {
    if (s[childrenKey] && s[childrenKey].length) {
      s.children = s[childrenKey].map((id) => map.get(id)).filter(Boolean).sort(byName);
      delete s[childrenKey];
    }
  });
  return data;
}
