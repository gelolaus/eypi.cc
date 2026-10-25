const BLOCKED_PROTOCOL_RE =
  /^\s*(javascript|data|vbscript|file|blob|about|chrome|chrome-extension):/i

const SHORTENERS = [
  'bit.ly',
  'tinyurl.com',
  'goo.gl',
  'ow.ly',
  't.co',
  'is.gd',
  'buff.ly',
  'cutt.ly',
  'rebrand.ly',
  'shorturl.at',
  'tiny.cc',
  'rb.gy',
  'short.io',
  't.ly',
  'adf.ly',
  'bit.do',
  'j.mp',
  'cur.lv',
  'ity.im',
  'q.gs',
  'po.st',
  'bc.vc',
  'soo.gd',
  's.id',
  'v.gd',
  'clck.ru',
  'lnkd.in',
  'db.tt',
  'qr.ae',
  'tr.im',
  'u.to',
  'short.link',
  'bl.ink',
]

export type DestinationCode =
  | 'invalid_url'
  | 'blocked_host'
  | 'self_link'
  | 'shortener'
  | 'userinfo'
  | 'private_address'

export type DestinationResult =
  | { ok: true; url: string }
  | { ok: false; code: DestinationCode }

function parseIpv4Octets(host: string): number[] | null {
  if (/^\d+$/.test(host)) {
    const n = Number(host)
    if (!Number.isInteger(n) || n < 0 || n > 0xffffffff) return null
    return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]
  }

  if (/^0x[0-9a-f]+$/i.test(host)) {
    const n = Number(host)
    if (!Number.isInteger(n) || n < 0 || n > 0xffffffff) return null
    return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]
  }

  const parts = host.split('.')
  if (parts.length !== 4) return null

  const octets: number[] = []
  for (const part of parts) {
    if (!/^(0|[1-9]\d*|0[0-7]+|0x[0-9a-f]+)$/i.test(part)) return null
    const value = part.startsWith('0') && !part.toLowerCase().startsWith('0x') && part !== '0'
      ? Number.parseInt(part, 8)
      : Number(part)
    if (!Number.isInteger(value) || value < 0 || value > 255) return null
    octets.push(value)
  }
  return octets
}

function isPrivateIpv4(octets: number[]): boolean {
  const [a, b] = octets
  if (a === 127) return true
  if (a === 10) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 169 && b === 254) return true
  if (a === 0) return true
  if (a === 100 && b >= 64 && b <= 127) return true
  return false
}

function isPrivateIpv6(host: string): boolean {
  const h = host.toLowerCase()
  if (h === '::1') return true
  if (h.startsWith('fe80:')) return true
  if (h.startsWith('fc') || h.startsWith('fd')) return true

  const mappedMatch = h.match(/^::ffff:(.+)$/)
  if (mappedMatch) {
    const tail = mappedMatch[1] ?? ''
    if (tail.includes('.')) {
      const octets = parseIpv4Octets(tail)
      return octets !== null && isPrivateIpv4(octets)
    }
    const hexParts = tail.split(':').filter(Boolean)
    if (hexParts.length === 2) {
      const high = Number.parseInt(hexParts[0] ?? '', 16)
      const low = Number.parseInt(hexParts[1] ?? '', 16)
      if (Number.isInteger(high) && Number.isInteger(low)) {
        return isPrivateIpv4([(high >> 8) & 0xff, high & 0xff, (low >> 8) & 0xff, low & 0xff])
      }
    }
  }

  return false
}

function hostKey(hostname: string): string {
  return hostname.toLowerCase().replace(/^\[|\]$/g, '')
}

function isShortener(hostname: string): boolean {
  const host = hostname.replace(/^www\./, '')
  return SHORTENERS.some((name) => host === name || host.endsWith(`.${name}`))
}

function isSelfHost(hostname: string, selfHosts: readonly string[]): boolean {
  return selfHosts.some((entry) => {
    const host = entry.toLowerCase()
    return hostname === host || hostname.endsWith(`.${host}`)
  })
}

function isNameBlocked(hostname: string): boolean {
  return hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')
}

export function validateDestination(url: string, opts: { selfHosts: readonly string[] }): DestinationResult {
  const trimmed = url.trim()
  if (!trimmed || BLOCKED_PROTOCOL_RE.test(trimmed)) return { ok: false, code: 'invalid_url' }

  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`
  let parsed: URL
  try {
    parsed = new URL(candidate)
  } catch {
    return { ok: false, code: 'invalid_url' }
  }

  if (parsed.username !== '' || parsed.password !== '') return { ok: false, code: 'userinfo' }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return { ok: false, code: 'invalid_url' }

  const hostname = hostKey(parsed.hostname)
  if (!hostname) return { ok: false, code: 'invalid_url' }
  if (isShortener(hostname)) return { ok: false, code: 'shortener' }
  if (isSelfHost(hostname, opts.selfHosts)) return { ok: false, code: 'self_link' }

  if (hostname.includes(':')) {
    if (isPrivateIpv6(hostname)) return { ok: false, code: 'private_address' }
  } else {
    const octets = parseIpv4Octets(hostname)
    if (octets) {
      if (isPrivateIpv4(octets)) return { ok: false, code: 'private_address' }
    } else if (isNameBlocked(hostname)) {
      return { ok: false, code: 'blocked_host' }
    }
  }

  const normalized = candidate.replace(/^[a-z][a-z0-9+.-]*:/i, (scheme) => scheme.toLowerCase())
  return { ok: true, url: normalized }
}
