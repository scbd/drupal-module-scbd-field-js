import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';

// GBF-TARGET-01 -> related SDGs (14, 15) + CBD-SUBJECT-MAR etc. (src/utils/constants.js GBF_SAMEAS).
const gbfTarget = { identifier: 'GBF-TARGET-01', name: 'GBF Target 1' };
const sdg14 = { identifier: 'SUSTAINABLE-DEVELOPMENT-GOAL-14', name: 'SDG 14' };
const sdg15 = { identifier: 'SUSTAINABLE-DEVELOPMENT-GOAL-15', name: 'SDG 15' };
const subjectMar = { identifier: 'CBD-SUBJECT-MAR', name: 'Marine' };

const optionsByDomain = {
  gbfTargets: [gbfTarget],
  sdgs: [sdg14, sdg15],
  subjects: [subjectMar],
};

// Offline taxonomy mock driven through the component's real load path (onMounted -> loadOptions,
// loadInitialValues -> resolveSavedValue -> lookUp). lookUp returns a single object when single=true
// so a single-value domain hydrates to one object (the CR-6 trigger), an array otherwise.
vi.mock('@/composables/use-taxonomies', () => ({
  useTaxonomies: () => ({
    getData: vi.fn(async (domain) => optionsByDomain[domain] ?? []),
    lookUp: vi.fn(async (source, keys = [], single = false) => {
      const matched = (optionsByDomain[source] ?? []).filter((o) => keys.includes(o.identifier));
      if (single) return matched[0];
      return matched;
    }),
  }),
}));

vi.mock('@/composables/use-translations', () => ({
  useTranslations: () => ({ t: (key) => key }),
}));

vi.mock('@/utils/national-targets.js', () => ({
  getNationalTargets7: vi.fn(async () => []),
}));

const { default: ScbdField } = await import('@/index.vue');

let wrapper;

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => {
    throw new Error('Network access is disabled for component tests');
  }));
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

/** Mount with the hidden Drupal input pre-seeded; await onMounted's async load + initial hydration. */
async function mountField(props, savedValue) {
  document.body.innerHTML = `<input id="edit-field-${props.name}-0-value" name="field_${props.name}[0][value]" type="hidden" value="${savedValue}" />`;
  wrapper = mount(ScbdField, { props, attachTo: document.body });
  await flushPromises();
  return wrapper;
}

/** Fire a GBF Target @select through the rendered gbfTargets multiselect (drives autoLinkRelated). */
async function selectGbfTarget() {
  const gbf = wrapper.findComponent({ name: 'vue-multiselect' });
  expect(gbf.exists()).toBe(true);
  gbf.vm.$emit('select', gbfTarget);
  await flushPromises();
}

/** Read the comma-separated keys persisted to the hidden Drupal input. */
function persistedKeys() {
  return document.querySelector('input[type="hidden"]').value.split(',').filter(Boolean);
}

describe('autoLinkRelated array guard (CR-6)', () => {
  it('does not throw when a linkable domain (sdgs) is configured single-value', async () => {
    // sdgs in singleValueDomains -> inputValue.sdgs hydrates to a single object, not an array.
    await mountField(
      { name: 'bl2_tags', domains: ['gbfTargets', 'sdgs', 'subjects'], singleValueDomains: ['sdgs'] },
      'SUSTAINABLE-DEVELOPMENT-GOAL-14',
    );

    await expect(selectGbfTarget()).resolves.not.toThrow();

    // sdgs (single-value) is skipped by the guard; subjects (array) still auto-links.
    const keys = persistedKeys();
    expect(keys).toContain('SUSTAINABLE-DEVELOPMENT-GOAL-14'); // the pre-saved single sdg, untouched
    expect(keys).toContain('CBD-SUBJECT-MAR'); // auto-linked into the subjects array
  });

  it('preserves the normal array auto-link path (add-only)', async () => {
    await mountField(
      { name: 'bl2_tags', domains: ['gbfTargets', 'sdgs', 'subjects'], singleValueDomains: [] },
      'SUSTAINABLE-DEVELOPMENT-GOAL-14',
    );

    await selectGbfTarget();

    // Pre-existing sdg-14 stays; missing sdg-15 + subject-mar are appended (de-duplicated).
    const keys = persistedKeys();
    expect(keys).toEqual(
      expect.arrayContaining([
        'SUSTAINABLE-DEVELOPMENT-GOAL-14',
        'SUSTAINABLE-DEVELOPMENT-GOAL-15',
        'CBD-SUBJECT-MAR',
      ]),
    );
  });
});
