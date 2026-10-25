import { describe, expect, it } from 'vitest'
import { hmacIp, visitorHash } from './ipHash'

const DAY = '20261025'
const IP = '203.0.113.5'
const UA = 'Mozilla/5.0'

describe('hmacIp', () => {
  it('returns 32 hex characters', async () => {
    await expect(hmacIp('secret', IP)).resolves.toMatch(/^[0-9a-f]{32}$/)
  })

  it('stays stable for the same secret and ip', async () => {
    const first = await hmacIp('secret', IP)
    const second = await hmacIp('secret', IP)
    expect(second).toBe(first)
  })

  it('changes when the secret changes', async () => {
    const first = await hmacIp('secret-a', IP)
    const second = await hmacIp('secret-b', IP)
    expect(second).not.toBe(first)
  })

  it('changes when the ip changes', async () => {
    const first = await hmacIp('secret', IP)
    const second = await hmacIp('secret', '203.0.113.6')
    expect(second).not.toBe(first)
  })
})

describe('visitorHash', () => {
  it('returns 16 hex characters', async () => {
    await expect(visitorHash('secret', DAY, IP, UA)).resolves.toMatch(/^[0-9a-f]{16}$/)
  })

  it('stays stable for the same inputs', async () => {
    const first = await visitorHash('secret', DAY, IP, UA)
    const second = await visitorHash('secret', DAY, IP, UA)
    expect(second).toBe(first)
  })

  it('changes when the secret changes', async () => {
    const first = await visitorHash('secret-a', DAY, IP, UA)
    const second = await visitorHash('secret-b', DAY, IP, UA)
    expect(second).not.toBe(first)
  })

  it('changes when the day, ip, or user agent changes', async () => {
    const first = await visitorHash('secret', DAY, IP, UA)
    expect(await visitorHash('secret', '20261026', IP, UA)).not.toBe(first)
    expect(await visitorHash('secret', DAY, '203.0.113.6', UA)).not.toBe(first)
    expect(await visitorHash('secret', DAY, IP, 'OtherAgent')).not.toBe(first)
  })
})
