// Regression baseline (CR-2) for src/utils/national-targets.js. Asserts the ACTUAL behavior on
// `latest` via the public getNationalTargets7, observing the query through the captured ofetch
// POST body, plus direct indexQuery cases for the guards. Plain JS + Vitest only — no network.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Capture the ofetch call so we can inspect the request body the SUT builds.
const ofetchMock = vi.fn();
vi.mock('ofetch', () => ({ ofetch: (...args) => ofetchMock(...args) }));

const { getNationalTargets7, indexQuery } = await import('@/utils/national-targets.js');

const INDEX_URL = 'https://api.cbd.int/api/v2013/index/select';

/** Resolve ofetch with a Solr-shaped envelope carrying the given docs. */
const respondWith = (docs = []) => ofetchMock.mockResolvedValue({ response: { docs } });

/** The JSON body of the single ofetch POST captured this test. */
const sentBody = () => JSON.parse(ofetchMock.mock.calls[0][1].body);

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  ofetchMock.mockReset();
});

describe('getNationalTargets7 — request construction', () => {
  it('POSTs JSON to the index/select endpoint', async () => {
    respondWith([]);

    await getNationalTargets7({ locale: 'en', locales: ['en'] });

    const [url, opts] = ofetchMock.mock.calls[0];
    expect(url).toBe(INDEX_URL);
    expect(opts.method).toBe('post');
    expect(opts.headers['Content-Type']).toBe('application/json');
  });

  it('builds the field selection for a single locale with a country filter', async () => {
    respondWith([]);

    await getNationalTargets7({ countries: ['be'], locale: 'fr', locales: ['fr'] });
    const body = sentBody();

    expect(body.df).toBe('text_FR_txt');
    expect(body.sort).toBe('title_FR_s asc');
    expect(body.q).toBe('(schema_s : (nationalTarget7)AND government_s : (be))');
    expect(body.fl).toBe('identifier:uniqueIdentifier_s, name:title_FR_t');
    expect(body.fq).toEqual(['_state_s:public', 'realm_ss:ort']);
    expect(body.wt).toBe('json');
  });

  it('omits the government clause when no countries are given', async () => {
    respondWith([]);

    await getNationalTargets7({ countries: [], locale: 'en', locales: ['en'] });

    expect(sentBody().q).toBe('(schema_s : (nationalTarget7))');
  });

  it('space-joins multiple countries inside the government clause', async () => {
    respondWith([]);

    await getNationalTargets7({ countries: ['be', 'gt'], locale: 'en', locales: ['en'] });

    expect(sentBody().q).toBe('(schema_s : (nationalTarget7)AND government_s : (be gt))');
  });

  it('requests alternate-locale title_<LANG>_t fallback fields for the non-primary locales', async () => {
    respondWith([]);

    await getNationalTargets7({ locale: 'en', locales: ['en', 'fr', 'nl'] });

    expect(sentBody().fl).toBe(
      'identifier:uniqueIdentifier_s, name:title_EN_t, title_FR_t, title_NL_t',
    );
  });

  it('threads start / rows through to the Solr body', async () => {
    respondWith([]);

    await getNationalTargets7({ start: 50, rows: 10, locale: 'en', locales: ['en'] });
    const body = sentBody();

    expect(body.start).toBe(50);
    expect(body.rows).toBe(10);
  });
});

