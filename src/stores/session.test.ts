// @vitest-environment happy-dom
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { API_BASE_URL } from '@/config/api'
import { useSession } from '@/stores/session'
import { useOrgMembership } from '@/composables/useOrgMembership'

const fetchMock = vi.fn()

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function filesUnder(dir: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) found.push(...filesUnder(path))
    else found.push(path)
  }
  return found
}

beforeEach(() => {
  localStorage.clear()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  useSession().reset()
})

describe('useSession', () => {
  it('dedupes concurrent load() calls', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, {
      error: { code: 'unauthorized', message: 'Sign in to continue.' },
    }))
    const session = useSession()

    const first = session.load()
    const second = session.load()

    expect(second).toBe(first)
    expect(session.status.value).toBe('loading')

    await first
    await second

    expect(session.status.value).toBe('ready')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('loads the signed-in user from GET /api/me', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {
      user: {
        id: 'user-1',
        email: 'ada@apc.edu.ph',
        name: 'Ada',
        role: 'admin',
      },
      pendingInviteCount: 0,
      needsConsent: [],
      orgs: [],
    }))

    const session = useSession()
    await session.load()

    expect(session.user.value).toEqual({
      id: 'user-1',
      email: 'ada@apc.edu.ph',
      name: 'Ada',
      role: 'admin',
    })
    expect(session.pendingInviteCount.value).toBe(0)
    expect(session.status.value).toBe('ready')
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`${API_BASE_URL}/api/me`)
    expect(init.method ?? 'GET').toBe('GET')
    expect(init.credentials).toBe('include')
    expect(new Headers(init.headers).get('Authorization')).toBeNull()
  })

  it('keeps a pending invite count from GET /api/me and clears it on logout', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {
      user: {
        id: 'user-1',
        email: 'ada@apc.edu.ph',
        name: 'Ada',
        role: 'user',
      },
      pendingInviteCount: 2,
      needsConsent: [],
      orgs: [],
    }))

    const session = useSession()
    await session.load()
    expect(session.pendingInviteCount.value).toBe(2)

    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    await session.logout()

    expect(session.user.value).toBeNull()
    expect(session.pendingInviteCount.value).toBe(0)
  })

  it('treats a 401 from /api/me as signed out', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, {
      error: { code: 'unauthorized', message: 'Sign in to continue.' },
    }))

    const session = useSession()
    await session.load()

    expect(session.user.value).toBeNull()
    expect(session.status.value).toBe('ready')
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/me')
  })

  it('logout posts to /api/auth/logout and clears the active org', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    localStorage.setItem('active_org_id', 'org-1')
    const session = useSession()
    session.user.value = {
      id: 'user-1',
      email: 'ada@apc.edu.ph',
      name: 'Ada',
      role: 'user',
    }
    session.status.value = 'ready'

    await session.logout()

    expect(session.user.value).toBeNull()
    expect(session.status.value).toBe('idle')
    expect(localStorage.getItem('active_org_id')).toBeNull()
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`${API_BASE_URL}/api/auth/logout`)
    expect(init.method).toBe('POST')
    expect(init.credentials).toBe('include')
  })

  it('logout clears the org membership cache', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes('/api/forms')) return jsonResponse(200, { ok: true })
      return new Response(null, { status: 204 })
    })
    const membership = useOrgMembership()
    await expect(membership.checkOrgMembership()).resolves.toBe(true)

    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes('/api/forms')) {
        return jsonResponse(403, { error: { code: 'no_org', message: 'No org.' } })
      }
      return new Response(null, { status: 204 })
    })

    await useSession().logout()

    await expect(membership.checkOrgMembership()).resolves.toBe(false)
  })

  it('reset clears the signed-in user', () => {
    const session = useSession()
    session.user.value = {
      id: 'user-1',
      email: 'user@student.apc.edu.ph',
      name: 'User',
      role: 'user',
    }
    session.status.value = 'ready'

    session.reset()

    expect(session.user.value).toBeNull()
    expect(session.status.value).toBe('idle')
  })

  it('never reads the legacy local token key', () => {
    const needle = ['eypi', 'token'].join('_')
    const root = join(process.cwd(), 'src')
    const hits = filesUnder(root).filter((file) => {
      if (!/\.(vue|ts|js|css|mjs)$/.test(file)) return false
      return readFileSync(file, 'utf8').includes(needle)
    })

    expect(hits).toEqual([])
  })
})
