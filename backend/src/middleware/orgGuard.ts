import { Context, Next } from 'hono'
import type { Bindings } from '../lib/db'
import { attachSession, UNAUTHORIZED } from './requireAuth'
import { ensureUserId, orgContext } from './orgContext'

export const isOrgFeature = async (c: Context<{ Bindings: Bindings }>, next: Next) => {
  const unavailable = await attachSession(c)
  if (unavailable) return unavailable
  const userId = await ensureUserId(c)
  if (!userId) return c.json(UNAUTHORIZED, 401)

  return orgContext(c, next)
}
