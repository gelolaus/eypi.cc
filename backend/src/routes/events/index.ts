import { Hono } from 'hono'
import type { Bindings } from '../../lib/db'
import { orgContext } from '../../middleware/orgContext'
import { enforceConsent } from '../../middleware/requireConsent'
import { attachSession } from '../../middleware/requireAuth'
import manage from './manage'
import inbox from './inbox'
import importRoutes from './import'
import door from './door'
import publicRoutes from './public'
import registrations from './registrations'
import lottery from './lottery'
import guests from './guests'

// Ticketing routes (formerly the tix.eypi.cc backend). Mounted into the unified
// eypi.cc Worker in index.ts. CORS, preflight, and security headers are applied
// centrally there, so this module only declares the /api/events/* handlers.
const app = new Hono<{ Bindings: Bindings }>()

// Student registration is open to any signed-in user, not just org members.
function eventRouteIsStudent(path: string): boolean {
  return /^\/api\/events\/[^/]+\/(register|registration)$/.test(path)
}

function eventRouteUsesOrg(path: string): boolean {
  if (eventRouteIsStudent(path)) return false
  if (path === '/api/events') return true
  if (!path.startsWith('/api/events/')) return false
  if (path.endsWith('/passes/google')) return false
  return true
}

// Scoped: this router is mounted at '/', so a bare '*' would run session and
// org lookups for every public route in the API.
app.use('/api/events/*', async (c, next) => {
  const unavailable = await attachSession(c)
  if (unavailable) return unavailable
  if (eventRouteIsStudent(c.req.path)) {
    if (!c.var.userId) return c.json({ error: { code: 'unauthorized', message: 'Sign in to continue.' } }, 401)
    const denied = await enforceConsent(c)
    if (denied) return denied
    await next()
    return
  }
  if (!eventRouteUsesOrg(c.req.path)) {
    await next()
    return
  }
  if (c.var.userId) {
    const denied = await enforceConsent(c)
    if (denied) return denied
  }
  return orgContext(c, next)
})

// guests registers /attendees.csv and /attendees/:id/guest-link ahead of any parametrised attendee route.
app.route('/', guests)
app.route('/', inbox)
app.route('/', lottery)
app.route('/', manage)
app.route('/', importRoutes)
app.route('/', door)
app.route('/', publicRoutes)
app.route('/', registrations)

export default app
