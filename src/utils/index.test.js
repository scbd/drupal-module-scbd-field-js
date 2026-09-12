// Regression baseline (CR-2) for the previously-untested pure utilities in src/utils/index.js.
// Plain JS + Vitest only — no @nuxt/test-utils, no network.

import { describe, expect, it } from 'vitest';

import {
  omitNil,
  byName,
  byIdentifier,
  localizedName,
  migrateSdgKey,
  buildChildren,
} from '@/utils/index.js';

describe('migrateSdgKey', () => {
  it.each([
    ['SDG-GOAL-1', 'SUSTAINABLE-DEVELOPMENT-GOAL-01'],
    ['SDG-GOAL-01', 'SUSTAINABLE-DEVELOPMENT-GOAL-01'],
    ['SDG-GOAL-9', 'SUSTAINABLE-DEVELOPMENT-GOAL-09'],
    ['SDG-GOAL-14', 'SUSTAINABLE-DEVELOPMENT-GOAL-14'],
    ['SDG-GOAL-17', 'SUSTAINABLE-DEVELOPMENT-GOAL-17'],
  ])('migrates legacy %s -> %s', (input, expected) => {
    expect(migrateSdgKey(input)).toBe(expected);
  });

  it.each([
    ['SUSTAINABLE-DEVELOPMENT-GOAL-14'], // already-current SDG identifier
    ['GBF-TARGET-01'],
    ['CBD-SUBJECT-MAR'],
    ['be'],
    [''],
    ['SDG-GOAL-'], // no digits -> no match
    ['SDG-GOAL-123'], // 3 digits -> out of the {1,2} range, passes through
    ['sdg-goal-01'], // case-sensitive prefix -> passes through
    ['xSDG-GOAL-01'], // anchored ^ -> passes through
  ])('passes %s through unchanged', (input) => {
    expect(migrateSdgKey(input)).toBe(input);
  });

  it.each([[undefined], [null], [42], [{ key: 'SDG-GOAL-01' }]])(
    'returns non-string input %s untouched',
    (input) => {
      expect(migrateSdgKey(input)).toBe(input);
    },
  );
});

describe('localizedName', () => {
  it('prefers shortTitle over title and name', () => {
    const item = {
      shortTitle: { en: 'Short EN', fr: 'Court FR' },
      title: { en: 'Long Title EN' },
      name: 'Plain Name',
    };
    expect(localizedName(item, 'fr')).toBe('Court FR');
    expect(localizedName(item, 'en')).toBe('Short EN');
  });

  it('falls back from shortTitle to title when shortTitle is empty {}', () => {
    const item = { shortTitle: {}, title: { en: 'Title EN', fr: 'Titre FR' }, name: 'Plain' };
    expect(localizedName(item, 'fr')).toBe('Titre FR');
  });

  it('falls back through to the plain string name when no lstrings resolve', () => {
    expect(localizedName({ name: 'Just A Name' }, 'fr')).toBe('Just A Name');
  });

  it('resolves an lstring via English when the requested locale is missing', () => {
    const item = { title: { en: 'English Only' } };
    expect(localizedName(item, 'de')).toBe('English Only');
  });

  it('resolves the requested locale when present', () => {
    const item = { title: { en: 'English', nl: 'Nederlands' } };
    expect(localizedName(item, 'nl')).toBe('Nederlands');
  });

  it('returns "" (never [object Object]) for a malformed object-valued name with no usable lstring', () => {
    expect(localizedName({ name: { foo: 'bar' } }, 'en')).toBe('');
  });

  it('returns "" for an entirely empty term', () => {
    expect(localizedName({}, 'en')).toBe('');
  });

  it('reads name as an lstring when it carries an en key', () => {
    expect(localizedName({ name: { en: 'Name EN', fr: 'Nom FR' } }, 'fr')).toBe('Nom FR');
  });
});

