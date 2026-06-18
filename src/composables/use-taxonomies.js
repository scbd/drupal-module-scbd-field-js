// src/composables/useTaxonomies.js
//
// In-module replacement for @scbd/cached-apis, exposed as a composable. No caching, no
// sourceMap, no reverse lookup, no extra deps — ofetch is already bundled.
//
// LOCALE: term names are localized to the `locale` passed to useTaxonomies (the widget's
// `locale` prop), defaulting to the browser language, then 'en'. The synthetic "Other" org
// type is localized too — its title is generated from the locale translation files via
// useOrgTypeOther for the `locale` + `locales` passed in.

import { ofetch } from 'ofetch';

import {
  DOC_TYPE_IDENTIFIERS as docTypeIdentifiers,
  EXCLUDED_ORG_TYPE_IDENTIFIERS as excludedOrgTypes,
  APIS,
} from '@/utils/constants.js';
import { omitNil, byName, byIdentifier, localizedName, migrateSdgKey, buildChildren } from '@/utils/index.js';
import { useOrgTypeOther } from '@/composables/use-org-type-other.js';

/**
 * @typedef {object} Term A trimmed option — the widget only reads these keys.
 * @property {string} identifier
 * @property {string} name
 * @property {Term[]} [children]
 * @property {string[]} [narrowerTerms]
 */

// timeout only — provider's axios `retry` key was inert; add none (D8).
const fetchDomain = (url) => ofetch(url, { timeout: 20000 });

/**
 * Resolve the display locale to a thesaurus language prefix: explicit arg →
 * browser language → 'en' (e.g. 'en-US' / 'zh-hans' → 'en' / 'zh').
 * @param {string} [locale]
 * @returns {string}
 */
const resolveLocale = (locale) =>
  (locale || (typeof navigator !== 'undefined' && navigator.language) || 'en').split('-')[0];

/**
 * Taxonomy data access for the CHM field widget. Call once in `setup`.
 * @param {string} [locale] BCP-47 language (or prefix) for term names.
 * @param {string[]} [locales] additional locales to localize the synthetic "Other" org type into.
 * @returns {{
 *   getData: (domain: string) => Promise<Term[]>,
 *   lookUp: (source: string, keys?: string[], single?: boolean) => Promise<Term | Term[] | undefined>,
 * }}
 */
export function useTaxonomies(locale, locales = []) {
  const lang = resolveLocale(locale);
  const orgTypeOtherPromise = useOrgTypeOther([locale, ...locales]); // localized "Other" appended to orgTypes (loads on demand)

  /** Trim a raw thesaurus term to the keys the widget reads. */
  const base = (item) => omitNil({ identifier: item.identifier, name: localizedName(item, lang) });

  /** Keep bchSubjects' `narrowerTerms` id list for buildChildren to resolve into `children`. */
  const sanitizeBchSubject = (item) => {
    const out = base(item);
    if (item.narrowerTerms?.length) out.narrowerTerms = item.narrowerTerms;
    return out;
  };

  // Per-domain shaping of the raw API array. Domains not listed use `defaultTransform`.
  // sdgs/gbfTargets sort by identifier (stable provider order, robust to the D5 name change, B1);
  // everything else sorts by localized name. GBF<->SDG<->Subject relations now live in
  // utils/relations.js (built from GBF_SAMEAS), so terms are no longer decorated with `sameAs`.
  const byIdSorted = (raw) => raw.map(base).filter(Boolean).sort(byIdentifier);
  const transforms = {
    sdgs:          byIdSorted,
    gbfTargets:    byIdSorted,
    bchSubjects:   (raw) => buildChildren(raw.map(sanitizeBchSubject).filter(Boolean).sort(byName)),
    orgTypes:      (raw, orgTypeOther) => raw.filter((it) => !excludedOrgTypes.includes(it.identifier)).map(base).filter(Boolean).sort(byName).concat(base(orgTypeOther)), // append sanitized "Other"
    govTypes:      (raw) => raw.filter((it) => excludedOrgTypes.includes(it.identifier)).map(base).filter(Boolean).sort(byName), // inverse of the orgTypes split (same URL)
    documentTypes: (raw) => raw.filter((it) => docTypeIdentifiers.includes(it.identifier)).map(base).filter(Boolean).sort(byName),
  };
  const defaultTransform = (raw) => raw.map(base).filter(Boolean).sort(byName);

  /**
   * Fetch and normalize one taxonomy domain. Always resolves to an array
   * (empty on unknown domain or fetch error).
   * @param {string} domain
   * @returns {Promise<Term[]>}
   */
  async function getData(domain) {
    try {
      if (domain === 'bchSubjectGroups') // derived subset: bchSubjects that have children
        return (await getData('bchSubjects')).filter((s) => s.children?.length);

      const url = APIS[domain];
      if (!url) return []; // unknown-domain guard — never ofetch(undefined)

      const raw = await fetchDomain(url);
      if (domain === 'orgTypes') return transforms.orgTypes(raw, await orgTypeOtherPromise); // needs the localized "Other"
      return (transforms[domain] || defaultTransform)(raw);
    } catch (e) {
      console.error(`useTaxonomies.getData(${domain}):`, e);
      return []; // always an array on error
    }
  }

  /**
   * Resolve saved keys to full term objects within `source`. Keys are always string[]
   * (consumer passes keysString.split(',')), matched exactly against string identifiers (M3);
   * legacy SDG keys are migrated first.
   * @param {string} source domain name
   * @param {string[]} [keys] record identifiers
   * @param {boolean} [single] return one object instead of an array
   * @returns {Promise<Term | Term[] | undefined>} `[]` (or `undefined` when single) if nothing matches (D9)
   */
  async function lookUp(source, keys = [], single = false) {
    const records = await getData(source);

    const wanted = keys.map(migrateSdgKey); // upgrade legacy SDG-GOAL-* keys
    const matched = records.filter((t) => wanted.includes(t.identifier));

    if (single && matched.length === 1) return matched[0];
    if (matched.length) return matched;
    return single ? undefined : [];
  }

  return { getData, lookUp };
}
