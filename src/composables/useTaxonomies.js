// src/composables/useTaxonomies.js
//
// In-module replacement for @scbd/cached-apis. Exposes the three functions the widget imports
// (initializeApiStore, getData, lookUp). No caching, no sourceMap, no reverse lookup, no extra
// deps — ofetch is already bundled.
//
// LOCALE NOTE: term.name for API-fetched domains is localized via the `Preferences` cookie in
// getLocale(), NOT the component's `locale` prop (the prop only drives the t() label map in
// ../i18n). Do not "fix" this — it preserves provider behavior. The bundled datasets
// (ecosystem-types, gbf-sameas, org-type-other) are English-only by design; a
// cookie-less non-English page therefore renders English option names for API domains. To
// harden, port the full getUnLocale chain inline (html lang → <meta content-language> →
// navigator.languages → Intl, matched to ['ar','en','es','fr','ru','zh']) — do NOT re-add
// @houlagins/locale. (Approach #1 keeps the cookie + 'en' fallback; flag any hardening in the PR.)

import { ofetch } from 'ofetch';

import ecosystemTypesData  from '../../i18n/locales/en/ecosystem-types.json';
import orgTypeOther        from '../../i18n/locales/en/org-type-other.json';
import docTypeIdentifiers  from '../../i18n/locales/doc-type-identifiers.json';
import excludedOrgTypes    from '../../i18n/locales/excluded-org-types.json';
import gbfSameAs           from '../../i18n/locales/gbf-sameas.json';

// --- integrity assertions (fail loud on data drift; see finding F3) ---
if (ecosystemTypesData.length !== 40) console.error(`useTaxonomies: ecosystem-types.json expected 40, got ${ecosystemTypesData.length}`);
if (docTypeIdentifiers.length !== 45) console.error(`useTaxonomies: doc-type-identifiers.json expected 45, got ${docTypeIdentifiers.length}`);
if (excludedOrgTypes.length !== 4)    console.error(`useTaxonomies: excluded-org-types.json expected 4, got ${excludedOrgTypes.length}`);
if (Object.keys(gbfSameAs).length !== 23) console.error(`useTaxonomies: gbf-sameas.json expected 23, got ${Object.keys(gbfSameAs).length}`);

// --- API URL map (verbatim from provider config.mjs apisUrls; only the consumed domains) ---
const APIS = {
  regions        : 'https://api.cbd.int/api/v2013/thesaurus/domains/regions/terms',
  countries      : 'https://api.cbd.int/api/v2013/thesaurus/domains/countries/terms',
  orgTypes       : 'https://api.cbd.int/api/v2013/thesaurus/domains/Organization%20Types/terms',
  govTypes       : 'https://api.cbd.int/api/v2013/thesaurus/domains/Organization%20Types/terms',
  subjects       : 'https://api.cbd.int/api/v2013/thesaurus/domains/CBD-SUBJECTS/terms',
  jurisdictions  : 'https://api.cbd.int/api/v2013/thesaurus/domains/50AC1489-92B8-4D99-965A-AAE97A80F38E/terms',
  geoScopes      : 'https://api.cbd.int/api/v2013/thesaurus/domains/4D4413D8-36F9-4CD2-8CC1-4F3C866DDE5A/terms',
  projectStatuses: 'https://api.cbd.int/api/v2013/thesaurus/domains/4E7731C7-791E-46E9-A579-7272AF261FED/terms',
  documentTypes  : 'https://api.cbd.int/api/v2013/thesaurus/domains/A762DF7E-B8D1-40D6-9DAC-D25E48C65528/terms',
  sdgs           : 'https://api.cbd.int/api/v2013/thesaurus/domains/SUSTAINABLE-DEVELOPMENT-GOALS/terms',
  gbfTargets     : 'https://api.cbd.int/api/v2013/thesaurus/domains/GBF-TARGETS/terms',
  eventStatuses  : 'https://api.cbd.int/api/v2013/thesaurus/domains/NCHM-EVENT-STATUS/terms',
  bchSubjects    : 'https://api.cbd.int/api/v2013/thesaurus/domains/043C7F0D-2226-4E54-A56F-EE0B74CCC984/terms',
};

