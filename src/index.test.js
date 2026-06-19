import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The inner component's heavy dependencies are mocked so the real ChmComponent can mount offline:
// onMounted() awaits loadOptions()/loadInitialValues(), which would otherwise hit the network.
vi.mock('@/composables/use-taxonomies', () => ({
  useTaxonomies: () => ({
    // Two options per domain so a multiselect renders for every configured domain.
    getData: vi.fn(async () => [
      { identifier: 'a', name: 'Option A' },
      { identifier: 'b', name: 'Option B' },
    ]),
    lookUp: vi.fn(async () => []),
  }),
}));

vi.mock('@/composables/use-translations', () => ({
  useTranslations: () => ({ t: (key) => key }),
}));

vi.mock('@/utils/national-targets.js', () => ({
  getNationalTargets7: vi.fn(async () => []),
}));

vi.mock('@/index.vue', async (importActual) => importActual());

const { default: App } = await import('@/index.vue');
const { default: ChmComponent } = await import('@/components/index.vue');

const INLINE_DEFAULT = ['orgTypes', 'govTypes', 'projectStatuses', 'geoScopes', 'documentTypes', 'ecosystemTypes', 'jurisdictions', 'eventStatuses'];

let wrapper;

beforeEach(() => {
  // Belt-and-suspenders: any escaped network call fails loudly instead of hanging the test.
  vi.stubGlobal('fetch', vi.fn(() => {
    throw new Error('Network access is disabled for wrapper tests');
  }));
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

describe('App wrapper — singleValueDomains forwarding (CR-3)', () => {
  it('defaults singleValueDomains to the inline default and forwards it to ChmComponent', () => {
    wrapper = mount(App, {
      props: { name: 'bl2_tags' },
      global: { stubs: { ChmComponent: true } },
    });

    const inner = wrapper.findComponent(ChmComponent);
    expect(inner.exists()).toBe(true);
    expect(inner.props('singleValueDomains')).toEqual(INLINE_DEFAULT);
  });

  it('forwards a custom singleValueDomains prop verbatim to ChmComponent', () => {
    const custom = ['govTypes', 'eventStatuses'];

    wrapper = mount(App, {
      props: { name: 'bl2_tags', singleValueDomains: custom },
      global: { stubs: { ChmComponent: true } },
    });

    expect(wrapper.findComponent(ChmComponent).props('singleValueDomains')).toEqual(custom);
  });

  it('honors the forwarded singleValueDomains end-to-end: a listed domain renders single-select', async () => {
    const custom = ['govTypes'];

    wrapper = mount(App, {
      props: {
        name: 'bl2_tags',
        // govTypes is in custom singleValueDomains (single-select); subjects is not (multi-select).
        domains: ['govTypes', 'subjects'],
        singleValueDomains: custom,
      },
      attachTo: document.body,
    });

    await flushPromises();

    const inner = wrapper.findComponent(ChmComponent);
    expect(inner.props('singleValueDomains')).toEqual(custom);

    const selects = inner.findAllComponents({ name: 'vue-multiselect' });
    const byId = Object.fromEntries(selects.map((s) => [s.props('id'), s]));
    expect(byId['bl2_tags-govTypes']).toBeDefined();
    expect(byId['bl2_tags-subjects']).toBeDefined();

    // vue-multiselect receives `:multiple` — single-value domain → false, multi-value domain → true.
    expect(byId['bl2_tags-govTypes'].props('multiple')).toBe(false);
    expect(byId['bl2_tags-subjects'].props('multiple')).toBe(true);
  });
});
