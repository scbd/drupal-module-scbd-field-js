// src/composables/use-taxonomies.test.js
//
// Regression guard for CR-11: the `.filter(Boolean)` calls that used to follow every
// `.map(base)` / `.map(sanitizeBchSubject)` in the domain transforms were DEAD — `base`
// is `omitNil({...})` and `omitNil` returns `Object.fromEntries(...)`, which is ALWAYS a
// truthy object (even `{}` is truthy). So those filters never dropped an element.
//
// These tests feed raw terms that exercise the falsy-prone edges (a term whose `name`
// lstring resolves empty, a term with only an identifier) and assert that getData returns
// the SAME number of elements as the input — proving the removed filter was a no-op.
//
// Fully offline/deterministic: `ofetch` and `useOrgTypeOther` are mocked; no network.

import { afterEach, describe, it, expect, vi } from 'vitest';
import { useOrgTypeOther } from '@/composables/use-org-type-other.js';

import {
  APIS,
  EXCLUDED_ORG_TYPE_IDENTIFIERS,
  DOC_TYPE_IDENTIFIERS,
} from '@/utils/constants.js';

const ofetchMock = vi.fn();
vi.mock('ofetch', () => ({ ofetch: (...args) => ofetchMock(...args) }));

// Avoid loading translation files: return a controlled synthetic "Other" org type.
vi.mock('@/composables/use-org-type-other.js', () => ({
  useOrgTypeOther: vi.fn(async () => ({ identifier: 'ORG-TYPE-OTHER', title: { en: 'Other' } })),
}));

const { useTaxonomies } = await import('@/composables/use-taxonomies.js');

// Map every domain URL to its raw payload so the transform under test runs against it.
const respondWith = (byUrl) => {
  ofetchMock.mockImplementation((url) => {
    const raw = byUrl[url];
    if (!raw) throw new Error(`unexpected fetch: ${url}`);
    return Promise.resolve(raw);
  });
};

// Three terms that span the falsy edges base() must NOT drop:
//   - normal term (resolvable name)
//   - empty-lstring name → localizedName resolves '' → omitNil keeps identifier, drops name key
//   - identifier only → omitNil yields { identifier } (still a truthy object)
const edgeTerms = (prefix) => [
  { identifier: `${prefix}-A`, name: { en: 'Alpha' } },
  { identifier: `${prefix}-B`, name: {} }, // empty lstring → name resolves '' → key omitted
  { identifier: `${prefix}-C` }, // identifier only → omitNil -> { identifier }
];

// No beforeEach mock reset needed: `clearMocks: true` (vitest.config.js) clears call
// history between tests, and every test re-establishes its own `ofetch` implementation
// via respondWith() before use, so there is no shared/default impl to wipe.
describe('useTaxonomies dead-filter removal (CR-11)', () => {
  it('byIdSorted path (sdgs) keeps every element despite falsy-name edges', async () => {
    const raw = edgeTerms('SDG');
    respondWith({ [APIS.sdgs]: raw });

    const out = await useTaxonomies('en').getData('sdgs');

    expect(out).toHaveLength(raw.length); // nothing dropped → filter(Boolean) was dead
    expect(out.every((t) => t && typeof t === 'object')).toBe(true);
    expect(out.map((t) => t.identifier).sort()).toEqual(['SDG-A', 'SDG-B', 'SDG-C']);
  });

  it('byIdSorted path (gbfTargets) keeps every element', async () => {
    const raw = edgeTerms('GBF');
    respondWith({ [APIS.gbfTargets]: raw });

    const out = await useTaxonomies('en').getData('gbfTargets');

    expect(out).toHaveLength(raw.length);
  });

  it('defaultTransform path (countries) keeps every element', async () => {
    const raw = edgeTerms('CTY');
    respondWith({ [APIS.countries]: raw });

    const out = await useTaxonomies('en').getData('countries');

    expect(out).toHaveLength(raw.length);
    expect(out.every((t) => t && typeof t === 'object')).toBe(true);
  });

  it('documentTypes predicate filter still narrows, but base() drops nothing among matches', async () => {
    // Two terms that pass the docType predicate (one with an empty-name edge) plus one that
    // must be filtered OUT by the predicate. Only the predicate removes elements — not the
    // (removed) filter(Boolean) after map(base).
    const kept = [
      { identifier: DOC_TYPE_IDENTIFIERS[0], name: { en: 'Doc One' } },
      { identifier: DOC_TYPE_IDENTIFIERS[1], name: {} }, // empty name edge, still kept by predicate
    ];
    const dropped = [{ identifier: 'NOT-A-DOC-TYPE', name: { en: 'Nope' } }];
    respondWith({ [APIS.documentTypes]: [...kept, ...dropped] });

    const out = await useTaxonomies('en').getData('documentTypes');

    expect(out).toHaveLength(kept.length); // predicate removed the 1 non-doc-type; base() removed nothing
    expect(out.map((t) => t.identifier).sort()).toEqual(
      [DOC_TYPE_IDENTIFIERS[0], DOC_TYPE_IDENTIFIERS[1]].sort(),
    );
  });

  it('orgTypes path keeps every non-excluded term (incl. falsy-name edge) and appends "Other"', async () => {
    const orgTerms = [
      { identifier: 'ORG-NORMAL', name: { en: 'Normal Org' } },
      { identifier: 'ORG-EMPTY', name: {} }, // empty-name edge — must survive
      { identifier: EXCLUDED_ORG_TYPE_IDENTIFIERS[0], name: { en: 'Excluded' } }, // predicate drops this
    ];
    respondWith({ [APIS.orgTypes]: orgTerms });

    const out = await useTaxonomies('en').getData('orgTypes');

    // 3 raw - 1 excluded by predicate + 1 synthetic "Other" = 3; base() dropped none.
    expect(out).toHaveLength(3);
    expect(out.some((t) => t.identifier === 'ORG-TYPE-OTHER')).toBe(true);
    expect(out.some((t) => t.identifier === EXCLUDED_ORG_TYPE_IDENTIFIERS[0])).toBe(false);
    expect(out.some((t) => t.identifier === 'ORG-EMPTY')).toBe(true);
  });

  it('bchSubjects path keeps every element through sanitizeBchSubject + buildChildren', async () => {
    // Parent references a child via narrowerTerms; both carry falsy-name edges. buildChildren
    // is a non-mutating reshape: it swaps the parent's `narrowerTerms` for a resolved `children`
    // array but does NOT remove the child from the top level — so the element count is preserved
    // (proving sanitizeBchSubject + the removed filter(Boolean) dropped nothing).
    const raw = [
      { identifier: 'BCH-PARENT', name: {}, narrowerTerms: ['BCH-CHILD'] },
      { identifier: 'BCH-CHILD', name: { en: 'Child' } },
    ];
    respondWith({ [APIS.bchSubjects]: raw });

    const out = await useTaxonomies('en').getData('bchSubjects');

    expect(out).toHaveLength(raw.length); // nothing dropped
    const parent = out.find((t) => t.identifier === 'BCH-PARENT');
    expect(parent.children).toHaveLength(1);
    expect(parent.children[0].identifier).toBe('BCH-CHILD');
  });
});