// 'all' union leaf domains — mirrors provider generateAll minus dropped domains, plus
// ecosystemTypes; bchSubjectGroups excluded (it is a subset of bchSubjects).
const ALL_DOMAINS = [
  'orgTypes', 'govTypes', 'sdgs', 'jurisdictions', 'subjects', 'countries', 'regions',
  'gbfTargets', 'geoScopes', 'projectStatuses', 'documentTypes', 'ecosystemTypes',
  'eventStatuses', 'bchSubjects',
];

// --- ported helpers (trimmed) ---
const omitNil   = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v != null));
const isLstring = (v) => v && typeof v === 'object' && !!v.en;
const byName        = (a, b) => (a.name || '').localeCompare(b.name || '');       // null-safe (required fix)
const byIdentifier  = (a, b) => (a.identifier || '').localeCompare(b.identifier || '');

// scbdCMSLocale() port: read the Preferences cookie, strip 'Locale='. Fallback 'en'.
function getLocale() {
  if (typeof window === 'undefined') return 'en';
  const pref = window.document.cookie.replace(/(?:(?:^|.*;\s*)Preferences\s*=\s*([^;]*).*$)|^.*$/, '$1');
  return (pref && pref.replace('Locale=', '')) || 'en';
}

function lstr(prop) {
  if (!prop || typeof prop === 'string' || !isLstring(prop)) return undefined;
  return prop[getLocale()] || prop.en;
}

// Display name for every SCBD thesaurus term: prefer `shortTitle`, fall back to `title`
// (both per-locale lstrings resolved via the cookie), then the plain `name` string the API
// returns. `lstr` yields undefined for an empty `{}` shortTitle, so those fall through to title.
const localizedName = (item) => lstr(item.shortTitle) || lstr(item.title) || lstr(item.name) || item.name;

// trimmed base shape — the consumer only reads identifier, name, children, sameAs.
const base = (item) => omitNil({ identifier: item.identifier, name: localizedName(item) });

// Legacy SDG keys (SDG-GOAL-01 … SDG-GOAL-17) predate the SUSTAINABLE-DEVELOPMENT-GOALS thesaurus,
// whose identifiers are SUSTAINABLE-DEVELOPMENT-GOAL-01 … -17. Upgrade any legacy key read from a
// saved value to the current identifier so the option still resolves (and is rewritten to the new
// key on the next save). Non-SDG keys pass through untouched.
const SDG_LEGACY_RE = /^SDG-GOAL-0*(\d{1,2})$/;
const migrateSdgKey = (key) => {
  const m = typeof key === 'string' ? key.match(SDG_LEGACY_RE) : null;
  return m ? `SUSTAINABLE-DEVELOPMENT-GOAL-${m[1].padStart(2, '0')}` : key;
};

// buildChildren port: children[] from narrowerTerms, sorted by name; drop narrowerTerms.
// Generic over any term with identifier/narrowerTerms (bchSubjects, regions).
function buildChildren(data) {
  const map = new Map(data.map((it) => [it.identifier, it]));
  data.forEach((s) => {
    if (s.narrowerTerms && s.narrowerTerms.length) {
      s.children = s.narrowerTerms.map((id) => map.get(id)).filter(Boolean).sort(byName);
      delete s.narrowerTerms;
    }
  });
  return data;
}

// Generic sanitizer that preserves narrowerTerms so buildChildren can group (bchSubjects, regions).
function sanitizeWithChildren(item) {
  const out = base(item);
  if (item.narrowerTerms && item.narrowerTerms.length) out.narrowerTerms = item.narrowerTerms;
  return out;
}

const fetchDomain = (url) => ofetch(url, { timeout: 20000 }); // timeout only — provider's axios `retry` key was inert; add none (D8)

export const initializeApiStore = () => {}; // no-op; provider's only job was localForage.config()

