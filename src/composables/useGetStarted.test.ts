// @vitest-environment happy-dom
import { ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { markWallpaperMade, resetGetStartedState, useGetStarted } from './useGetStarted'

const DISMISSED = 'eypi.getStartedDismissed'
const WALLPAPER = 'eypi.wallpaperMade'
const INVITES = 'eypi.invitesSeen'

beforeEach(() => {
  localStorage.clear()
  resetGetStartedState()
})

afterEach(() => {
  vi.unstubAllGlobals()
  try {
    localStorage.clear()
  } catch {
    // ignore
  }
})

describe('useGetStarted', () => {
  it('shows three pending steps for a new user', () => {
    const { steps, visible } = useGetStarted({
      linkCount: ref(0),
      pendingInvites: ref(1),
    })
    expect(visible.value).toBe(true)
    expect(steps.value).toEqual([
      { id: 'link', label: 'Create your first link', to: '/links', done: false },
      { id: 'wallpaper', label: 'Make a wallpaper from your schedule', to: '/wallpaper', done: false },
      { id: 'invites', label: 'Check your invites', to: '/invites', done: false },
    ])
  })

  it('hides the checklist while linkCount is still loading', () => {
    const { visible } = useGetStarted({
      linkCount: ref(null),
      pendingInvites: ref(0),
    })
    expect(visible.value).toBe(false)
  })

  it('flips only the link step when linkCount becomes positive', () => {
    const linkCount = ref(0)
    const { steps } = useGetStarted({
      linkCount,
      pendingInvites: ref(1),
    })
    linkCount.value = 1
    expect(steps.value.find((s) => s.id === 'link')?.done).toBe(true)
    expect(steps.value.find((s) => s.id === 'wallpaper')?.done).toBe(false)
    expect(steps.value.find((s) => s.id === 'invites')?.done).toBe(false)
  })

  it('marks wallpaper done after markWallpaperMade', () => {
    const { steps } = useGetStarted({
      linkCount: ref(0),
      pendingInvites: ref(1),
    })
    markWallpaperMade()
    expect(localStorage.getItem(WALLPAPER)).toBe('1')
    expect(steps.value.find((s) => s.id === 'wallpaper')?.done).toBe(true)
  })

  it('marks invites done only after the page was opened and pending is zero', () => {
    const pendingInvites = ref(0)
    const { steps } = useGetStarted({
      linkCount: ref(0),
      pendingInvites,
    })
    expect(steps.value.find((s) => s.id === 'invites')?.done).toBe(false)
    localStorage.setItem(INVITES, '1')
    const again = useGetStarted({ linkCount: ref(0), pendingInvites })
    expect(again.steps.value.find((s) => s.id === 'invites')?.done).toBe(true)
  })

  it('hides when every step is done', () => {
    localStorage.setItem(WALLPAPER, '1')
    localStorage.setItem(INVITES, '1')
    const { visible, steps } = useGetStarted({
      linkCount: ref(1),
      pendingInvites: ref(0),
    })
    expect(steps.value.every((s) => s.done)).toBe(true)
    expect(visible.value).toBe(false)
  })

  it('dismiss writes the flag and hides the checklist', () => {
    const { visible, dismiss } = useGetStarted({
      linkCount: ref(0),
      pendingInvites: ref(1),
    })
    dismiss()
    expect(localStorage.getItem(DISMISSED)).toBe('1')
    expect(visible.value).toBe(false)
  })

  it('keeps the checklist visible and does not throw when storage throws', () => {
    const boom = () => {
      throw new Error('denied')
    }
    vi.stubGlobal('localStorage', {
      getItem: boom,
      setItem: boom,
      removeItem: boom,
      clear: boom,
      key: boom,
      length: 0,
    })
    const { visible, dismiss, steps } = useGetStarted({
      linkCount: ref(0),
      pendingInvites: ref(1),
    })
    expect(visible.value).toBe(true)
    expect(steps.value).toHaveLength(3)
    expect(() => dismiss()).not.toThrow()
    expect(() => markWallpaperMade()).not.toThrow()
    expect(visible.value).toBe(true)
  })

  it('hides for established users with three or more links', () => {
    const { visible } = useGetStarted({
      linkCount: ref(3),
      pendingInvites: ref(1),
    })
    expect(visible.value).toBe(false)
  })
})