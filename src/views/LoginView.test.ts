// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { API_BASE_URL } from '@/config/api'
import LoginView from './LoginView.vue'

const route = {
  query: {} as Record<string, string>,
  fullPath: '/login',
  path: '/login',
  name: 'login',
  params: {},
}

vi.mock('vue-router', () => ({
  useRoute: () => route,
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}))

const ERROR_COPY: Record<string, string> = {
  tenant: 'Only APC Microsoft 365 accounts can sign in.',
  domain: 'Only APC Microsoft 365 accounts can sign in.',
  cancelled: 'Sign-in was cancelled.',
  state: 'Your sign-in link expired. Try again.',
  disabled: 'This account is disabled. Contact the Eypi admin.',
  server: 'Something went wrong signing you in. Try again.',
}

beforeEach(() => {
  route.query = {}
})

describe('LoginView', () => {
  it('links Sign in with Microsoft to the API start URL for returnTo', () => {
    route.query = { returnTo: '/links' }
    const wrapper = mount(LoginView)
    const link = wrapper.get('a')

    expect(link.text()).toContain('Sign in with Microsoft')
    expect(link.attributes('href')).toBe(
      `${API_BASE_URL}/api/auth/microsoft/start?returnTo=${encodeURIComponent('/links')}`,
    )
    expect(wrapper.text()).toContain('Sign in to Eypi')
    expect(wrapper.text()).toContain(
      'Use your APC Microsoft 365 account (@apc.edu.ph or @student.apc.edu.ph).',
    )
  })

  it.each(Object.entries(ERROR_COPY))('shows the %s error copy', (code, copy) => {
    route.query = { error: code }
    const wrapper = mount(LoginView)

    expect(wrapper.get('[role="alert"]').text()).toBe(copy)
  })
})
