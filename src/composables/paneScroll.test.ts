// @vitest-environment happy-dom
import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { installPaneScroll } from './paneScroll'

const stub = { template: '<div />' }

function media(matches: boolean) {
  return { matches, media: '', onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false }
}

let router: Router
let pane: HTMLElement
let scrollTo: ReturnType<typeof vi.fn>
let dispose: () => void

function makePane() {
  const el = document.createElement('div')
  scrollTo = vi.fn((options: ScrollToOptions) => {
    el.scrollTop = options.top ?? 0
  })
  el.scrollTo = scrollTo as unknown as typeof el.scrollTo
  document.body.appendChild(el)
  return el
}

beforeEach(async () => {
  vi.stubGlobal('matchMedia', () => media(false))
  router = createRouter({
    history: createMemoryHistory(),
    routes: ['/links', '/manage/tix', '/account'].map((path) => ({ path, component: stub })),
  })
  await router.push('/links')
  await router.isReady()
  pane = makePane()
  dispose = installPaneScroll(router, () => pane)
})

afterEach(() => {
  dispose()
  document.body.innerHTML = ''
})

async function back() {
  router.back()
  await flushPromises()
}

describe('pane scroll', () => {
  it('resets the pane to the top on a normal push', async () => {
    pane.scrollTop = 500
    await router.push('/manage/tix')
    await flushPromises()
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: 'smooth' })
    expect(pane.scrollTop).toBe(0)
  })

  it('resets instantly when the user prefers reduced motion', async () => {
    vi.stubGlobal('matchMedia', () => media(true))
    await router.push('/manage/tix')
    await flushPromises()
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: 'auto' })
  })

  it('restores the saved position on back and forward', async () => {
    pane.scrollTop = 420
    await router.push('/manage/tix')
    await flushPromises()
    pane.scrollTop = 130

    await back()
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 420, behavior: 'auto' })
    expect(pane.scrollTop).toBe(420)

    router.forward()
    await flushPromises()
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 130, behavior: 'auto' })
  })

  it('scrolls a hash target into view', async () => {
    const target = document.createElement('section')
    target.id = 'events'
    const scrollIntoView = vi.fn()
    target.scrollIntoView = scrollIntoView
    pane.appendChild(target)
    await router.push('/manage/tix#events')
    await flushPromises()
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
  })

  it('leaves the pane alone on query-only changes', async () => {
    pane.scrollTop = 300
    scrollTo.mockClear()
    await router.push('/links?page=2')
    await flushPromises()
    expect(scrollTo).not.toHaveBeenCalled()
    expect(pane.scrollTop).toBe(300)
  })

  it('stops reacting once disposed', async () => {
    dispose()
    scrollTo.mockClear()
    await router.push('/account')
    await flushPromises()
    expect(scrollTo).not.toHaveBeenCalled()
  })
})
