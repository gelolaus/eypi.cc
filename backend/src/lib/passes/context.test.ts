import { describe, it, expect } from 'vitest'
import { sign } from 'hono/jwt'
import { signPassToken, verifyPassToken } from './context'
import type { Bindings } from '../db'

const JWT_SECRET = 'jwt-secret'
const PASS_TOKEN_SECRET = 'pass-secret'

function env(): Bindings {
  return { JWT_SECRET, PASS_TOKEN_SECRET } as unknown as Bindings
}

function passClaims(slug: string) {
  return {
    typ: 'pass' as const,
    sub: 'attendee-1',
    eventId: 'event-1',
    slug,
    exp: Math.floor(Date.now() / 1000) + 900,
  }
}

describe('verifyPassToken', () => {
  it('rejects a pass token signed with JWT_SECRET', async () => {
    const token = await sign(passClaims('launch'), JWT_SECRET)
    expect(await verifyPassToken(env(), token, 'launch')).toBeNull()
  })

  it('accepts a pass token signed with PASS_TOKEN_SECRET for the matching slug', async () => {
    const token = await signPassToken(env(), { attendeeId: 'attendee-1', eventId: 'event-1', slug: 'launch' })
    const payload = await verifyPassToken(env(), token, 'launch')
    expect(payload).toMatchObject({
      typ: 'pass',
      sub: 'attendee-1',
      eventId: 'event-1',
      slug: 'launch',
    })
  })

  it('rejects a pass token for another slug', async () => {
    const token = await signPassToken(env(), { attendeeId: 'attendee-1', eventId: 'event-1', slug: 'launch' })
    expect(await verifyPassToken(env(), token, 'launch')).not.toBeNull()
    expect(await verifyPassToken(env(), token, 'other')).toBeNull()
  })
})