describe('useTaxonomies localized behavior', () => {
  afterEach(() => vi.restoreAllMocks());

  it('uses browser French fallback for both taxonomy terms and Other', async () => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('fr-CA');
    // Model the collaborator's requested-locale contract without loading locale assets.
    useOrgTypeOther.mockImplementationOnce(async (locales) => ({
      identifier: 'ORG-TYPE-OTHER',
      title: { en: 'Other', ...(locales.includes('fr') ? { fr: 'Autre' } : {}) },
    }));
    respondWith({
      [APIS.orgTypes]: [{ identifier: 'ORG-NORMAL', name: { en: 'Organization', fr: 'Organisation' } }],
    });

    await expect(useTaxonomies().getData('orgTypes')).resolves.toEqual([
      { identifier: 'ORG-NORMAL', name: 'Organisation' },
      { identifier: 'ORG-TYPE-OTHER', name: 'Autre' },
    ]);
  });
});

describe('useTaxonomies single lookup', () => {
  const first = { identifier: 'CTY-A', name: 'Alpha' };
  const second = { identifier: 'CTY-B', name: 'Beta' };

  it('returns the first record when multiple saved single IDs match', async () => {
    respondWith({ [APIS.countries]: [second, first] });

    await expect(useTaxonomies('en').lookUp('countries', ['CTY-B', 'CTY-A'], true))
      .resolves.toEqual(first);
  });

  it('returns undefined when no saved single ID matches', async () => {
    respondWith({ [APIS.countries]: [second, first] });

    await expect(useTaxonomies('en').lookUp('countries', ['UNKNOWN'], true))
      .resolves.toBeUndefined();
  });

  it('still returns every matching record for a multi lookup', async () => {
    respondWith({ [APIS.countries]: [second, first] });

    await expect(useTaxonomies('en').lookUp('countries', ['CTY-B', 'CTY-A']))
      .resolves.toEqual([first, second]);
  });
});

describe('null-argument hardening from the DEV-1168 round-2 review', () => {
  it('does not throw at setup when locales is null or not an array', () => {
    expect(() => useTaxonomies('en', null)).not.toThrow();
    expect(() => useTaxonomies('en', 'fr')).not.toThrow();
    expect(() => useTaxonomies('en')).not.toThrow();
  });

  it('lookUp resolves instead of rejecting when keys is null or not an array', async () => {
    const { lookUp } = useTaxonomies('en', []);

    await expect(lookUp('sdgs', null)).resolves.toBeDefined();
    await expect(lookUp('sdgs', 'not-an-array')).resolves.toBeDefined();
  });

  it('getData refuses a non-string domain without dispatching a request', async () => {
    const { getData } = useTaxonomies('en', []);

    await expect(getData({ toString: () => 'subjects' })).resolves.toEqual([]);
    await expect(getData(null)).resolves.toEqual([]);
  });
});
