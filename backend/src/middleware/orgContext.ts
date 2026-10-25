import type { Context, Next } from 'hono'
import { db, getUserOrgId, type Bindings } from '../lib/db'

declare module 'hono' {
  interface ContextVariableMap {
    orgId?: string
    userId?: string
    userEmail?: string
    user?: { id: string; email?: string; name?: string; role?: string }
  }
}

export const ORG_NOT_ACCESSIBLE_MESSAGE = 'You do not have access to that organization.'
export const NO_ORG_MESSAGE = 'You need an active organization membership to continue.'
export const INVITES_PATH = '/invites'

export function orgNotAccessibleBody() {
  return {
    error: {
      code: 'org_not_accessible',
      message: ORG_NOT_ACCESSIBLE_MESSAGE,
    },
  }
}

export function noOrgBody() {
  return {
    error: {
      code: 'no_org',
      message: NO_ORG_MESSAGE,
    },
    action_url: INVITES_PATH,
  }
}

export async function ensureUserId(c: Context<{ Bindings: Bindings }>): Promise<string | null> {
  if (c.var.userId) return c.var.userId
  const sessionUser = c.var.user
  if (sessionUser?.id) {
    c.set('userId', sessionUser.id)
    if (sessionUser.email) c.set('userEmail', sessionUser.email)
    return sessionUser.id
  }
  return null
}

// Resolves the active org once per request. A named header the user cannot
// access is rejected. With no header, the first accessible org by name is used.
// Owners and activated members count. Pending memberships do not.
// When no user is on the context, the request continues so public routes stay public.
export const orgContext = async (c: Context<{ Bindings: Bindings }>, next: Next) => {
  const userId = await ensureUserId(c)
  if (!userId) {
    await next()
    return
  }

  const header = c.req.header('X-Active-Org-Id')?.trim()
  const requestedOrgId = header || undefined
  const orgId = await getUserOrgId(db(c), userId, requestedOrgId)

  if (requestedOrgId && orgId !== requestedOrgId) {
    return c.json(orgNotAccessibleBody(), 403)
  }
  if (!orgId) return c.json(noOrgBody(), 403)

  c.set('orgId', orgId)
  await next()
}
