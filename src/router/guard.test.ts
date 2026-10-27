// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import router from './index'
import { routeNeedsSession } from './guards'
import { useSession } from '@/stores/session'

function meResponse(needsConsent: unknown[] = []): Response {
  return new Response(JSON.stringify({
    user: { id: 'user-1', email: 'ada@apc.edu.ph', name: 'Ada', role: 'user' },
    pendingInviteCount: 0,
    needsConsent,
    orgs: [],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

function pendingMe() {
  let release!: (response: Response) => void
  const promise = new Promise<Response>((resolve) => {
    release = resolve
  })
  vi.stubGlobal('fetch', vi.fn(() => promise))
  return release
}

async function settle() {
  for (let i = 0; i < 10; i += 1) await Promise.resolve()
  await new Promise((resolve) => setTimeout(resolve, 0))
}

beforeEach(async () => {
  useSession().reset()
  vi.stubGlobal('fetch', vi.fn(async () => meResponse()))
  await router.push('/contact')
  await settle()
  useSession().reset()
})

describe('routeNeedsSession', () => {
  it('is true for protected routes, login and consent only', () => {
    expect(routeNeedsSession(router.resolve('/links'))).toBe(true)
    expect(routeNeedsSession(router.resolve('/forms'))).toBe(true)
    expect(routeNeedsSession(router.resolve('/admin/users'))).toBe(true)
    expect(routeNeedsSession(router.resolve('/login'))).toBe(true)
    expect(routeNeedsSession(router.resolve('/consent'))).toBe(true)
    expect(routeNeedsSession(router.resolve('/frames/x'))).toBe(false)
    expect(routeNeedsSession(router.resolve('/'))).toBe(false)
    expect(routeNeedsSession(router.resolve('/orgs/apc'))).toBe(false)
  })
})

describe('first paint guard', () => {
  it('public route resolves without waiting for /api/me', async () => {
    pendingMe()

    await router.push('/frames/x')

    expect(router.currentRoute.value.name).toBe('dp-public')
    expect(useSession().status.value).toBe('loading')
  })

  it('protected route waits', async () => {
    const release = pendingMe()
    let done = false

    const navigation = router.push('/links').then(() => {
      done = true
    })
    await settle()
    expect(done).toBe(false)
    expect(router.currentRoute.value.name).not.toBe('links')

    release(meResponse())
    await navigation
    expect(router.currentRoute.value.name).toBe('links')
  })

  it('routes to consent after a background load', async () => {
    const release = pendingMe()

    await router.push('/frames/x')
    expect(router.currentRoute.value.name).toBe('dp-public')

    release(meResponse([{ document: 'privacy', version: '2026-11-01' }]))
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('consent'))
    expect(router.currentRoute.value.query.returnTo).toBe('/frames/x')
  })

  it('stays on a public page after a background load when no consent is owed', async () => {
    const release = pendingMe()

    await router.push('/frames/x')
    release(meResponse())
    await settle()

    expect(router.currentRoute.value.name).toBe('dp-public')
  })

  it('stays on a legal page after a background load when consent is owed', async () => {
    const release = pendingMe()

    await router.push('/privacy')
    release(meResponse([{ document: 'privacy', version: '2026-11-01' }]))
    await settle()

    expect(router.currentRoute.value.name).toBe('privacy')
  })
})
