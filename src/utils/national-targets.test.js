// Tests for src/utils/national-targets.js — locks the SEC-2 positive control: indexQuery
// re-asserts COUNTRY_RE / LOCALE_RE internally (defense-in-depth, CR-8), so it fails closed for
// any caller while producing byte-identical output for already-sanitized (valid) input. Pure util,
// no network, deterministic.

import { describe, it, expect } from 'vitest';
import { indexQuery } from './national-targets.js';

describe('indexQuery whitelist re-assertion (SEC-2 / CR-8)', () => {
  // Solr metacharacters the whitelists must keep out of field names.
  const SOLR_METACHARS = ['(', ')', ':', '*', ' ', '"', "'"];

  it('drops a malicious locale and falls back to "en" — no metacharacters leak into df/sort/fl', () => {
    const query = JSON.parse(indexQuery([], 0, 1000, 'EN) OR (1=1'));

    // Malformed locale rejected; fallback to 'en' keeps field names clean.
    expect(query.df).toBe('text_EN_txt');
    expect(query.sort).toBe('title_EN_s asc');
    expect(query.fl).toBe('identifier:uniqueIdentifier_s, name:title_EN_t');

    // Field-name-bearing parts carry none of the injected metacharacters.
    for (const ch of SOLR_METACHARS) {
      expect(query.df).not.toContain(ch);
      expect(query.sort.replace(' asc', '')).not.toContain(ch);
    }
  });

  it('drops a malicious country value from the government_s clause', () => {
    const query = JSON.parse(indexQuery(['be) OR (1=1'], 0, 1000, 'en'));

    // Injected country dropped → no government_s clause remains.
    expect(query.q).toBe('(schema_s : (nationalTarget7))');
    expect(query.q).not.toContain('government_s');
    expect(query.q).not.toContain('OR');
  });

  it('keeps valid countries while dropping invalid siblings', () => {
    const query = JSON.parse(indexQuery(['be', 'be) OR (1=1', 'fr'], 0, 1000, 'en'));
    expect(query.q).toBe('(schema_s : (nationalTarget7)AND government_s : (be fr))');
  });

  it('produces byte-identical output for already-sanitized valid input (idempotent boundary)', () => {
    const query = JSON.parse(indexQuery(['be'], 0, 1000, 'fr', ['fr', 'en']));

    expect(query.df).toBe('text_FR_txt');
    expect(query.sort).toBe('title_FR_s asc');
    expect(query.q).toBe('(schema_s : (nationalTarget7)AND government_s : (be))');
    expect(query.fl).toBe('identifier:uniqueIdentifier_s, name:title_FR_t, title_EN_t');
    expect(query.fq).toEqual(['_state_s:public', 'realm_ss:ort']);
    expect(query.wt).toBe('json');
    expect(query.start).toBe(0);
    expect(query.rows).toBe(1000);
  });
});
