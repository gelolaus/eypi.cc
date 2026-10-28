import { describe, expect, it } from 'vitest'
import { sectionIds } from './sectionId'

describe('sectionIds', () => {
  it('slugs headings', () => {
    expect(sectionIds(['Who we are', '  Your Rights & Choices! '])).toEqual([
      'who-we-are',
      'your-rights-choices',
    ])
  })

  it('de-duplicates repeated headings', () => {
    expect(sectionIds(['Cookies', 'Cookies', 'Cookies'])).toEqual([
      'cookies',
      'cookies-2',
      'cookies-3',
    ])
  })

  it('handles punctuation-only headings', () => {
    expect(sectionIds(['???', '---'])).toEqual(['s-', 's--2'])
  })
})
