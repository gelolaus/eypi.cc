import { Context, Next } from 'hono'
import type { Bindings } from '../lib/db'
import { ensureUserId, orgContext } from './orgContext'

export const isOrgFeature = async (c: Context<{ Bindings: Bindings }>, next: Next) => {
  const userId = await ensureUserId(c)
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  return orgContext(c, next)
}
