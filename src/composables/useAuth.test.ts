import { describe, it, expect, afterEach, vi } from 'vitest'
import { useAuth } from './useAuth'

function makeToken(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = btoa(JSON.stringify(payload))
  return `${header}.${body}.fake-signature`
}

function stubToken(token: string | null) {
  const store: Record<string, string> = {}
  if (token) store.eypi_token = token
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useAuth().getUser', () => {
  it('returns the decoded payload for a valid, non-expired token', () => {
    stubToken(makeToken({ sub: 'user-1', email: 'user@student.apc.edu.ph', exp: Math.floor(Date.now() / 1000) + 3600 }))

    expect(useAuth().getUser()).toEqual({
      sub: 'user-1',
      email: 'user@student.apc.edu.ph',
      exp: expect.any(Number),
    })
  })

  it('returns null for an expired token', () => {
    stubToken(makeToken({ sub: 'user-1', email: 'user@student.apc.edu.ph', exp: Math.floor(Date.now() / 1000) - 10 }))

    expect(useAuth().getUser()).toBeNull()
  })

  it('returns null for a malformed token (wrong number of segments)', () => {
    stubToken('not-a-jwt')

    expect(useAuth().getUser()).toBeNull()
  })

  it('returns null for a token whose payload segment is not valid base64/JSON', () => {
    stubToken('aGVhZGVy.not-valid-base64!!.signature')

    expect(useAuth().getUser()).toBeNull()
  })

  it('returns null when there is no token', () => {
    stubToken(null)

    expect(useAuth().getUser()).toBeNull()
  })
})
