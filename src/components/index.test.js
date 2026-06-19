import { flushPromises, mount } from '@vue/test-utils'
import Multiselect from 'vue-multiselect'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// SCBD vocabularies are closed: the widget must never offer a create-a-tag
// affordance. These mocks keep the mount network-free (mirrors src/dev/harness.smoke.test.js)
// while giving one domain a non-empty option list so the <multiselect> actually renders.
const getData = vi.fn(async () => [{ identifier: 'CBD-SUBJECT-MAR', name: 'Marine' }])
const lookUp = vi.fn(async () => [])

vi.mock('@/composables/use-taxonomies', () => ({
  useTaxonomies: () => ({ getData, lookUp }),
}))

vi.mock('@/composables/use-translations', () => ({
  useTranslations: () => ({ t: (key) => key }),
}))

vi.mock('@/utils/national-targets.js', () => ({
  getNationalTargets7: vi.fn(async () => []),
}))

const { default: ScbdField } = await import('./index.vue')

let wrapper

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => {
    throw new Error('Network access is disabled for this unit test')
  }))
  vi.stubGlobal('XMLHttpRequest', class {
    open() {
      throw new Error('Network access is disabled for this unit test')
    }
  })
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.unstubAllGlobals()
})

describe('scbd-field taggable contract (CR-7)', () => {
  it('renders the vue-multiselect with taggable disabled', async () => {
    wrapper = mount(ScbdField, {
      props: { name: 'bl2_tags', domains: ['subjects'] },
    })
    await flushPromises()

    const multiselect = wrapper.findComponent(Multiselect)
    expect(multiselect.exists()).toBe(true)
    expect(multiselect.props('taggable')).toBe(false)
  })

  it('exposes no tag-create affordance even with an open dropdown and a no-match query', async () => {
    wrapper = mount(ScbdField, {
      props: { name: 'bl2_tags', domains: ['subjects'] },
      attachTo: document.body,
    })
    await flushPromises()

    // Drive the multiselect into the exact state where vue-multiselect injects the
    // "create a tag" option: dropdown OPEN + a search query that matches no existing
    // option. With :taggable="true" this would render an <li> whose option carries
    // data-select="Press enter to create a tag"; with :taggable="false" it must not.
    const multiselect = wrapper.findComponent(Multiselect)
    await multiselect.find('.multiselect').trigger('focus')
    const search = multiselect.find('input.multiselect__input')
    await search.setValue('zzz-no-such-subject-zzz')
    await flushPromises()

    // Guard the test itself: confirm we actually opened the dropdown and produced a
    // no-match query (otherwise the assertion below would pass vacuously / non-bitingly).
    expect(multiselect.find('.multiselect__content-wrapper').exists()).toBe(true)
    expect(search.element.value).toBe('zzz-no-such-subject-zzz')

    // The actual contract: no create-a-tag option, no created-tag remove icon.
    expect(multiselect.find('[data-select="Press enter to create a tag"]').exists()).toBe(false)
    expect(wrapper.find('.multiselect__tag-icon').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Press enter to create a tag')
  })
})
