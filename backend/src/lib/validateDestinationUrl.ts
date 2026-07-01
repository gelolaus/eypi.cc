const BLOCKED_PROTOCOL_RE =
  /^\s*(javascript|data|vbscript|file|blob|about|chrome|chrome-extension):/i

function parseIpv4Octets(host: string): number[] | null {
  // Decimal integer form: 2130706433
  if (/^\d+$/.test(host)) {
    const n = Number(host)
    if (!Number.isInteger(n) || n < 0 || n > 0xffffffff) return null
    return [
      (n >>> 24) & 0xff,
      (n >>> 16) & 0xff,
      (n >>> 8) & 0xff,
      n & 0xff,
    ]
  }

  // Hex integer form: 0x7f000001
  if (/^0x[0-9a-f]+$/i.test(host)) {
    const n = Number(host)
    if (!Number.isInteger(n) || n < 0 || n > 0xffffffff) return null
    return [
      (n >>> 24) & 0xff,
      (n >>> 16) & 0xff,
      (n >>> 8) & 0xff,
      n & 0xff,
    ]
  }

  const parts = host.split('.')
  if (parts.length !== 4) return null

  const octets: number[] = []
  for (const part of parts) {
    if (!/^(0|[1-9]\d*|0[0-7]+|0x[0-9a-f]+)$/i.test(part)) return null
    const value = Number(part)
    if (!Number.isInteger(value) || value < 0 || value > 255) return null
    octets.push(value)
  }
  return octets
}

function isPrivateIpv4(octets: number[]): boolean {
  const [a, b] = octets
  if (a === 127) return true // 127.0.0.0/8 loopback
  if (a === 10) return true // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true // 172.16.0.0/12
  if (a === 192 && b === 168) return true // 192.168.0.0/16
  if (a === 169 && b === 254) return true // 169.254.0.0/16 link-local / metadata
  if (a === 0) return true // 0.0.0.0/8
  if (a === 100 && b >= 64 && b <= 127) return true // 100.64.0.0/10 CGNAT
  return false
}

function isPrivateIpv6(host: string): boolean {
  const h = host.toLowerCase()
  if (h === '::1') return true
  if (h.startsWith('fe80:')) return true // fe80::/10 link-local
  if (h.startsWith('fc') || h.startsWith('fd')) return true // fc00::/7 ULA

  // IPv4-mapped IPv6: ::ffff:127.0.0.1 or ::ffff:7f00:1
  const mappedMatch = h.match(/^::ffff:(.+)$/)
  if (mappedMatch) {
    const tail = mappedMatch[1]
    if (tail.includes('.')) {
      const octets = parseIpv4Octets(tail)
      return octets !== null && isPrivateIpv4(octets)
    }
    const hexParts = tail.split(':').filter(Boolean)
    if (hexParts.length === 2) {
      const high = parseInt(hexParts[0], 16)
      const low = parseInt(hexParts[1], 16)
      if (Number.isInteger(high) && Number.isInteger(low)) {
        return isPrivateIpv4([(high >> 8) & 0xff, high & 0xff, (low >> 8) & 0xff, low & 0xff])
      }
    }
  }

  return false
}

function isBlockedHostname(hostname: string): boolean {
  if (!hostname) return true

  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '')

  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) {
    return true
  }

  if (host.includes(':')) {
    return isPrivateIpv6(host)
  }

  const octets = parseIpv4Octets(host)
  if (octets) {
    return isPrivateIpv4(octets)
  }

  return false
}

export function validateDestinationUrl(url: string): boolean {
  const trimmed = url.trim()
  if (!trimmed) return false

  if (BLOCKED_PROTOCOL_RE.test(trimmed)) return false

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return false
  }

  const protocol = parsed.protocol.toLowerCase()
  if (protocol !== 'http:' && protocol !== 'https:') return false

  return !isBlockedHostname(parsed.hostname)
}
