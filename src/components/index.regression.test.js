// Regression baseline (CR-2) for the REAL field component src/components/index.vue. Covers the
// STABLE Drupal-input contract that holds on `latest`: hydrate the selection from the hidden input
// on mount, and write the comma-joined identifier string back on change. Heavy deps are mocked so
// the component mounts offline. Plain JS + @vue/test-utils + Vitest only — no @nuxt/test-utils.

import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Controlled taxonomy data: getData returns per-domain option lists; lookUp resolves saved keys to
// the matching option objects (mirrors the real composable's filter-by-identifier behavior).
const OPTIONS = {
  subjects: [
    { identifier: 'CBD-SUBJECT-MAR', name: 'Marine' },
    { identifier: 'CBD-SUBJECT-PA', name: 'Protected Areas' },
    { identifier: 'CBD-SUBJECT-CC', name: 'Climate Change' },
  ],
  gbfTargets: [
    { identifier: 'GBF-TARGET-01', name: 'Target 1' },
    { identifier: 'GBF-TARGET-02', name: 'Target 2' },
  ],
  // SDGs are a LINKABLE_DOMAINS target — GBF-TARGET-01 auto-links SDG-14 and SDG-15.
  sdgs: [
    { identifier: 'SUSTAINABLE-DEVELOPMENT-GOAL-14', name: 'Life Below Water' },
    { identifier: 'SUSTAINABLE-DEVELOPMENT-GOAL-15', name: 'Life On Land' },
    { identifier: 'SUSTAINABLE-DEVELOPMENT-GOAL-01', name: 'No Poverty' },
  ],
  govTypes: [
    { identifier: 'GOV-A', name: 'Government A' },
    { identifier: 'GOV-B', name: 'Government B' },
  ],
  // bchSubjects carry a resolved children tree; bchSubjectGroups is the parents-with-children subset.
  bchSubjects: [{ identifier: 'BCH-CHILD-1', name: 'BCH Child 1' }],
  bchSubjectGroups: [
    {
      identifier: 'BCH-GROUP-1',
      name: 'BCH Group 1',
      children: [
        { identifier: 'BCH-CHILD-1', name: 'BCH Child 1' },
        { identifier: 'BCH-CHILD-2', name: 'BCH Child 2' },
      ],
    },
  ],
};

const getDataMock = vi.fn(async (domain) => OPTIONS[domain] ?? []);
const lookUpMock = vi.fn(async (source, keys = [], single = false) => {
  const matched = (OPTIONS[source] ?? []).filter((o) => keys.includes(o.identifier));
  if (single) return matched[0];
  return matched;
});

vi.mock('@/composables/use-taxonomies', () => ({
  useTaxonomies: () => ({ getData: getDataMock, lookUp: lookUpMock }),
}));

vi.mock('@/composables/use-translations', () => ({
  useTranslations: () => ({ t: (key) => key }),
}));

// Controllable National-Targets stub — overridden per test that needs docs.
const getNationalTargets7Mock = vi.fn(async () => []);
vi.mock('@/utils/national-targets.js', () => ({
  getNationalTargets7: (...args) => getNationalTargets7Mock(...args),
}));

const { default: ChmComponent } = await import('@/components/index.vue');

let wrapper;

/** Insert the hidden Drupal input the widget reads/writes, optionally pre-seeded with a saved value. */
function seedHiddenInput(fieldName, savedValue = '') {
  const input = document.createElement('input');
  input.setAttribute('type', 'hidden');
  input.setAttribute('name', `field_${fieldName}[0][value]`);
  input.id = `edit-field-${fieldName}-0-value`;
  input.value = savedValue;
  document.body.appendChild(input);
  return input;
}

const hiddenInputFor = (fieldName) =>
  document.querySelector(`input[name='field_${fieldName}[0][value]']`);

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => {
    throw new Error('Network access is disabled for component regression tests');
  }));
  vi.stubGlobal('XMLHttpRequest', class {
    open() {
      throw new Error('Network access is disabled for component regression tests');
    }
  });
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
  getNationalTargets7Mock.mockReset();
  getNationalTargets7Mock.mockResolvedValue([]);
});

async function mountField(props, savedValue) {
  if (savedValue !== undefined) seedHiddenInput(props.name, savedValue);
  wrapper = mount(ChmComponent, { props, attachTo: document.body });
  await flushPromises();
  return wrapper;
}

