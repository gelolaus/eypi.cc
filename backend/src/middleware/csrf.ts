import type { MiddlewareHandler } from 'hono'
import type { Bindings } from '../lib/db'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export const BAD_ORIGIN_MESSAGE = 'This request came from an untrusted origin.'

export function allowedOrigins(environment: string | undefined): string[] {
  const origins = ['https://eypi.cc']
  if (environment !== 'production') {
    origins.push('http://localhost:5173', 'http://localhost:5174')
  }
  return origins
}

export const csrf: MiddlewareHandler<{ Bindings: Bindings }> = async (c, next) => {
  if (SAFE_METHODS.has(c.req.method)) {
    await next()
    return
  }

  const origin = c.req.header('Origin')
  if (!origin || !allowedOrigins(c.env?.ENVIRONMENT).includes(origin)) {
    return c.json({ error: { code: 'bad_origin', message: BAD_ORIGIN_MESSAGE } }, 403)
  }

  await next()
}
