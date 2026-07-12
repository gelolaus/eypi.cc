import { describe, it, expect, vi } from 'vitest'
import { sign } from 'hono/jwt'
import { requireAuth } from './requireAuth'

const JWT_SECRET = 'test-secret'

function makeContext(headers: Record<string, string>) {
  const vars: Record<string, unknown> = {}
  return {
    req: { header: (k: string) => headers[k] },
    env: { JWT_SECRET },
    set: (key: string, value: unknown) => { vars[key] = value },
    var: vars,
    json: (body: unknown, status: number) => ({ body, status }),
  }
}

describe('requireAuth', () => {
  it('calls next and sets userId/userEmail for a valid token', async () => {
    const token = await sign(
      { sub: 'user-1', email: 'user@student.apc.edu.ph', exp: Math.floor(Date.now() / 1000) + 3600 },
      JWT_SECRET,
    )
    const c = makeContext({ Authorization: `Bearer ${token}` })
    const next = vi.fn(async () => {})

    await requireAuth(c as never, next)

    expect(next).toHaveBeenCalledOnce()
    expect(c.var.userId).toBe('user-1')
    expect(c.var.userEmail).toBe('user@student.apc.edu.ph')
  })

  it('returns 401 without calling next when the Authorization header is missing', async () => {
    const c = makeContext({})
    const next = vi.fn(async () => {})

    const result = await requireAuth(c as never, next)

    expect(next).not.toHaveBeenCalled()
    expect(result).toEqual({
      body: { error: 'Unauthorized', message: 'Missing or invalid token' },
      status: 401,
    })
  })

  it('returns 401 for a malformed token', async () => {
    const c = makeContext({ Authorization: 'Bearer not-a-real-jwt' })
    const next = vi.fn(async () => {})

    await requireAuth(c as never, next)

    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 for an expired token', async () => {
    const token = await sign(
      { sub: 'user-1', email: 'user@student.apc.edu.ph', exp: Math.floor(Date.now() / 1000) - 10 },
      JWT_SECRET,
    )
    const c = makeContext({ Authorization: `Bearer ${token}` })
    const next = vi.fn(async () => {})

    await requireAuth(c as never, next)

    expect(next).not.toHaveBeenCalled()
  })
})
