// Regression baseline (CR-2) for src/utils/national-targets.js. Asserts the ACTUAL behavior on
// `latest` via the public getNationalTargets7 (indexQuery is module-private on this branch, so the
// query is observed through the captured ofetch POST body). Plain JS + Vitest only — no network.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Capture the ofetch call so we can inspect the request body the SUT builds.
const ofetchMock = vi.fn();
vi.mock('ofetch', () => ({ ofetch: (...args) => ofetchMock(...args) }));

const { getNationalTargets7 } = await import('@/utils/national-targets.js');

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
  it('maps zh-hans -> zh in the name field while df/sort keep the raw locale token', async () => {
    respondWith([]);

    await getNationalTargets7({ locale: 'zh-hans', locales: ['zh-hans'] });
    const body = sentBody();

    expect(body.fl).toBe('identifier:uniqueIdentifier_s, name:title_ZH_t');
    expect(body.df).toBe('text_ZH-HANS_txt'); // df/sort upcase the raw token, not the mapped one
    expect(body.sort).toBe('title_ZH-HANS_s asc');
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
