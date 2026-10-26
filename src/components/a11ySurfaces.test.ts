// @vitest-environment happy-dom
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ContactView from '@/views/ContactView.vue'
import FeaturesCarousel from './FeaturesCarousel.vue'
import SiteNavSheet from './layout/SiteNavSheet.vue'
import { useNavDrawer } from '@/composables/useNavDrawer'
import TheFooter from './TheFooter.vue'
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
    expect(dialog?.querySelector('[data-slot="dialog-title"]')?.textContent).toBe('Site navigation')
    useNavDrawer().close()
    wrapper.unmount()
  })

  it('hides footer arrows from assistive tech', () => {
    const wrapper = mount(TheFooter, {
      global: { plugins: [router] },
    })
    const arrows = wrapper.findAll('.footer-arrow')
    expect(arrows.length).toBeGreaterThan(0)
    for (const arrow of arrows) {
      expect(arrow.attributes('aria-hidden')).toBe('true')
      expect(arrow.text()).toBe('↗')
    }
  })

  it('does not skip heading levels on the contact page', () => {
    const wrapper = mount(ContactView)
    const tags = wrapper.findAll('h1, h2, h3, h4, h5, h6').map((heading) => heading.element.tagName)
    expect(tags).toEqual(['H1', 'H2', 'H2', 'H2'])
  })

  it('inerts hidden slides and offers a pause button', async () => {
    const wrapper = mount(FeaturesCarousel, {
      attachTo: document.body,
      global: {
        stubs: { RouterLink: { template: '<a><slot /></a>' } },
      },
    })
    await nextTick()

    const slides = wrapper.findAll('article')
    const hidden = slides.filter((slide) => slide.attributes('aria-hidden') === 'true')
    expect(hidden.length).toBeGreaterThan(0)
    for (const slide of hidden) {
      expect(slide.attributes()).toHaveProperty('inert')
    }
    const visible = slides.filter((slide) => slide.attributes('aria-hidden') !== 'true')
    expect(visible.length).toBeGreaterThan(0)
    for (const slide of visible) {
      expect(slide.attributes('inert')).toBeUndefined()
    }

    const pause = wrapper.get('[aria-label="Pause features"]')
    expect(pause.attributes('aria-pressed')).toBe('false')
    await pause.trigger('click')
    expect(wrapper.get('[aria-label="Play features"]').attributes('aria-pressed')).toBe('true')
    wrapper.unmount()
  })
})