describe('getNationalTargets7 — Drupal locale mapping', () => {
  it('maps zh-hans -> zh in every field, including df and sort', async () => {
    respondWith([]);

    await getNationalTargets7({ locale: 'zh-hans', locales: ['zh-hans'] });
    const body = sentBody();

    // This previously asserted df/sort kept the RAW token (text_ZH-HANS_txt,
    // title_ZH-HANS_s), which locked in a bug: those dynamic fields do not exist,
    // so Solr answered 200 and silently sorted on an always-empty field. The two
    // locales mapLocaleFromDrupal exists for -- zh-hans and fil -- were the only
    // ones affected, and they got arbitrary ordering. The mapping now applies to
    // fl, df and sort alike.
    expect(body.fl).toBe('identifier:uniqueIdentifier_s, name:title_ZH_t');
    expect(body.df).toBe('text_ZH_txt');
    expect(body.sort).toBe('title_ZH_s asc');
  });

  it('maps fil -> tl in an alternate-locale fallback field', async () => {
    respondWith([]);

    await getNationalTargets7({ locale: 'en', locales: ['en', 'fil'] });

    expect(sentBody().fl).toBe('identifier:uniqueIdentifier_s, name:title_EN_t, title_TL_t');
  });
});

describe('getNationalTargets7 — boundary sanitization (current behavior on latest)', () => {
  it('falls back to en for a Solr-injection locale', async () => {
    respondWith([]);

    await getNationalTargets7({ locale: 'EN) OR (1=1', locales: ['EN) OR (1=1'] });
    const body = sentBody();

    expect(body.df).toBe('text_EN_txt');
    expect(body.sort).toBe('title_EN_s asc');
    expect(body.fl).toBe('identifier:uniqueIdentifier_s, name:title_EN_t');
  });

  it('falls back to en for a newline-injection locale', async () => {
    respondWith([]);

    await getNationalTargets7({ locale: 'en\nOR x:y', locales: ['en\nOR x:y'] });

    expect(sentBody().df).toBe('text_EN_txt');
  });

  it('drops a malicious country token from the government clause', async () => {
    respondWith([]);

    await getNationalTargets7({ countries: ['be', 'be) OR (1=1'], locale: 'en', locales: ['en'] });

    expect(sentBody().q).toBe('(schema_s : (nationalTarget7)AND government_s : (be))');
  });

  it('drops all countries when every token is malformed (no government clause)', async () => {
    respondWith([]);

    await getNationalTargets7({ countries: ['x*', '(', 'toolong'], locale: 'en', locales: ['en'] });

    expect(sentBody().q).toBe('(schema_s : (nationalTarget7))');
  });
});

describe('getNationalTargets7 — document normalization', () => {
  it('returns docs unchanged when name is already present', async () => {
    respondWith([{ identifier: 'nt-1', name: 'Target One' }]);

    const out = await getNationalTargets7({ locale: 'en', locales: ['en', 'fr'] });

    expect(out).toEqual([{ identifier: 'nt-1', name: 'Target One' }]);
  });

  it('backfills an empty name from the first available alternate-locale title', async () => {
    respondWith([{ identifier: 'nt-2', name: '', title_FR_t: 'Cible FR', title_NL_t: 'Doel NL' }]);

    const out = await getNationalTargets7({ locale: 'en', locales: ['en', 'fr', 'nl'] });

    expect(out[0].name).toBe('Cible FR'); // first alternate that resolves
  });

  it('maps fil -> tl when reading the alternate-locale fallback title', async () => {
    respondWith([{ identifier: 'nt-3', name: '', title_TL_t: 'Tagalog Title' }]);

    const out = await getNationalTargets7({ locale: 'en', locales: ['en', 'fil'] });

    expect(out[0].name).toBe('Tagalog Title');
  });

  it('leaves an empty name as-is when no alternate-locale title resolves', async () => {
    respondWith([{ identifier: 'nt-4', name: '' }]);

    const out = await getNationalTargets7({ locale: 'en', locales: ['en', 'fr'] });

    expect(out[0]).toEqual({ identifier: 'nt-4', name: '' });
  });
});

describe('getNationalTargets7 — error path', () => {
  it('resolves to [] when ofetch rejects', async () => {
    ofetchMock.mockRejectedValue(new Error('boom'));

    await expect(getNationalTargets7({ locale: 'en', locales: ['en'] })).resolves.toEqual([]);
  });
});

