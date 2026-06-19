import { describe, expect, it } from 'vitest'
import { DEFAULT_DOMAINS, DEFAULT_SINGLE_VALUE_DOMAINS } from '@/utils/constants.js'
import Wrapper from '@/index.vue'
import InnerComponent from '@/components/index.vue'

// Resolve a Vue prop's default value whether it is declared as a factory or a literal.
const resolveDefault = (component, prop) => {
  const def = component.props[prop].default
  return typeof def === 'function' ? def() : def
}

describe('canonical domain consts', () => {
  it('DEFAULT_DOMAINS preserves the shipped membership and order', () => {
    expect(DEFAULT_DOMAINS).toEqual(['gbfTargets', 'nationalTargets7', 'countries', 'subjects', 'sdgs'])
  })

  it('DEFAULT_DOMAINS excludes the biosafety-only bchSubjectGroups domain', () => {
    expect(DEFAULT_DOMAINS).not.toContain('bchSubjectGroups')
  })

  it('DEFAULT_SINGLE_VALUE_DOMAINS holds the single-value domain membership', () => {
    expect(DEFAULT_SINGLE_VALUE_DOMAINS).toEqual([
      'orgTypes', 'govTypes', 'projectStatuses', 'geoScopes',
      'documentTypes', 'ecosystemTypes', 'jurisdictions', 'eventStatuses',
    ])
  })
})

describe('SFCs consume the canonical consts', () => {
  it('wrapper domains default deep-equals DEFAULT_DOMAINS', () => {
    expect(resolveDefault(Wrapper, 'domains')).toEqual(DEFAULT_DOMAINS)
  })

  it('inner component domains default deep-equals DEFAULT_DOMAINS', () => {
    expect(resolveDefault(InnerComponent, 'domains')).toEqual(DEFAULT_DOMAINS)
  })

  it('inner component singleValueDomains default deep-equals DEFAULT_SINGLE_VALUE_DOMAINS', () => {
    expect(resolveDefault(InnerComponent, 'singleValueDomains')).toEqual(DEFAULT_SINGLE_VALUE_DOMAINS)
  })

  it('each default is a fresh array instance, not a shared const reference', () => {
    expect(resolveDefault(Wrapper, 'domains')).not.toBe(DEFAULT_DOMAINS)
    expect(resolveDefault(InnerComponent, 'domains')).not.toBe(DEFAULT_DOMAINS)
    expect(resolveDefault(InnerComponent, 'singleValueDomains')).not.toBe(DEFAULT_SINGLE_VALUE_DOMAINS)
  })
})
