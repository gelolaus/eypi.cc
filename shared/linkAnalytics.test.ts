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
  it('increments clicks by link id in one batch when the slug changed', async () => {
    const batches: { stmts: { sql: string; args?: unknown[] }[]; mode?: string }[] = []
    const fakeClient = {
      execute: async () => {
        throw new Error('logLinkClick must use one batch, not execute')
      },
      batch: async (stmts: { sql: string; args?: unknown[] }[], mode?: string) => {
        batches.push({ stmts, mode })
        return []
      },
    }

    await logLinkClick(fakeClient as never, {
      linkId: 'link-1',
      slug: 'renamed-away',
      os: 'Windows',
      country: 'PH',
      referrer: 'Facebook',
      source: 'qr',
      visitorHash: '0123456789abcdef',
    })

    expect(batches).toHaveLength(1)
    expect(batches[0].mode).toBe('write')
    expect(batches[0].stmts).toHaveLength(2)
    expect(batches[0].stmts[0].sql).toContain('INSERT INTO analytics')
    expect(batches[0].stmts[0].args).toEqual([
      'link-1',
      'Windows',
      'PH',
      'Facebook',
      '0123456789abcdef',
      'qr',
    ])
    expect(batches[0].stmts[1].sql).toContain('UPDATE links SET clicks')
    expect(batches[0].stmts[1].sql).toContain('WHERE id = ?')
    expect(batches[0].stmts[1].args).toEqual(['link-1'])
  })
})