describe('indexQuery — hardening from the DEV-1167 pre-PR security review', () => {
  it('drops a country whose toString() changes between the whitelist test and the join', () => {
    // RE.test(c) coerces once and join(' ') coerces again, so a non-deterministic
    // toString() used to pass the whitelist and land raw in `q`.
    let calls = 0;
    const gadget = { toString: () => (calls++ ? 'ab) OR (*:*' : 'ab') };
    const body = JSON.parse(indexQuery([gadget], 0, 25, 'en', ['en']));

    expect(body.q).toBe('(schema_s : (nationalTarget7))');
    expect(body.q).not.toContain('OR');
  });

  it('accepts a non-array countries/locales argument instead of throwing', () => {
    // These sanitizers run above the try block in getNationalTargets7, so a
    // TypeError here escaped the documented resolve-to-[] contract.
    expect(() => indexQuery('be', 0, 25, 'en', 'en')).not.toThrow();
    expect(() => indexQuery(null, 0, 25, 'en', null)).not.toThrow();
    expect(JSON.parse(indexQuery('be', 0, 25, 'en', ['en'])).q).toContain('government_s : (be)');
  });

  it('clamps start and rows', () => {
    const body = JSON.parse(indexQuery(['be'], '0 OR 1', 999999999, 'en', ['en']));

    expect(body.start).toBe(0);
    expect(body.rows).toBe(1000);
    expect(JSON.parse(indexQuery(['be'], -5, 0, 'en', ['en'])).rows).toBe(25);
  });

  it('rejects a locale suffix that is not a plain alpha subtag', () => {
    expect(JSON.parse(indexQuery([], 0, 25, 'en-0000000', ['en'])).sort).toBe('title_EN_s asc');
    expect(JSON.parse(indexQuery([], 0, 25, 'zh-hans', ['zh-hans'])).sort).toBe('title_ZH_s asc');
  });

  it('bounds the request with a timeout so a stalled connection cannot hang forever', async () => {
    respondWith([]);

    await getNationalTargets7({ countries: ['be'], locale: 'en', locales: ['en'] });

    expect(ofetchMock).toHaveBeenCalledTimes(1);
    expect(ofetchMock.mock.calls[0][1].timeout).toBe(20000);
  });

  it('rejects a non-string locale that fakes the regex via toString but injects via toUpperCase', () => {
    // HIGH, round 2: safeLocale kept the original object, so a custom toUpperCase() appended
    // arbitrary field names to fl and sort. fq was never reachable, so this could only widen
    // the projection over already-public documents, but it is field injection all the same.
    const evil = { toString: () => 'en', toUpperCase: () => 'EN_t,secret_s,tail' };
    const body = JSON.parse(indexQuery([], 0, 25, evil, ['en']));

    expect(body.fl).toBe('identifier:uniqueIdentifier_s, name:title_EN_t');
    expect(body.sort).toBe('title_EN_s asc');
    expect(body.fl).not.toContain('secret_s');
  });

  it('caps deep paging and dedupes/caps the projection list', () => {
    expect(JSON.parse(indexQuery([], Number.MAX_SAFE_INTEGER, 1, 'en', ['en'])).start).toBe(100000);

    const many = JSON.parse(indexQuery([], 0, 25, 'en', Array(100000).fill('fr')));
    expect(many.fl.length).toBeLessThan(200);
    expect(many.fl.match(/title_FR_t/g)).toHaveLength(1);
  });

  it('resolves to [] for a null or primitive context instead of throwing', async () => {
    respondWith([]);

    await expect(getNationalTargets7(null)).resolves.toEqual([]);
    await expect(getNationalTargets7('nonsense')).resolves.toEqual([]);
    await expect(getNationalTargets7({ locale: Symbol('x') })).resolves.toEqual([]);
  });

  it('never interpolates into fq, so the public/realm scoping cannot be tampered with', () => {
    const body = JSON.parse(indexQuery(['be'], 0, 25, 'en', ['en']));

    expect(body.fq).toEqual(['_state_s:public', 'realm_ss:ort']);
  });
});
