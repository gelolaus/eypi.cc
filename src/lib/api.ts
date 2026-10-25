import { API_BASE_URL } from '@/config/api'
import { useSession } from '@/stores/session'

const CREDENTIAL_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/verify',
  '/api/auth/password',
])

export type ApiRequestOptions = {
  headers?: HeadersInit
  signal?: AbortSignal
}

export class ApiError extends Error {
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

function resolveUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  const base = API_BASE_URL.replace(/\/$/, '')
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

function isCredentialPath(path: string): boolean {
  const pathname = new URL(path, 'https://api.eypi.cc').pathname
  return CREDENTIAL_PATHS.has(pathname)
}

function applyHeaders(init?: RequestInit): Headers {
  const headers = new Headers(init?.headers)
  const token = localStorage.getItem('eypi_token')
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  const orgId = localStorage.getItem('active_org_id')
  if (orgId && !headers.has('X-Active-Org-Id')) {
    headers.set('X-Active-Org-Id', orgId)
  }
  const body = init?.body
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData
  if (body != null && !isForm && typeof body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  return headers
}

async function redirectToLogin(): Promise<void> {
  useSession().reset()
  const { default: router } = await import('@/router')
  const returnTo = router.currentRoute.value.fullPath || '/'
  void router.push({ name: 'login', query: { returnTo } })
}

async function send(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = applyHeaders(init)
  const res = await fetch(resolveUrl(path), {
    ...init,
    headers,
    credentials: 'include',
  })
  if (res.status === 401 && !isCredentialPath(path)) {
    await redirectToLogin()
  }
  return res
}

async function toApiError(res: Response): Promise<ApiError> {
  const text = await res.text()
  try {
    const data = JSON.parse(text) as {
      error?: { code?: unknown; message?: unknown; fields?: unknown }
    }
    const error = data?.error
    if (
      error
      && typeof error === 'object'
      && typeof error.code === 'string'
      && typeof error.message === 'string'
    ) {
      const fields = error.fields && typeof error.fields === 'object'
        ? error.fields as Record<string, string>
        : undefined
      return new ApiError(res.status, error.code, error.message, fields)
    }
  } catch {
    // HTML and other non-JSON bodies use the generic message below.
  }
  return new ApiError(res.status, 'http_error', 'Something went wrong.')
}

async function readSuccess<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T
  const text = await res.text()
  if (!text) return undefined as T
  return JSON.parse(text) as T
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const res = await send(path, init)
  if (!res.ok) throw await toApiError(res)
  return readSuccess<T>(res)
}

function jsonInit(method: string, body: unknown, opts?: ApiRequestOptions): RequestInit {
  return {
    method,
    headers: opts?.headers,
    signal: opts?.signal,
    body: body === undefined ? undefined : JSON.stringify(body),
  }
}

export const api = {
  get<T>(path: string, opts?: ApiRequestOptions): Promise<T> {
    return request<T>(path, { method: 'GET', headers: opts?.headers, signal: opts?.signal })
  },
  post<T>(path: string, body?: unknown, opts?: ApiRequestOptions): Promise<T> {
    return request<T>(path, jsonInit('POST', body, opts))
  },
  patch<T>(path: string, body?: unknown, opts?: ApiRequestOptions): Promise<T> {
    return request<T>(path, jsonInit('PATCH', body, opts))
  },
  put<T>(path: string, body?: unknown, opts?: ApiRequestOptions): Promise<T> {
    return request<T>(path, jsonInit('PUT', body, opts))
  },
  del<T>(path: string, opts?: ApiRequestOptions): Promise<T> {
    return request<T>(path, { method: 'DELETE', headers: opts?.headers, signal: opts?.signal })
  },
  raw(path: string, init: RequestInit = {}): Promise<Response> {
    return send(path, init)
  },
}
