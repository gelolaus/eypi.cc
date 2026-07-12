import { describe, it, expect } from 'vitest'
import { sanitizeReferrer, getOS, logLinkClick } from './linkAnalytics'

describe('sanitizeReferrer', () => {
  it('classifies a known platform host', () => {
    expect(sanitizeReferrer('https://m.facebook.com/x')).toBe('Facebook')
  })

  it('strips a leading www. before checking the map', () => {
    expect(sanitizeReferrer('https://www.facebook.com/somepage')).toBe('Facebook')
  })

  it('falls back to the bare hostname for an unlisted site', () => {
    expect(sanitizeReferrer('https://www.some-unlisted-site.com')).toBe('some-unlisted-site.com')
  })

  it('classifies localhost', () => {
    expect(sanitizeReferrer('http://localhost:5173/')).toBe('Localhost')
  })

  it('returns Direct for an empty or undefined referrer', () => {
    expect(sanitizeReferrer(undefined)).toBe('Direct')
    expect(sanitizeReferrer('')).toBe('Direct')
  })

  it('returns Direct for an unparseable referrer', () => {
    expect(sanitizeReferrer('not a url at all::::')).toBe('Direct')
  })
})

describe('getOS', () => {
  it('detects each known platform', () => {
    expect(getOS('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('Windows')
    expect(getOS('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe('iOS')
    expect(getOS('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)')).toBe('macOS')
    expect(getOS('Mozilla/5.0 (Linux; Android 14; Pixel 8)')).toBe('Android')
    expect(getOS('Mozilla/5.0 (X11; Linux x86_64)')).toBe('Linux')
  })

  it('returns Unknown for null or unrecognized user agents', () => {
    expect(getOS(null)).toBe('Unknown')
    expect(getOS('SomeBot/1.0')).toBe('Unknown')
  })
})

describe('logLinkClick', () => {
  it('inserts an analytics row and increments the link click count', async () => {
    const calls: { sql: string; args: unknown[] }[] = []
    const fakeClient = {
      execute: async (query: { sql: string; args: unknown[] }) => {
        calls.push(query)
        return {} as unknown
      },
    }

    await logLinkClick(fakeClient as never, {
      linkId: 'link-1',
      slug: 'abc123',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      referrer: 'Facebook',
      country: 'PH',
    })

    expect(calls).toHaveLength(2)
    expect(calls[0].sql).toContain('INSERT INTO analytics')
    expect(calls[0].args).toEqual(['link-1', 'Windows', 'PH', 'Facebook'])
    expect(calls[1].sql).toContain('UPDATE links SET clicks')
    expect(calls[1].args).toEqual(['abc123'])
  })
})
