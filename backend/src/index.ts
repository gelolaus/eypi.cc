import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Bindings } from './lib/db'
import { missingRequiredEnv, requiredEnvError } from './lib/env'
import authRoutes from './routes/auth'
import linkRoutes from './routes/links'
import eventRoutes from './routes/events'
import dpRoutes from './routes/dp'
import orgsRoutes from './routes/orgs'
import formsRoutes from './routes/forms'
import statsRoutes from './routes/stats'

const app = new Hono<{ Bindings: Bindings }>()

// CORS so the eypi.cc SPA can talk to this API (must be first middleware).
// Everything now lives under one origin (eypi.cc) plus localhost for dev.
app.use('/api/*', cors({
  origin: (origin) => {
    const allowed = [
      'http://localhost:5173',
      'http://localhost:5174',
      'https://eypi.cc',
    ]
    return allowed.includes(origin ?? '') ? origin! : null
  },
  allowHeaders: ['Content-Type', 'Authorization', 'X-Client-Referrer', 'X-Active-Org-Id'],
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
app.get('/api/health', (c) => {
  const missing = missingRequiredEnv(c.env)
  if (missing.length) {
    return c.text(requiredEnvError(missing), 503)
  }
  return c.text('OK')
})

// Mount feature routers. Each declares its own full /api/... paths.
app.route('/', authRoutes)
app.route('/', linkRoutes)
app.route('/', eventRoutes)
app.route('/', dpRoutes)
app.route('/api/orgs', orgsRoutes)
app.route('/', formsRoutes)
app.route('/', statsRoutes)

export default app
