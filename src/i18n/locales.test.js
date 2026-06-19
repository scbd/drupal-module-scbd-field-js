import { describe, expect, it } from 'vitest';

import ar from './locales/ar.json';
import en from './locales/en.json';

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
