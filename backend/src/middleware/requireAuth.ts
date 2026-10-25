import { Context, Next } from 'hono'
import { readSession, sessionTokenFromCookie } from '../lib/auth/session'
import { db, getUser } from '../lib/db'
import type { Bindings } from '../lib/db'
import { reportError } from '../lib/reportError'

const SESSION_UNAVAILABLE = {
  error: {
    code: 'session_unavailable',
    message: 'Sign-in is temporarily unavailable. Try again.',
  },
} as const

export const requireAuth = async <P extends string>(
  c: Context<{ Bindings: Bindings; Variables: { userId: string; userEmail: string } }, P>,
  next: Next,
) => {
  const token = sessionTokenFromCookie(c.req.header('Cookie'), c.env)
  if (token) {
    try {
      const sessionUser = await readSession(db(c), token)
      if (!sessionUser) {
        return c.json({ error: { code: 'unauthorized', message: 'Sign in to continue.' } }, 401)
      }
      c.set('user', sessionUser)
      c.set('userId', sessionUser.id)
      c.set('userEmail', sessionUser.email)
      await next()
      return
    } catch (err) {
      reportError(c, err)
      return c.json(SESSION_UNAVAILABLE, 503)
    }
  }

  const user = await getUser(c)
  if (!user) {
    return c.json({ error: 'Unauthorized', message: 'Missing or invalid token' }, 401)
  }
  c.set('userId', user.sub)
  c.set('userEmail', user.email)
  await next()
}
