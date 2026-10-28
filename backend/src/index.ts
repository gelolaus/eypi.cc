import { createClient } from '@libsql/client/web'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { runRetention } from './jobs/retention'
import { runHourlyRollups } from './jobs/rollups'
import { db, type Bindings } from './lib/db'
import { onError } from './lib/errors'
import { missingRequiredEnv, requiredEnvError } from './lib/env'
import { reportError } from './lib/reportError'
import { allowedOrigins, csrf } from './middleware/csrf'
import adminMigrationRoutes from './routes/adminMigrations'
import adminRoutes from './routes/admin'
import authMicrosoft from './routes/authMicrosoft'
import legalRoutes from './routes/legal'
import linkRoutes from './routes/links'
import accountRoutes from './routes/account'
import mediaVariantRoutes from './routes/mediaVariants'
import meRoutes from './routes/me'
import reportRoutes from './routes/reports'
import rumRoutes from './routes/rum'
import eventRoutes from './routes/events'
import dpRoutes from './routes/dp'
import orgsRoutes from './routes/orgs'
import formsRoutes from './routes/forms'
import statsRoutes from './routes/stats'

const app = new Hono<{ Bindings: Bindings }>()

// CORS so the eypi.cc SPA can talk to this API (must be first middleware).
// Everything now lives under one origin (eypi.cc) plus localhost for dev.
app.use('/api/*', cors({
  origin: (origin, c) => {
    const allowed = allowedOrigins(c.env.ENVIRONMENT)
    return allowed.includes(origin) ? origin : null
  },
  allowHeaders: ['Content-Type', 'X-Active-Org-Id'],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
  maxAge: 86400,
}))

// Explicit OPTIONS handler for preflight requests
app.options('*', (c) => c.body(null, 204))

// Security headers on every response
app.use('*', async (c, next) => {
  await next()
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('X-Frame-Options', 'DENY')
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin')
  c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
  // API responses only — do not deny camera here; the SPA sets its own policy via _headers.
  c.header('Permissions-Policy', 'microphone=(), geolocation=()')
  c.header('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'")
})

app.get('/', (c) => c.text('eypi.cc API is online.'))
app.get('/api/health', async (c) => {
  const missing = missingRequiredEnv(c.env)
  if (missing.length) {
    return c.text(requiredEnvError(missing), 503)
  }
  try {
    await db(c).execute({ sql: 'SELECT 1' })
  } catch (err) {
    reportError(c, err)
    return c.json({ ok: false, db: false }, 503)
  }
  return c.json({ ok: true, db: true })
})

// Unsafe methods need an allowlisted Origin. Safe methods pass through.
app.use('/api/*', csrf)

// Mount feature routers. Each declares its own full /api/... paths.
app.route('/', authMicrosoft)
app.route('/', meRoutes)
app.route('/', accountRoutes)
app.route('/', mediaVariantRoutes)
app.route('/', legalRoutes)
app.route('/', linkRoutes)
app.route('/', reportRoutes)
app.route('/', rumRoutes)
app.route('/', eventRoutes)
app.route('/', dpRoutes)
app.route('/api/orgs', orgsRoutes)
app.route('/', formsRoutes)
app.route('/', statsRoutes)
app.route('/', adminMigrationRoutes)
app.route('/', adminRoutes)

app.notFound((c) => c.json({ error: { code: 'not_found', message: 'Not found' } }, 404))

app.all('*', (c) => c.json({ error: { code: 'not_found', message: 'Not found' } }, 404))

app.onError(onError)

const HOURLY_CRON = '15 * * * *'

async function scheduled(controller: ScheduledController, env: Bindings): Promise<void> {
  const hourly = controller.cron === HOURLY_CRON
  try {
    const client = createClient({
      url: env.TURSO_DATABASE_URL,
      authToken: env.TURSO_AUTH_TOKEN,
    })
    if (hourly) await runHourlyRollups(client, new Date())
    else await runRetention(client, new Date())
  } catch (err) {
    reportError(
      { req: { path: hourly ? '/scheduled/rollups' : '/scheduled/retention', header: () => undefined } },
      err,
      hourly
        ? { code: 'rollups_failed', message: 'Hourly rollups failed.' }
        : { code: 'retention_failed', message: 'Retention cleanup failed.' },
    )
  }
}

export { app }
export default { fetch: app.fetch, scheduled }