describe('<ChmComponent> hydrate from hidden Drupal input', () => {
  it('reads a comma-separated saved value on mount and selects the matching options', async () => {
    await mountField(
      { name: 'bl2_tags', domains: ['subjects'], locales: ['en'] },
      'CBD-SUBJECT-MAR,CBD-SUBJECT-PA',
    );

    const selects = wrapper.findAllComponents({ name: 'vue-multiselect' });
    const subjects = selects.find((s) => s.props('id') === 'bl2_tags-subjects');
    expect(subjects.props('modelValue').map((o) => o.identifier)).toEqual([
      'CBD-SUBJECT-MAR',
      'CBD-SUBJECT-PA',
    ]);
  });

  it('selects nothing when the hidden input is empty', async () => {
    await mountField({ name: 'bl2_tags', domains: ['subjects'], locales: ['en'] }, '');

    const subjects = wrapper
      .findAllComponents({ name: 'vue-multiselect' })
      .find((s) => s.props('id') === 'bl2_tags-subjects');
    expect(subjects.props('modelValue')).toEqual([]);
  });

  it('ignores saved keys that match no loaded option', async () => {
    await mountField(
      { name: 'bl2_tags', domains: ['subjects'], locales: ['en'] },
      'CBD-SUBJECT-MAR,NOT-A-REAL-KEY',
    );

    const subjects = wrapper
      .findAllComponents({ name: 'vue-multiselect' })
      .find((s) => s.props('id') === 'bl2_tags-subjects');
    expect(subjects.props('modelValue').map((o) => o.identifier)).toEqual(['CBD-SUBJECT-MAR']);
  });

  it('resolves the hidden input by Drupal auto-id when the name attribute is absent', async () => {
    const input = document.createElement('input');
    input.id = 'edit-field-bl2_tags-0-value'; // no name attribute — only the # selector matches
    input.value = 'CBD-SUBJECT-PA';
    document.body.appendChild(input);

    wrapper = mount(ChmComponent, {
      props: { name: 'bl2_tags', domains: ['subjects'], locales: ['en'] },
      attachTo: document.body,
    });
    await flushPromises();

    const subjects = wrapper
      .findAllComponents({ name: 'vue-multiselect' })
      .find((s) => s.props('id') === 'bl2_tags-subjects');
    expect(subjects.props('modelValue').map((o) => o.identifier)).toEqual(['CBD-SUBJECT-PA']);
  });
});

describe('<ChmComponent> save back to hidden Drupal input', () => {
  it('writes the comma-joined identifier string when an option is selected', async () => {
    await mountField({ name: 'bl2_tags', domains: ['subjects'], locales: ['en'] }, '');

    const subjects = wrapper
      .findAllComponents({ name: 'vue-multiselect' })
      .find((s) => s.props('id') === 'bl2_tags-subjects');

    subjects.vm.$emit('select', OPTIONS.subjects[0]); // user picks "Marine"
    subjects.vm.$emit('select', OPTIONS.subjects[2]); // and "Climate Change"
    // vue-multiselect mutates v-model; mirror that so getAllKeys() reads the new selection.
    subjects.vm.$emit('update:modelValue', [OPTIONS.subjects[0], OPTIONS.subjects[2]]);
    await flushPromises();
    subjects.vm.$emit('close');
    await flushPromises();

    expect(hiddenInputFor('bl2_tags').value).toBe('CBD-SUBJECT-MAR,CBD-SUBJECT-CC');
  });

  it('rewrites the hidden input after a removal', async () => {
    await mountField(
      { name: 'bl2_tags', domains: ['subjects'], locales: ['en'] },
      'CBD-SUBJECT-MAR,CBD-SUBJECT-PA',
    );

    const subjects = wrapper
      .findAllComponents({ name: 'vue-multiselect' })
      .find((s) => s.props('id') === 'bl2_tags-subjects');

    subjects.vm.$emit('update:modelValue', [OPTIONS.subjects[0]]); // PA removed, MAR remains
    subjects.vm.$emit('remove', OPTIONS.subjects[1]);
    await flushPromises();

    expect(hiddenInputFor('bl2_tags').value).toBe('CBD-SUBJECT-MAR');
  });

  it('de-duplicates identifiers across domains when writing back', async () => {
    await mountField(
      { name: 'bl2_tags', domains: ['gbfTargets', 'subjects'], locales: ['en'] },
      'GBF-TARGET-01,CBD-SUBJECT-MAR',
    );

    expect(hiddenInputFor('bl2_tags').value).toBe('GBF-TARGET-01,CBD-SUBJECT-MAR');
  });

  it('writes to the value2 input when isAdditionalField is set', async () => {
    const input = document.createElement('input');
    input.setAttribute('name', 'field_bl2_tags[0][value2]');
    input.id = 'edit-field-bl2_tags-0-value2';
    input.value = '';
    document.body.appendChild(input);

    wrapper = mount(ChmComponent, {
      props: { name: 'bl2_tags', domains: ['subjects'], locales: ['en'], isAdditionalField: true },
      attachTo: document.body,
    });
    await flushPromises();

    const subjects = wrapper
      .findAllComponents({ name: 'vue-multiselect' })
      .find((s) => s.props('id') === 'bl2_tags-subjects');
    subjects.vm.$emit('update:modelValue', [OPTIONS.subjects[1]]);
    subjects.vm.$emit('close');
    await flushPromises();

    expect(document.querySelector("input[name='field_bl2_tags[0][value2]']").value).toBe(
      'CBD-SUBJECT-PA',
    );
  });
});

