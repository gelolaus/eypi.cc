// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { RouterView, createMemoryHistory, createRouter } from 'vue-router'
import EventPageView from './EventPageView.vue'
import { clearQueryCache } from '@/lib/queryCache'

vi.mock('@/lib/sanitizeEventHtml', () => ({ sanitizeEventHtml: (h: string) => h }))

afterEach(() => {
  vi.unstubAllGlobals()
  clearQueryCache()
})

describe('EventPageView title', () => {
  it('leaves the next route title alone when navigating away', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      event: {
        slug: 'launch', name: 'Launch Night', eventDate: '2026-11-10', eventTime: '19:00', endTime: null, location: 'Hall',
        descriptionHtml: '', coverUrl: null, coverMeta: null, admissionMode: 'fcfs', seatsLeft: null, waitlistEnabled: false,
        registrationOpensAt: null, registrationClosesAt: null, status: 'published', questions: [], org: { slug: 'o', name: 'Org' },
      },
      viewer: { ticket: null },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })))
    const Other = defineComponent({ render: () => h('p', 'other') })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/tix/:slug', component: EventPageView, meta: { title: 'Event' } },
        { path: '/orgs', component: Other, meta: { title: 'Orgs' } },
      ],
    })
    // Same behaviour as src/router/index.ts: the router sets the title after every navigation.
    router.afterEach((to) => { document.title = `${String(to.meta.title)} · Eypi` })
    await router.push('/tix/launch')
    const w = mount(RouterView, { global: { plugins: [router] } })
    await flushPromises()
    expect(document.title).toBe('Launch Night · Eypi')
    await router.push('/orgs')
    await flushPromises()
    expect(w.text()).toContain('other')
    expect(document.title).toBe('Orgs · Eypi')
  })
})
