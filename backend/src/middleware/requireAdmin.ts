import type { MiddlewareHandler } from 'hono'
import type { Bindings } from '../lib/db'

export const ADMIN_ONLY_MESSAGE = 'Admin access is required.'

export const requireAdmin: MiddlewareHandler<{ Bindings: Bindings }> = async (c, next) => {
  if (c.var.user?.role !== 'admin') {
    return c.json({ error: { code: 'admin_only', message: ADMIN_ONLY_MESSAGE } }, 403)
  }
  await next()
}
