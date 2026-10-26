import type { ErrorHandler } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { reportError } from './reportError'

export class ApiError extends Error {
  readonly isApiError = true as const
  readonly status: number
  readonly code: string
  readonly fields?: Record<string, string>

  constructor(status: number, code: string, message: string, fields?: Record<string, string>) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fields = fields
  }
}

export function badRequest(code: string, message: string, fields?: Record<string, string>): ApiError {
  return new ApiError(400, code, message, fields)
}

export function unauthorized(): ApiError {
  return new ApiError(401, 'unauthorized', 'Sign in to continue.')
}

export function forbidden(code: string, message: string): ApiError {
  return new ApiError(403, code, message)
}

export function notFound(message = 'Not found'): ApiError {
  return new ApiError(404, 'not_found', message)
}

export function conflict(code: string, message: string): ApiError {
  return new ApiError(409, code, message)
}

export function tooMany(message = 'Too many requests. Try again later.'): ApiError {
  return new ApiError(429, 'too_many', message)
}

export const onError: ErrorHandler = (err, c) => {
  reportError(c, err)
  if (err instanceof ApiError) {
    const error: { code: string; message: string; fields?: Record<string, string> } = {
      code: err.code,
      message: err.message,
    }
    if (err.fields) error.fields = err.fields
    return c.json({ error }, err.status as ContentfulStatusCode)
  }
  return c.json({ error: { code: 'internal', message: 'Something went wrong.' } }, 500)
}
