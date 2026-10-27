// @vitest-environment happy-dom
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ContactView from '@/views/ContactView.vue'
import SiteNavSheet from './layout/SiteNavSheet.vue'
import AppShell from './layout/AppShell.vue'
import { useNavDrawer } from '@/composables/useNavDrawer'
import MarketingFooter from './marketing/MarketingFooter.vue'
import router from '@/router'
import { useSession } from '@/stores/session'

function media(matches: boolean) {
  return {
    matches,
    media: '',
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() {
      return false
    },
  }
}

beforeEach(() => {
  vi.stubGlobal('matchMedia', () => media(false))
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
    error: { code: 'unauthorized', message: 'Sign in to continue.' },
  }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  })))
  localStorage.clear()
  useSession().reset()
})

describe('accessibility surfaces', () => {
  it('treats the open sidebar as a modal dialog', async () => {
    const wrapper = mount(SiteNavSheet, {
      attachTo: document.body,
      global: { plugins: [router] },
    })
    useNavDrawer().open()
    await nextTick()
    await nextTick()

    const dialog = document.getElementById('site-nav-sidebar')
    expect(dialog?.getAttribute('role')).toBe('dialog')
    expect(dialog?.querySelector('[data-slot="dialog-title"]')?.textContent?.trim()).toBe('Site navigation')
    useNavDrawer().close()
    wrapper.unmount()
  })

  it('does not skip heading levels on the contact page', () => {
    const wrapper = mount(ContactView)
    const tags = wrapper.findAll('h1, h2, h3, h4, h5, h6').map((heading) => heading.element.tagName)
    expect(tags).toEqual(['H1', 'H2', 'H2', 'H2'])
  })

  it('gives every shell button and link an accessible name', async () => {
    const wrapper = mount(AppShell, {
      attachTo: document.body,
      slots: { default: '<p>content</p>' },
      global: { plugins: [router] },
    })
    useNavDrawer().open()
    await nextTick()
    await nextTick()
    const nameOf = (el: Element) =>
      (
        el.getAttribute('aria-label') ||
        el.getAttribute('aria-labelledby') ||
        el.getAttribute('title') ||
        el.textContent ||
        ''
      ).trim()
    const controls = [...document.body.querySelectorAll('button, a')]
    expect(controls.length).toBeGreaterThan(0)
    const unnamed = controls.filter((el) => !nameOf(el)).map((el) => el.outerHTML.slice(0, 80))
    expect(unnamed).toEqual([])
    useNavDrawer().close()
    wrapper.unmount()
  })

  it('gives every marketing footer link an accessible name', () => {
    const wrapper = mount(MarketingFooter, { global: { plugins: [router] } })
    const unnamed = wrapper
      .findAll('a, button')
      .filter((el) => !(el.attributes('aria-label') || el.text()).trim())
    expect(unnamed).toHaveLength(0)
  })
})
