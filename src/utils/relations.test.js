// Regression baseline (CR-2) for the one-way auto-link source in src/utils/relations.js.
// Plain JS + Vitest only — no @nuxt/test-utils, no network.

import { describe, expect, it } from 'vitest';

import { relatedKeys, LINKABLE_DOMAINS } from '@/utils/relations.js';
import { GBF_SAMEAS } from '@/utils/constants.js';

describe('LINKABLE_DOMAINS', () => {
  it('lists exactly the domains a GBF Target selection fills', () => {
    expect(LINKABLE_DOMAINS).toEqual(['sdgs', 'subjects']);
  });
});

describe('relatedKeys', () => {
  it('resolves GBF-TARGET-01 to its full related list from GBF_SAMEAS', () => {
    expect(relatedKeys('GBF-TARGET-01')).toEqual([
      'AICHI-TARGET-05',
      'CBD-SUBJECT-MAR',
      'CBD-SUBJECT-GSPC',
      'CBD-SUBJECT-PA',
      'SUSTAINABLE-DEVELOPMENT-GOAL-14',
      'SUSTAINABLE-DEVELOPMENT-GOAL-15',
    ]);
  });

  it('returns the exact array reference defined in GBF_SAMEAS for a known target', () => {
    expect(relatedKeys('GBF-TARGET-23')).toBe(GBF_SAMEAS['GBF-TARGET-23']);
  });

  it('resolves every defined GBF Target to a non-empty list', () => {
    for (const id of Object.keys(GBF_SAMEAS)) {
      expect(relatedKeys(id).length).toBeGreaterThan(0);
    }
  });

  it.each([
    ['SUSTAINABLE-DEVELOPMENT-GOAL-14'], // an SDG: no inverse back-fill
    ['CBD-SUBJECT-MAR'], // a Subject: no inverse back-fill
    ['AICHI-TARGET-05'], // an Aichi target id that appears only inside related lists
  ])('is one-way: %s resolves to [] (no inverse)', (id) => {
    expect(relatedKeys(id)).toEqual([]);
  });

  it.each([['UNKNOWN-ID'], [''], ['GBF-TARGET-99'], [undefined], [null]])(
    'returns [] for the unknown / nullish id %s',
    (id) => {
      expect(relatedKeys(id)).toEqual([]);
    },
  );

  it.each([['__proto__'], ['constructor'], ['toString'], ['hasOwnProperty'], ['valueOf']])(
    'returns [] for the exotic object-key id %s without throwing (SEC-3 / CWE-1321)',
    (id) => {
      expect(relatedKeys(id)).toEqual([]);
    },
  );
});
