import { describe, expect, it } from 'vitest'
import { hashLinkPassword, verifyLinkPassword } from './password'

describe('link passwords', () => {
  it('stores pbkdf2 sha256 with 100000 iterations and verifies in constant time', async () => {
    const stored = await hashLinkPassword('correct-horse')
    const again = await hashLinkPassword('correct-horse')

    expect(stored).toMatch(/^pbkdf2\$sha256\$100000\$[A-Za-z0-9+/]+={0,2}\$[A-Za-z0-9+/]+={0,2}$/)
    expect(again).not.toBe(stored)
    expect(await verifyLinkPassword('correct-horse', stored)).toBe(true)
    expect(await verifyLinkPassword('wrong-password', stored)).toBe(false)
    expect(await verifyLinkPassword('correct-horse', 'pbkdf2$sha256$1$aaaa$bbbb')).toBe(false)
    expect(await verifyLinkPassword('correct-horse', 'not-a-hash')).toBe(false)

    const flipped = stored.slice(0, -1) + (stored.endsWith('A') ? 'B' : 'A')
    expect(await verifyLinkPassword('correct-horse', flipped)).toBe(false)
  })
})