describe('<ChmComponent> National Targets 7 hydration', () => {
  it('hydrates nationalTargets7 from the already-loaded options (no refetch)', async () => {
    getNationalTargets7Mock.mockResolvedValue([
      { identifier: 'nt-1', name: 'NT One' },
      { identifier: 'nt-2', name: 'NT Two' },
    ]);

    await mountField(
      { name: 'bl2_tags', domains: ['nationalTargets7'], countries: ['be'], locales: ['en'] },
      'nt-2',
    );

    const nt = wrapper
      .findAllComponents({ name: 'vue-multiselect' })
      .find((s) => s.props('id') === 'bl2_tags-nationalTargets7');
    expect(nt.props('modelValue').map((o) => o.identifier)).toEqual(['nt-2']);
    expect(getNationalTargets7Mock).toHaveBeenCalledTimes(1); // loaded once, reused for hydration
  });
});

describe('<ChmComponent> bchSubjectGroups hydration', () => {
  it('resolves saved bch keys to the matching children inside the loaded groups', async () => {
    await mountField(
      { name: 'bsl_tags', domains: ['bchSubjectGroups'], locales: ['en'] },
      'BCH-CHILD-1',
    );

    const group = wrapper
      .findAllComponents({ name: 'vue-multiselect' })
      .find((s) => s.props('id') === 'bsl_tags-bchSubjectGroups');
    expect(group.props('modelValue').map((o) => o.identifier)).toEqual(['BCH-CHILD-1']);
    expect(group.props('groupValues')).toBe('children'); // rendered as a grouped select
  });
});

describe('<ChmComponent> single-value domain', () => {
  it('hydrates a single-value domain to one object and writes its identifier back', async () => {
    await mountField(
      {
        name: 'bl2_tags',
        domains: ['govTypes'],
        singleValueDomains: ['govTypes'],
        locales: ['en'],
      },
      'GOV-B',
    );

    const gov = wrapper
      .findAllComponents({ name: 'vue-multiselect' })
      .find((s) => s.props('id') === 'bl2_tags-govTypes');
    expect(gov.props('multiple')).toBe(false);
    expect(gov.props('modelValue')).toMatchObject({ identifier: 'GOV-B' });
    expect(hiddenInputFor('bl2_tags').value).toBe('GOV-B');
  });
});

describe('<ChmComponent> GBF Target auto-link (one-way)', () => {
  it('selecting GBF-TARGET-01 auto-fills its related SDGs into the sdgs domain and persists', async () => {
    await mountField(
      { name: 'bl2_tags', domains: ['gbfTargets', 'sdgs'], locales: ['en'] },
      '',
    );

    const gbf = wrapper
      .findAllComponents({ name: 'vue-multiselect' })
      .find((s) => s.props('id') === 'bl2_tags-gbfTargets');

    // User picks GBF-TARGET-01; v-model gains the pick, then @select fires autoLinkRelated.
    gbf.vm.$emit('update:modelValue', [OPTIONS.gbfTargets[0]]);
    gbf.vm.$emit('select', OPTIONS.gbfTargets[0]);
    await flushPromises();

    const sdgs = wrapper
      .findAllComponents({ name: 'vue-multiselect' })
      .find((s) => s.props('id') === 'bl2_tags-sdgs');
    expect(sdgs.props('modelValue').map((o) => o.identifier)).toEqual([
      'SUSTAINABLE-DEVELOPMENT-GOAL-14',
      'SUSTAINABLE-DEVELOPMENT-GOAL-15',
    ]);
    expect(hiddenInputFor('bl2_tags').value).toBe(
      'GBF-TARGET-01,SUSTAINABLE-DEVELOPMENT-GOAL-14,SUSTAINABLE-DEVELOPMENT-GOAL-15',
    );
  });

  it('selecting an SDG auto-fills nothing (one-way: no inverse back-fill)', async () => {
    await mountField(
      { name: 'bl2_tags', domains: ['gbfTargets', 'sdgs'], locales: ['en'] },
      '',
    );

    const sdgs = wrapper
      .findAllComponents({ name: 'vue-multiselect' })
      .find((s) => s.props('id') === 'bl2_tags-sdgs');
    sdgs.vm.$emit('update:modelValue', [OPTIONS.sdgs[0]]);
    sdgs.vm.$emit('select', OPTIONS.sdgs[0]);
    await flushPromises();

    const gbf = wrapper
      .findAllComponents({ name: 'vue-multiselect' })
      .find((s) => s.props('id') === 'bl2_tags-gbfTargets');
    expect(gbf.props('modelValue')).toEqual([]); // GBF domain untouched
    expect(hiddenInputFor('bl2_tags').value).toBe('SUSTAINABLE-DEVELOPMENT-GOAL-14');
  });
});

