import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const localesDirectory = new URL('./locales/', import.meta.url);
const localeFiles = readdirSync(localesDirectory).filter(file => file.endsWith('.json')).sort();
const english = JSON.parse(readFileSync(new URL('en.json', localesDirectory), 'utf8'));
const expectedKeys = Object.keys(english).sort();

// The widget renders countries and regions as separate domains in every locale.
describe('i18n locale keys', () => {
  it('includes all 70 locales', () => {
    assert.equal(localeFiles.length, 70);
  });

  for (const file of localeFiles) {
    it(`${file} matches English keys and uses separate geographic domains`, () => {
      const locale = JSON.parse(readFileSync(new URL(file, localesDirectory), 'utf8'));
      assert.equal(Object.hasOwn(locale, 'geoLocations'), false, 'geoLocations must be absent');
      assert.equal(Object.hasOwn(locale, 'countries'), true, 'countries must be present');
      assert.equal(Object.hasOwn(locale, 'regions'), true, 'regions must be present');
      assert.deepEqual(Object.keys(locale).sort(), expectedKeys);
    });
  }

  it('translates the Dutch document type label', () => {
    const dutch = JSON.parse(readFileSync(new URL('nl.json', localesDirectory), 'utf8'));
    assert.equal(dutch.documentTypes, 'Documenttype');
  });
});
