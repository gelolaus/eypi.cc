// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import router from './index'
import { useSession } from '@/stores/session'

function me(role: 'user' | 'admin'): Response {
  return new Response(JSON.stringify({
    user: {
      id: 'user-1',
      email: 'ada@apc.edu.ph',
      name: 'Ada',
      role,
    },
    pendingInviteCount: 0,
    needsConsent: [],
    orgs: [],
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function anonymous(): Response {
  return new Response(JSON.stringify({
    error: { code: 'unauthorized', message: 'Sign in to continue.' },
  }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  useSession().reset()
  vi.stubGlobal('fetch', vi.fn(async () => anonymous()))
})

describe('route guards', () => {
  it('registers /invites as an authenticated route', () => {
    const match = router.resolve('/invites')

    expect(match.name).toBe('invites')
    expect(match.meta.requiresAuth).toBe(true)
  })

  it('sends anonymous users to /login?returnTo=/links', async () => {
    await router.push('/links')

    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query.returnTo).toBe('/links')
  })

  it('sends a signed-in user away from an admin route', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => me('user')))

    await router.push('/settings/org-management')

    expect(router.currentRoute.value.name).toBe('settings-security')
  })

  it('lets an admin open org management', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => me('admin')))

    await router.push('/settings/org-management')

    expect(router.currentRoute.value.name).toBe('settings-org-management')
  })

  it('registers /consent as an authenticated route and /acceptable-use before the slug route', () => {
    const consent = router.resolve('/consent')
    const acceptableUse = router.resolve('/acceptable-use')

    expect(consent.name).toBe('consent')
    expect(consent.meta.requiresAuth).toBe(true)
    expect(acceptableUse.name).toBe('acceptable-use')
    expect(acceptableUse.meta.requiresAuth).toBeUndefined()
  })

  it('sends a signed-in user with needsConsent from /links to the consent route', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      user: {
        id: 'user-1',
        email: 'ada@apc.edu.ph',
        name: 'Ada',
        role: 'user',
      },
      pendingInviteCount: 0,
      needsConsent: [{ document: 'privacy', version: '2026-11-01' }],
      orgs: [],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })))

    if (router.currentRoute.value.fullPath !== '/contact') await router.push('/contact')
    await router.push('/links')

    expect(router.currentRoute.value.name).toBe('consent')
    expect(router.currentRoute.value.query.returnTo).toBe('/links')
  })

  it('leaves /privacy in place when a signed-in user needs consent', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      user: {
        id: 'user-1',
        email: 'ada@apc.edu.ph',
        name: 'Ada',
        role: 'user',
      },
      pendingInviteCount: 0,
      needsConsent: [{ document: 'privacy', version: '2026-11-01' }],
      orgs: [],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })))

    if (router.currentRoute.value.fullPath !== '/contact') await router.push('/contact')
    await router.push('/privacy')

    expect(router.currentRoute.value.name).toBe('privacy')
  })

  it('opens /links when needsConsent is empty', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => me('user')))

    if (router.currentRoute.value.fullPath !== '/contact') await router.push('/contact')
    await router.push('/links')

    expect(router.currentRoute.value.name).toBe('links')
  })
})
