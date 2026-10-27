import { describe, expect, it } from 'vitest'
import { validateDestination } from './urlSafety'

type Expectation =
  | { ok: true; url: string }
  | {
    ok: false
    code: 'invalid_url' | 'blocked_host' | 'self_link' | 'shortener' | 'userinfo' | 'private_address'
  }

const cases: Array<[string, Expectation]> = [
  ['https://example.com/a', { ok: true, url: 'https://example.com/a' }],
  ['example.com/a', { ok: true, url: 'https://example.com/a' }],
  ['https://8.8.8.8/dns', { ok: true, url: 'https://8.8.8.8/dns' }],
  ['https://172.15.0.1/x', { ok: true, url: 'https://172.15.0.1/x' }],
  ['https://eypi.cc.evil.tld/a', { ok: true, url: 'https://eypi.cc.evil.tld/a' }],
  ['https://noteypi.cc/a', { ok: true, url: 'https://noteypi.cc/a' }],
  ['', { ok: false, code: 'invalid_url' }],
  ['javascript:alert(1)', { ok: false, code: 'invalid_url' }],
  ['ftp://example.com/a', { ok: false, code: 'invalid_url' }],
  ['https://apc.edu.ph@evil.tld/phish', { ok: false, code: 'userinfo' }],
  ['https://user:pass@example.com/a', { ok: false, code: 'userinfo' }],
  ['https://eypi.cc/x', { ok: false, code: 'self_link' }],
  ['https://WWW.eypi.cc/x', { ok: false, code: 'self_link' }],
  ['https://docs.eypi.cc/x', { ok: false, code: 'self_link' }],
  ['https://bit.ly/abc', { ok: false, code: 'shortener' }],
  ['https://www.tinyurl.com/abc', { ok: false, code: 'shortener' }],
  ['http://127.0.0.1/admin', { ok: false, code: 'private_address' }],
  ['http://10.1.2.3/', { ok: false, code: 'private_address' }],
  ['http://192.168.1.1/', { ok: false, code: 'private_address' }],
  ['http://169.254.169.254/latest', { ok: false, code: 'private_address' }],
  ['http://2130706433', { ok: false, code: 'private_address' }],
  ['http://0x7f000001', { ok: false, code: 'private_address' }],
  ['http://0177.0.0.1/', { ok: false, code: 'private_address' }],
  ['http://[::1]/', { ok: false, code: 'private_address' }],
  ['http://[::ffff:127.0.0.1]/', { ok: false, code: 'private_address' }],
  ['https://eypi.cc./x', { ok: false, code: 'self_link' }],
  ['https://bit.ly./abc', { ok: false, code: 'shortener' }],
  ['http://[::]/', { ok: false, code: 'private_address' }],
  ['http://[fe80::1]/', { ok: false, code: 'private_address' }],
  ['http://[febf::1]/', { ok: false, code: 'private_address' }],
  ['http://[ff02::1]/', { ok: false, code: 'private_address' }],
  ['http://[64:ff9b::7f00:1]/', { ok: false, code: 'private_address' }],
  ['http://224.0.0.1/', { ok: false, code: 'private_address' }],
  ['http://255.255.255.255/', { ok: false, code: 'private_address' }],
  ['http://198.18.0.1/', { ok: false, code: 'private_address' }],
  ['http://192.0.0.8/', { ok: false, code: 'private_address' }],
  ['http://localhost./admin', { ok: false, code: 'blocked_host' }],
  ['http://metadata.internal/x', { ok: false, code: 'blocked_host' }],
  ['http://localhost/admin', { ok: false, code: 'blocked_host' }],
  ['http://printer.local/status', { ok: false, code: 'blocked_host' }],
]

describe('validateDestination', () => {
  it.each(cases)('%j', (input, want) => {
    expect(validateDestination(input, { selfHosts: ['eypi.cc'] })).toEqual(want)
  })
})