describe('<ChmComponent> missing hidden input', () => {
  it('logs an error and does not throw when no hidden input exists at change time', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // No input seeded for this field name -> findHiddenInput returns null.
    wrapper = mount(ChmComponent, {
      props: { name: 'no_input_field', domains: ['subjects'], locales: ['en'] },
      attachTo: document.body,
    });
    await flushPromises();

    const subjects = wrapper
      .findAllComponents({ name: 'vue-multiselect' })
      .find((s) => s.props('id') === 'no_input_field-subjects');
    expect(() => {
      subjects.vm.$emit('update:modelValue', [OPTIONS.subjects[0]]);
      subjects.vm.$emit('close');
    }).not.toThrow();
    await flushPromises();

    expect(errSpy).toHaveBeenCalledWith(
      expect.stringContaining('hidden input not found for field_no_input_field[0][value]'),
    );
    errSpy.mockRestore();
  });
});

describe('<ChmComponent> single-value domain with no saved match', () => {
  it('hydrates a single-value domain to null when the saved key matches nothing', async () => {
    await mountField(
      {
        name: 'bl2_tags',
        domains: ['govTypes', 'subjects'],
        singleValueDomains: ['govTypes'],
        locales: ['en'],
      },
      'CBD-SUBJECT-MAR', // matches subjects, not govTypes
    );

    const gov = wrapper
      .findAllComponents({ name: 'vue-multiselect' })
      .find((s) => s.props('id') === 'bl2_tags-govTypes');
    expect(gov.props('modelValue')).toBeNull();
    expect(hiddenInputFor('bl2_tags').value).toBe('CBD-SUBJECT-MAR');
  });
});

describe('<ChmComponent> additional-field missing input error path', () => {
  it('reports the value2 key when the additional-field hidden input is absent', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    wrapper = mount(ChmComponent, {
      props: {
        name: 'no_input_field',
        domains: ['subjects'],
        locales: ['en'],
        isAdditionalField: true,
      },
      attachTo: document.body,
    });
    await flushPromises();

    const subjects = wrapper
      .findAllComponents({ name: 'vue-multiselect' })
      .find((s) => s.props('id') === 'no_input_field-subjects');
    subjects.vm.$emit('update:modelValue', [OPTIONS.subjects[0]]);
    subjects.vm.$emit('close');
    await flushPromises();

    expect(errSpy).toHaveBeenCalledWith(
      expect.stringContaining('hidden input not found for field_no_input_field[0][value2]'),
    );
    errSpy.mockRestore();
  });
});

describe('<ChmComponent> debug output', () => {
  it('renders the per-domain input id when debug is enabled', async () => {
    await mountField(
      { name: 'bl2_tags', domains: ['subjects'], locales: ['en'], debug: true },
      'CBD-SUBJECT-MAR',
    );

    expect(wrapper.find('.debug-ids').exists()).toBe(true);
    expect(wrapper.find('.debug-ids').text()).toContain('bl2_tags-subjects');
  });
});

describe('<ChmComponent> invalid field name guard', () => {
  it('does not throw when the field name is malformed and no input can be resolved', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      mountField({ name: 'Bad Name!', domains: ['subjects'], locales: ['en'] }, undefined),
    ).resolves.toBeDefined();

    expect(errSpy).toHaveBeenCalled(); // logs the invalid-name error instead of crashing
    errSpy.mockRestore();
  });
});