export async function getData(domain) {
  try {
    // --- local datasets (no network) ---
    if (domain === 'ecosystemTypes')
      return ecosystemTypesData.map(base).sort(byName); // base() resolves name from the {en} lstring (en-only data)

    if (domain === 'bchSubjectGroups') {
      const subjects = await getData('bchSubjects');
      return subjects.filter((s) => s.children && s.children.length);
    }

    // --- fetched datasets ---
    if (domain === 'sdgs') {
      const raw = await fetchDomain(APIS.sdgs);
      return raw.map(base).filter(Boolean).sort(byIdentifier); // SUSTAINABLE-DEVELOPMENT-GOAL-01..-17; sort by identifier (not name)
    }

    if (domain === 'gbfTargets') {
      const raw = await fetchDomain(APIS.gbfTargets);
      return raw
        .map((it) => {
          if (!(it.identifier in gbfSameAs)) // M1 guard: silent SDG-break if API/map drift
            console.error(`useTaxonomies: gbfTargets ${it.identifier} absent from gbf-sameas.json — SDG auto-link disabled for it`);
          return omitNil({ ...base(it), sameAs: gbfSameAs[it.identifier] }); // D4 merge: name from API, sameAs from local map
        })
        .filter(Boolean)
        .sort(byIdentifier); // sort by identifier → preserves provider order (GBF-TARGET-01..23); robust to the D5 name change (B1)
    }

    if (domain === 'bchSubjects') {
      const raw = await fetchDomain(APIS.bchSubjects);
      const data = raw.map(sanitizeWithChildren).filter(Boolean).sort(byName);
      return buildChildren(data);
    }

    // regionsGroups: regions thesaurus built into parent/child groups (like bchSubjectGroups);
    // self-fetches + filters to parents-with-children — flat getData('regions') stays untouched.
    if (domain === 'regionsGroups') {
      const raw = await fetchDomain(APIS.regions);
      const data = buildChildren(raw.map(sanitizeWithChildren).filter(Boolean).sort(byName));
      return data.filter((r) => r.children && r.children.length); // only parents that have children
    }

    if (domain === 'orgTypes') {
      const raw = await fetchDomain(APIS.orgTypes);
      const data = raw.filter((it) => !excludedOrgTypes.includes(it.identifier)).map(base).filter(Boolean).sort(byName);
      data.push(base(orgTypeOther)); // append sanitized "Other"
      return data;
    }

    if (domain === 'govTypes') {
      const raw = await fetchDomain(APIS.govTypes); // same URL as orgTypes
      return raw.filter((it) => excludedOrgTypes.includes(it.identifier)).map(base).filter(Boolean).sort(byName); // inverse split
    }

    if (domain === 'documentTypes') {
      const raw = await fetchDomain(APIS.documentTypes);
      return raw.filter((it) => docTypeIdentifiers.includes(it.identifier)).map(base).filter(Boolean).sort(byName);
    }

    if (!APIS[domain]) return []; // unknown-domain guard — never ofetch(undefined)

    const raw = await fetchDomain(APIS[domain]); // subjects, countries, regions, geoScopes, projectStatuses, jurisdictions, eventStatuses
    return raw.map(base).filter(Boolean).sort(byName);
  } catch (e) {
    console.error(`useTaxonomies.getData(${domain}):`, e);
    return []; // always an array on error
  }
}

export async function lookUp(source, keys = [], single = false) {
  // keys is always string[] (consumer passes keysString.split(',')) — provider's object/array
  // flattenKeys branches are dead here and intentionally dropped. Record identifiers are strings
  // for every consumed domain, so a plain keys.includes(identifier) match is exact (M3).
  let records;
  if (source === 'all') {
    const all = await Promise.all(ALL_DOMAINS.map((d) => getData(d)));
    records = all.flat(); // flat concat — lookUp ignores the provider's {filter,data} labels
  } else {
    records = await getData(source);
  }

  const wantedKeys = keys.map(migrateSdgKey); // upgrade legacy SDG-GOAL-* keys to current thesaurus identifiers
  const matched = records.filter((t) => wantedKeys.includes(t.identifier));

  if (matched.length === 1 && single) return matched[0];
  if (matched.length) return matched;
  // D9: [] (not the provider's undefined) — only observable at index.vue:189 (single-field 'all'
  // assigned with no fallback), where undefined throws in getAllKeys(); a deliberate crash-fix.
  // For non-'all' single=false paths the consumer's `|| []` makes [] and undefined identical.
  return single ? undefined : [];
}
