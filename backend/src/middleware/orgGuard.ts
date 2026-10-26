import { Context, Next } from 'hono'
import type { Bindings } from '../lib/db'
import { attachSession, UNAUTHORIZED } from './requireAuth'
import { ensureUserId, orgContext } from './orgContext'
import { enforceConsent } from './requireConsent'

export const isOrgFeature = async (c: Context<{ Bindings: Bindings }>, next: Next) => {
  const unavailable = await attachSession(c)
  if (unavailable) return unavailable
  const userId = await ensureUserId(c)
  if (!userId) return c.json(UNAUTHORIZED, 401)

  const denied = await enforceConsent(c)
  if (denied) return denied

  return orgContext(c, next)
}
