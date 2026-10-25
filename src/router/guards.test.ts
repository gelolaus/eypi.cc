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
})
