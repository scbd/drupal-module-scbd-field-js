import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import ar from './locales/ar.json';
import en from './locales/en.json';

const localesDir = join(dirname(fileURLToPath(import.meta.url)), 'locales');

// Read the directory at test-collection time so any locale file dropped in later is
// covered automatically — no filename list to maintain.
const localeFiles = readdirSync(localesDir)
  .filter((file) => file.endsWith('.json'))
  .sort();

const readLocale = (file) => JSON.parse(readFileSync(join(localesDir, file), 'utf8'));

const enKeys = Object.keys(en).sort();

// CR-12: the dead `geoLocations` key was removed from all locale files; the widget
// renders `countries` and `regions` as separate domains. Lock that contract so the
// key cannot silently return, sampling a Latin (en) and a non-Latin (ar) locale.
describe('i18n locale keys', () => {
  it.each([
    ['en', en],
    ['ar', ar],
  ])('%s drops geoLocations but keeps countries and regions', (_, locale) => {
    expect(locale).not.toHaveProperty('geoLocations');
    expect(locale).toHaveProperty('countries');
    expect(locale).toHaveProperty('regions');
  });
});

// Every locale must mirror en.json exactly: same key set (no missing, no extra) and
// no empty/whitespace-only values. Driven off the directory listing so a newly added
// locale file is parity-checked without touching this test.
describe('i18n locale parity with en.json', () => {
  it('discovers en.json and at least one translation', () => {
    expect(localeFiles).toContain('en.json');
    expect(localeFiles.length).toBeGreaterThan(1);
  });

  it.each(localeFiles)('%s has exactly the same key set as en.json', (file) => {
    const localeKeys = Object.keys(readLocale(file)).sort();
    const missing = enKeys.filter((key) => !localeKeys.includes(key));
    const extra = localeKeys.filter((key) => !enKeys.includes(key));

    expect(missing, `${file} is missing keys`).toEqual([]);
    expect(extra, `${file} has extra keys`).toEqual([]);
  });

  it.each(localeFiles)('%s has no empty or whitespace-only values', (file) => {
    const locale = readLocale(file);
    const blank = Object.entries(locale)
      .filter(([, value]) => typeof value !== 'string' || value.trim() === '')
      .map(([key]) => key);

    expect(blank, `${file} has blank values`).toEqual([]);
  });
});
