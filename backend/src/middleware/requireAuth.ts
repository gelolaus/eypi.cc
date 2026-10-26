import { Context, Next } from 'hono'
import { readSession, sessionTokenFromCookie } from '../lib/auth/session'
import { db } from '../lib/db'
import type { Bindings } from '../lib/db'
import { reportError } from '../lib/reportError'

const SESSION_UNAVAILABLE = {
  error: {
    code: 'session_unavailable',
    message: 'Sign-in is temporarily unavailable. Try again.',
  },
} as const

export const UNAUTHORIZED = {
  error: { code: 'unauthorized', message: 'Sign in to continue.' },
} as const

type AuthEnv = { Bindings: Bindings; Variables: { userId: string; userEmail: string } }

/** Load `c.var.user` from the session cookie. A missing or unknown cookie leaves the user unset. */
export async function attachSession<E extends { Bindings: Bindings }>(c: Context<E>): Promise<Response | null> {
  if (c.var.user?.id) return null
  const token = sessionTokenFromCookie(c.req.header('Cookie'), c.env)
  if (!token) return null
  try {
    const sessionUser = await readSession(db(c), token)
    if (!sessionUser) return null
    c.set('user', sessionUser)
    c.set('userId', sessionUser.id)
    c.set('userEmail', sessionUser.email)
    return null
  } catch (err) {
    reportError(c, err)
    return c.json(SESSION_UNAVAILABLE, 503)
  }
}

export const requireAuth = async <P extends string>(c: Context<AuthEnv, P>, next: Next) => {
  const unavailable = await attachSession(c)
  if (unavailable) return unavailable
  const user = c.var.user
  if (!user?.id) return c.json(UNAUTHORIZED, 401)
  c.set('userId', user.id)
  c.set('userEmail', user.email ?? '')
  await next()
}
