import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/index.vue', () => ({
  default: {
    name: 'MockScbdField',
    props: {
      name: { type: String, required: true },
      domains: { type: Array, default: () => [] },
      countries: { type: Array, default: () => [] },
      locale: { type: String, default: 'en' },
      locales: { type: Array, default: () => [] },
      debug: { type: Boolean, default: false },
    },
    template: `
      <div
        data-testid="scbd-field"
        :data-name="name"
        :data-domains="domains.join(',')"
        :data-countries="countries.join(',')"
        :data-locale="locale"
        :data-locales="locales.join(',')"
        :data-debug="String(debug)"
      />
    `,
  },
}))

const { default: Harness } = await import('./harness.vue')

let wrapper

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => {
    throw new Error('Network access is disabled for harness smoke tests')
  }))
  vi.stubGlobal('XMLHttpRequest', class {
    open() {
      throw new Error('Network access is disabled for harness smoke tests')
    }
  })
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
  window.location.hash = ''
  vi.unstubAllGlobals()
})

describe('dev harness smoke contract', () => {
  it('renders the default BL2 tags route without mounting the real widget', () => {
    const wrapper = mountHarness('')
    const widget = wrapper.get('[data-testid="scbd-field"]')
    const input = wrapper.get('#edit-field-bl2_tags-0-value')

    expect(wrapper.text()).toContain('BL2')
    expect(wrapper.text()).toContain('country be')
    expect(wrapper.text()).toContain('locales en, fr, nl, de')
    expect(widget.attributes('data-name')).toBe('bl2_tags')
    expect(widget.attributes('data-domains')).toBe('gbfTargets,nationalTargets7,countries,subjects,sdgs')
    expect(widget.attributes('data-countries')).toBe('be')
    expect(widget.attributes('data-locale')).toBe('en')
    expect(widget.attributes('data-locales')).toBe('en,fr,nl,de')
    expect(widget.attributes('data-debug')).toBe('true')
    expect(input.attributes('name')).toBe('field_bl2_tags[0][value]')
    expect(input.element.value).toBe('GBF-TARGET-01,ort-nt7-be-276962-2,be,CBD-SUBJECT-MAR,SUSTAINABLE-DEVELOPMENT-GOAL-14')
  })

  it('passes the BSL tags domains and Drupal input contract', () => {
    const wrapper = mountHarness('#/bsl/tags')
    const widget = wrapper.get('[data-testid="scbd-field"]')
    const input = wrapper.get('#edit-field-bsl_tags-0-value')

    expect(wrapper.text()).toContain('BSL')
    expect(widget.attributes('data-name')).toBe('bsl_tags')
    expect(widget.attributes('data-domains')).toBe('bchSubjectGroups,gbfTargets,nationalTargets7,countries')
    expect(widget.attributes('data-countries')).toBe('gt')
    expect(widget.attributes('data-locales')).toBe('en,fr,es,ru,zh,ar')
    expect(input.attributes('name')).toBe('field_bsl_tags[0][value]')
    expect(input.element.value).toBe('8431E752-F266-4823-B3DE-BF7194972FC0,GBF-TARGET-01,ort-nt7-gt-287002-1,gt')
  })

  it('derives the unused multi-domain route and preserves Drupal-style field names', () => {
    const wrapper = mountHarness('#/unused')
    const widget = wrapper.get('[data-testid="scbd-field"]')
    const input = wrapper.get('#edit-field-unused_multi-0-value')

    expect(wrapper.text()).toContain('Unused')
    expect(widget.attributes('data-name')).toBe('unused_multi')
    expect(widget.attributes('data-domains')).toBe('regions,bchSubjects,govTypes,geoScopes,jurisdictions')
    expect(widget.attributes('data-countries')).toBe('be')
    expect(widget.attributes('data-locales')).toBe('en,fr,es')
    expect(input.attributes('name')).toBe('field_unused_multi[0][value]')
    expect(input.element.value).toBe('')
  })
})

function mountHarness(hash) {
  window.location.hash = hash

  wrapper = mount(Harness, {
    attachTo: document.body,
  })

  return wrapper
}
