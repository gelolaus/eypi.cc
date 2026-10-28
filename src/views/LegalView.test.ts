// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { privacy } from '@/legal/privacy'
import router from '@/router'
import { useSession } from '@/stores/session'
import LegalView from './LegalView.vue'

beforeEach(() => {
  useSession().reset()
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
    error: { code: 'unauthorized', message: 'Sign in to continue.' },
  }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  })))
})

describe('LegalView', () => {
  it.each([
    ['/privacy', 'Privacy policy', '2026-11-15', '15 November 2026'],
    ['/terms', 'Terms of service', '2026-11-01', '1 November 2026'],
    ['/acceptable-use', 'Acceptable use', '2026-11-01', '1 November 2026'],
  ])('shows the version and the effective date on %s', async (path, title, version, effective) => {
    await router.push(path)
    await router.isReady()

    const wrapper = mount(LegalView, {
      global: { plugins: [router] },
    })

    expect(router.currentRoute.value.path).toBe(path)
    expect(wrapper.text()).toContain(title)
    expect(wrapper.text()).toContain(version)
    expect(wrapper.text()).toContain(effective)
  })

  async function mountPrivacy() {
    await router.push('/privacy')
    await router.isReady()
    return mount(LegalView, { global: { plugins: [router] } })
  }

  it('renders an On this page list with one link per section', async () => {
    const wrapper = await mountPrivacy()

    const nav = wrapper.get('nav[aria-label="On this page"]')
    const links = nav.findAll('ol a')
    expect(links).toHaveLength(privacy.sections.length)
    expect(links.map((link) => link.text())).toEqual(privacy.sections.map((s) => s.heading))
    for (const link of links) expect(link.classes()).toContain('min-h-11')
  })

  it('each link href matches a section id', async () => {
    const wrapper = await mountPrivacy()

    const hrefs = wrapper.findAll('nav[aria-label="On this page"] a').map((a) => a.attributes('href'))
    const ids = wrapper.findAll('.space-y-8 > section').map((s) => s.attributes('id'))
    expect(ids.every(Boolean)).toBe(true)
    expect(new Set(ids).size).toBe(ids.length)
    expect(hrefs).toEqual(ids.map((id) => `#${id}`))
  })

  it('scroll offset leaves the sticky header clear', async () => {
    const wrapper = await mountPrivacy()

    for (const section of wrapper.findAll('.space-y-8 > section')) {
      expect(section.classes()).toContain('scroll-mt-20')
    }
  })
})
