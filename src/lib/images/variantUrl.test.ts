import { describe, expect, it } from 'vitest'
import { variantKey } from '../../../backend/src/lib/media'
import { variantUrl } from './variantUrl'

const FIXTURES: Array<{ key: string; width: number; fmt: 'webp' | 'jpeg' | 'png'; expected: string }> = [
  { key: 'orgs/jpcs/logo-0a1b2c3d.png', width: 96, fmt: 'webp', expected: 'orgs/jpcs/logo-0a1b2c3d-96.webp' },
  { key: 'orgs/jpcs/banner-0a1b2c3d.jpg', width: 1280, fmt: 'jpeg', expected: 'orgs/jpcs/banner-0a1b2c3d-1280.jpg' },
  { key: 'frames/camp-1/f-1-deadbeef.png', width: 256, fmt: 'png', expected: 'frames/camp-1/f-1-deadbeef-256.png' },
  { key: 'dir.with.dots/noext', width: 512, fmt: 'webp', expected: 'dir.with.dots/noext-512.webp' },
]

describe('variantUrl', () => {
  it.each(FIXTURES)('matches the backend variantKey for $key', ({ key, width, fmt, expected }) => {
    expect(variantKey(key, width, fmt)).toBe(expected)
    expect(variantUrl(key, width, fmt)).toBe(expected)
    expect(variantUrl(`/media/${key}`, width, fmt)).toBe(`/media/${expected}`)
  })

  it('leaves the host and path of absolute urls alone', () => {
    expect(variantUrl('https://eypi.cc/media/orgs/a/logo-0a1b2c3d.png', 192, 'webp'))
      .toBe('https://eypi.cc/media/orgs/a/logo-0a1b2c3d-192.webp')
  })
})
