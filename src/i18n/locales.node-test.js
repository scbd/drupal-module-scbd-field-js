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

  it('completes the truncated Amharic ecosystem type label', () => {
    const amharic = JSON.parse(readFileSync(new URL('am.json', localesDirectory), 'utf8'));
    assert.equal(amharic.ecosystemTypes, 'የሥነ ምህዳር ዓይነት');
  });

  it('completes the Amharic geographic scope label', () => {
    const amharic = JSON.parse(readFileSync(new URL('am.json', localesDirectory), 'utf8'));
    assert.equal(amharic.geoScopes, 'የጂኦግራፊያዊ ወሰን');
  });

  it('completes the Georgian geographic scope label', () => {
    const georgian = JSON.parse(readFileSync(new URL('ka.json', localesDirectory), 'utf8'));
    assert.equal(georgian.geoScopes, 'გეოგრაფიული ფარგლები');
  });

  it('completes the Georgian event status label', () => {
    const georgian = JSON.parse(readFileSync(new URL('ka.json', localesDirectory), 'utf8'));
    assert.equal(georgian.eventStatuses, 'მოვლენის სტატუსი');
  });

  it('completes the truncated Georgian biosafety labels', () => {
    const georgian = JSON.parse(readFileSync(new URL('ka.json', localesDirectory), 'utf8'));
    assert.equal(georgian.bchSubjects, 'ბიოუსაფრთხოების თემატური სფეროები');
    assert.equal(georgian.bchSubjectGroups, 'ბიოუსაფრთხოების თემატური სფეროები');
  });

  it('completes the truncated Marathi ecosystem type label', () => {
    const marathi = JSON.parse(readFileSync(new URL('mr.json', localesDirectory), 'utf8'));
    assert.equal(marathi.ecosystemTypes, 'इकोसिस्टम प्रकार');
  });

  it('completes the Marathi geographic scope label', () => {
    const marathi = JSON.parse(readFileSync(new URL('mr.json', localesDirectory), 'utf8'));
    assert.equal(marathi.geoScopes, 'भौगोलिक व्याप्ती');
  });

  it('completes the Marathi document type label', () => {
    const marathi = JSON.parse(readFileSync(new URL('mr.json', localesDirectory), 'utf8'));
    assert.equal(marathi.documentTypes, 'कागदपत्राचा प्रकार');
  });

  it('completes both Marathi biosafety thematic area labels', () => {
    const marathi = JSON.parse(readFileSync(new URL('mr.json', localesDirectory), 'utf8'));
    assert.equal(marathi.bchSubjects, 'बायोसेफ्टी थीमॅटिक क्षेत्र');
    assert.equal(marathi.bchSubjectGroups, 'बायोसेफ्टी थीमॅटिक क्षेत्र');
  });

  it('uses the Marathi plural for national targets', () => {
    const marathi = JSON.parse(readFileSync(new URL('mr.json', localesDirectory), 'utf8'));
    assert.equal(marathi.nationalTargets7, 'राष्ट्रीय लक्ष्ये');
  });

  it('completes the truncated Swahili biosafety labels', () => {
    const swahili = JSON.parse(readFileSync(new URL('sw.json', localesDirectory), 'utf8'));
    assert.equal(swahili.bchSubjects, 'Maeneo ya Kimada ya Usalama wa Biolojia');
    assert.equal(swahili.bchSubjectGroups, 'Maeneo ya Kimada ya Usalama wa Biolojia');
  });

  it('completes the Punjabi geographic scope label', () => {
    const punjabi = JSON.parse(readFileSync(new URL('pa.json', localesDirectory), 'utf8'));
    assert.equal(punjabi.geoScopes, 'ਭੂਗੋਲਿਕ ਸਕੋਪ');
  });

  it('completes the Latvian geographic scope label', () => {
    const latvian = JSON.parse(readFileSync(new URL('lv.json', localesDirectory), 'utf8'));
    assert.equal(latvian.geoScopes, 'Ģeogrāfiskā darbības joma');
  });
});
