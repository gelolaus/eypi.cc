import { describe, it, expect } from 'vitest'
import { sanitizeReferrer, getOS, logLinkClick, parseUserAgent } from './linkAnalytics'

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
      device: 'mobile',
      browser: 'Safari',
      app: 'messenger',
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
      'mobile',
      'Safari',
      'messenger',
    ])
    expect(batches[0].stmts[1].sql).toContain('UPDATE links SET clicks')
    expect(batches[0].stmts[1].sql).toContain('WHERE id = ?')
    expect(batches[0].stmts[1].args).toEqual(['link-1'])
  })
})

describe('parseUserAgent', () => {
  const cases: [string, string, string][] = [
    ['iphone messenger', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/450.0.0.38.108;FBBV/564431005;FBDV/iPhone14,5]', 'mobile/Safari/messenger'],
    ['android facebook', 'Mozilla/5.0 (Linux; Android 13; SM-A135F Build/TP1A) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/121.0.6167.143 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/450.0.0.38.108;]', 'mobile/Chrome/facebook'],
    ['instagram', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 320.0.0.12.108 (iPhone14,5)', 'mobile/Safari/instagram'],
    ['tiktok', 'Mozilla/5.0 (Linux; Android 12; V2118 Build/SP1A) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/110.0.5481.153 Mobile Safari/537.36 musical_ly_2023 BytedanceWebview/d8a21c6', 'mobile/Chrome/tiktok'],
    ['line', 'Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 Line/13.5.0', 'mobile/Chrome/line'],
    ['discord', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Discord/200.0', 'mobile/Safari/discord'],
    ['x', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Twitter for iPhone', 'mobile/Safari/x'],
    ['ipad', 'Mozilla/5.0 (iPad; CPU OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1', 'tablet/Safari/'],
    ['edge desktop', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0', 'desktop/Edge/'],
    ['samsung internet', 'Mozilla/5.0 (Linux; Android 13; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36', 'mobile/Samsung/'],
    ['firefox desktop', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0', 'desktop/Firefox/'],
    ['opera', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 OPR/107.0.0.0', 'desktop/Opera/'],
    ['android tablet chrome', 'Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36', 'tablet/Chrome/'],
    ['chrome desktop', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36', 'desktop/Chrome/'],
    ['unrecognized', 'SomeBot/1.0', 'desktop/Other/'],
  ]

  it.each(cases)('parses %s', (_name, ua, expected) => {
    const r = parseUserAgent(ua)
    expect(`${r.device}/${r.browser}/${r.app ?? ''}`).toBe(expected)
  })

  it('empty user agent', () => {
    expect(parseUserAgent(null)).toEqual({ device: 'desktop', browser: 'Other', app: null })
    expect(parseUserAgent('')).toEqual({ device: 'desktop', browser: 'Other', app: null })
  })
})
