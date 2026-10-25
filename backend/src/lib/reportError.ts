type ReportContext = {
  req: {
    path: string
    header(name: string): string | undefined
  }
}

type ReportExtra = {
  code?: string
  message?: string
  requestId?: string
}

type ApiErrorLike = Error & {
  isApiError?: true
  code?: string
}

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
const BEARER = /\bBearer\s+\S+/gi
const TOKEN_PARAM = /\btoken=[^\s&]+/gi
const IPV4 = /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g
const IPV6 = /\b(?:[0-9a-f]{1,4}:){2,7}[0-9a-f]{1,4}\b/gi

function scrub(value: string): string {
  return value
    .replace(EMAIL, '[redacted]')
    .replace(BEARER, '[redacted]')
    .replace(TOKEN_PARAM, 'token=[redacted]')
    .replace(IPV4, '[redacted]')
    .replace(IPV6, '[redacted]')
}

function apiErrorOf(err: unknown): { code: string; message: string } | null {
  if (!(err instanceof Error)) return null
  const candidate = err as ApiErrorLike
  if (candidate.isApiError !== true || typeof candidate.code !== 'string' || candidate.code.length === 0) {
    return null
  }
  return { code: candidate.code, message: err.message }
}

/** One JSON line. Emails, tokens, and IP addresses are never written. */
export function reportError(c: ReportContext, err: unknown, extra?: ReportExtra): void {
  const apiError = apiErrorOf(err)
  const code = extra?.code ?? apiError?.code ?? 'internal'
  const message = extra?.message ?? (apiError ? apiError.message : 'Something went wrong.')
  const requestId = extra?.requestId
    ?? c.req.header('x-request-id')
    ?? c.req.header('cf-ray')
    ?? crypto.randomUUID()

  console.error(JSON.stringify({
    level: 'error',
    route: scrub(c.req.path),
    code: scrub(code),
    message: scrub(message),
    requestId: scrub(requestId),
  }))
}
