// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import LoginView from './LoginView.vue'
import ConsentView from './ConsentView.vue'
import UnlockView from './UnlockView.vue'
import ExpiredView from './ExpiredView.vue'
import NotFoundView from './NotFoundView.vue'
import OrgLockout from '@/components/OrgLockout.vue'
import loginSource from './LoginView.vue?raw'
import consentSource from './ConsentView.vue?raw'
import unlockSource from './UnlockView.vue?raw'
import expiredSource from './ExpiredView.vue?raw'
import notFoundSource from './NotFoundView.vue?raw'
import lockoutSource from '@/components/OrgLockout.vue?raw'

const route = { query: {} as Record<string, string>, params: { slug: 'promo' } }
vi.mock('vue-router', async (orig) => ({
  ...(await orig<typeof import('vue-router')>()),
  useRoute: () => route,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))

const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }],
})
const mountOpts = { global: { plugins: [router] } }

describe('auth and status page structure', () => {
  it('login: single Card, full-width lg Microsoft button, destructive inline error', () => {
    route.query = { error: 'server' }
    const w = mount(LoginView, mountOpts)
    expect(w.findAll('[data-slot="card"]')).toHaveLength(1)
    const cta = w.get('a[data-slot="button"]')
    expect(cta.attributes('data-size')).toBe('lg')
    expect(cta.classes()).toContain('w-full')
    expect(cta.text()).toContain('Sign in with Microsoft')
    const alert = w.get('[role="alert"]')
    expect(alert.classes().join(' ')).toContain('text-destructive')
    expect(alert.text()).toBe('Something went wrong signing you in. Try again.')
  })

  it('consent: single Card and a lg Button', () => {
    const w = mount(ConsentView, mountOpts)
    expect(w.findAll('[data-slot="card"]')).toHaveLength(1)
    const b = w.get('button[data-slot="button"]')
    expect(b.attributes('data-size')).toBe('lg')
    expect(w.findAll('input[type="checkbox"]')).toHaveLength(2)
  })

  it('unlock: single Card, Input with a visible Label, lg Button', () => {
    route.query = {}
    const w = mount(UnlockView, mountOpts)
    expect(w.findAll('[data-slot="card"]')).toHaveLength(1)
    const input = w.get('input[data-slot="input"]')
    const label = w.get('label[data-slot="label"]')
    expect(label.attributes('for')).toBe(input.attributes('id'))
    expect(label.text()).toBe('Password')
    expect(w.get('button[data-slot="button"]').attributes('data-size')).toBe('lg')
  })

  it.each([
    ['expired', ExpiredView],
    ['not found', NotFoundView],
  ])('%s: dot-grid backdrop, display heading, one primary action', (_n, view) => {
    const w = mount(view, mountOpts)
    expect(w.find('.bg-dot-grid').exists()).toBe(true)
    expect(w.get('h1').classes()).toContain('font-display')
    expect(w.find('svg').exists()).toBe(true)
    const actions = w.findAll('[data-slot="button"]')
    expect(actions).toHaveLength(1)
    expect(actions[0].text()).toBe('Back to home')
  })

  it('org lockout: single Card with the destructive-free heading and display font', () => {
    const w = mount(OrgLockout, mountOpts)
    expect(w.findAll('[data-slot="card"]')).toHaveLength(1)
    expect(w.get('h1').classes()).toContain('font-display')
  })

  it('no legacy classes or hard-coded hex remain', () => {
    for (const src of [loginSource, consentSource, unlockSource, expiredSource, notFoundSource, lockoutSource]) {
      expect(src).not.toMatch(/\bg-(text|muted|border|accent|primary)|mica|gold|tap-scale|\bapc-|btn-primary|btn-lg|\bcontrol\b|dark:|(?<!fill=")#[0-9a-fA-F]{3,8}\b/)
    }
  })
})
