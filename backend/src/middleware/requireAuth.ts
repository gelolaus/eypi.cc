import { Context, Next } from 'hono'
import { getUser } from '../lib/db'
import type { Bindings } from '../lib/db'

export const requireAuth = async (
  c: Context<{ Bindings: Bindings; Variables: { userId: string; userEmail: string } }>,
  next: Next,
) => {
  const user = await getUser(c as any)
  if (!user) {
    return c.json({ error: 'Unauthorized', message: 'Missing or invalid token' }, 401)
  }
  c.set('userId', user.sub)
  c.set('userEmail', user.email)
  await next()
}