describe('buildChildren', () => {
  const flat = [
    { identifier: 'parent', name: 'Parent', narrowerTerms: ['c2', 'c1'] },
    { identifier: 'c1', name: 'Child Alpha' },
    { identifier: 'c2', name: 'Child Beta' },
    { identifier: 'leaf', name: 'Leaf' },
  ];

  it('resolves narrowerTerms id-list into a children array of the matching objects', () => {
    const out = buildChildren(flat);
    const parent = out.find((it) => it.identifier === 'parent');
    expect(parent.children.map((c) => c.identifier)).toEqual(['c1', 'c2']); // sorted by name
    expect(parent).not.toHaveProperty('narrowerTerms'); // swapped out
  });

  it('preserves element count and passes childless items through untouched', () => {
    const out = buildChildren(flat);
    expect(out).toHaveLength(flat.length);
    const leaf = out.find((it) => it.identifier === 'leaf');
    expect(leaf).toBe(flat[3]); // same reference — untouched
  });

  it('is non-mutating: the source items keep their narrowerTerms', () => {
    const source = [
      { identifier: 'p', name: 'P', narrowerTerms: ['x'] },
      { identifier: 'x', name: 'X' },
    ];
    const snapshot = JSON.parse(JSON.stringify(source));
    buildChildren(source);
    expect(source).toEqual(snapshot);
  });

  it('drops narrower ids that resolve to nothing', () => {
    const source = [
      { identifier: 'p', name: 'P', narrowerTerms: ['missing', 'real'] },
      { identifier: 'real', name: 'Real' },
    ];
    const parent = buildChildren(source).find((it) => it.identifier === 'p');
    expect(parent.children.map((c) => c.identifier)).toEqual(['real']);
  });

  it('treats an empty narrowerTerms array as no children (pass-through)', () => {
    const source = [{ identifier: 'p', name: 'P', narrowerTerms: [] }];
    const out = buildChildren(source);
    expect(out[0]).toBe(source[0]);
  });

  it('honors custom idKey / childrenKey options', () => {
    const source = [
      { id: 'p', name: 'P', kids: ['c'] },
      { id: 'c', name: 'C' },
    ];
    const parent = buildChildren(source, { idKey: 'id', childrenKey: 'kids' }).find(
      (it) => it.id === 'p',
    );
    expect(parent.children.map((c) => c.id)).toEqual(['c']);
    expect(parent).not.toHaveProperty('kids');
  });
});

describe('omitNil', () => {
  it('drops null and undefined values but keeps falsy-but-defined ones', () => {
    expect(omitNil({ a: 1, b: null, c: undefined, d: 0, e: '', f: false })).toEqual({
      a: 1,
      d: 0,
      e: '',
      f: false,
    });
  });

  it('returns an empty object for an all-nil input', () => {
    expect(omitNil({ a: null, b: undefined })).toEqual({});
  });
});

describe('byName / byIdentifier comparators', () => {
  it('byName orders by the name field and tolerates a missing name', () => {
    const list = [{ name: 'Beta' }, { name: 'alpha' }, {}];
    expect([...list].sort(byName).map((x) => x.name)).toEqual([undefined, 'alpha', 'Beta']);
  });

  it('byIdentifier orders by the identifier field and tolerates a missing identifier', () => {
    const list = [{ identifier: 'b' }, { identifier: 'a' }, {}];
    expect([...list].sort(byIdentifier).map((x) => x.identifier)).toEqual([undefined, 'a', 'b']);
  });
});

describe('prototype-key hardening from the DEV-1168 pre-PR security review', () => {
  it('localizedName never returns a non-string for a prototype locale key', () => {
    // prop['constructor'] resolves to a function off the prototype, which is truthy and
    // used to short-circuit past prop.en, escaping the always-a-string contract (B8).
    const item = { title: { en: 'Marine' }, name: 'Marine' };

    expect(typeof localizedName(item, 'constructor')).toBe('string');
    expect(typeof localizedName(item, '__proto__')).toBe('string');
    expect(typeof localizedName(item, 'valueOf')).toBe('string');
    expect(localizedName(item, 'constructor')).toBe('Marine');
  });

  it('still resolves a real locale and falls back to en', () => {
    const item = { title: { en: 'Marine', fr: 'Marin' }, name: 'Marine' };

    expect(localizedName(item, 'fr')).toBe('Marin');
    expect(localizedName(item, 'de')).toBe('Marine');
  });
});
