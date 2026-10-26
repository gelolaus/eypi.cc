// @vitest-environment happy-dom
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import DialogHost from './DialogHost.vue'
import ToastContainer from './ToastContainer.vue'
import { useDialog } from '@/composables/useDialog'
import { useToast } from '@/composables/useToast'

vi.mock('@/router', () => ({
  default: { push: vi.fn(), replace: vi.fn(), currentRoute: { value: { fullPath: '/', name: 'x' } } },
}))

function src(path: string) {
  return readFileSync(new URL(path, import.meta.url), 'utf8')
}

afterEach(() => {
  const toast = useToast()
  while (toast.toasts.value.length > 0) toast.dismiss(toast.toasts.value[0].id)
  const dialog = useDialog()
  if (dialog.current.value) dialog.abort()
  document.body.innerHTML = ''
})

describe('DialogHost bottom sheet', () => {
  async function open(opts: Parameters<ReturnType<typeof useDialog>['confirm']>[0]) {
    mount(DialogHost, { attachTo: document.body })
    void useDialog().confirm(opts)
    await nextTick()
    await nextTick()
  }

  it('anchors to the bottom below sm and centers from sm', async () => {
    await open({ title: 'Delete', body: 'Sure?', confirmLabel: 'Delete', abortLabel: 'Cancel' } as never)
    const overlay = document.querySelector('[role="presentation"]') as HTMLElement
    expect(overlay.className).toContain('items-end')
    expect(overlay.className).toContain('sm:items-center')
    const panel = document.querySelector('[role="dialog"]') as HTMLElement
    expect(panel.className).toContain('rounded-t-3xl')
    expect(panel.className).toContain('sm:rounded-3xl')
    expect(panel.className).toContain('max-h-[90dvh]')
    expect(panel.className).toContain('overflow-y-auto')
    expect(panel.className).toContain('pb-[calc(1.25rem+env(safe-area-inset-bottom))]')
    expect(panel.getAttribute('aria-modal')).toBe('true')
  })

  it('stacks the footer reversed on mobile and uses 44px text-base inputs', async () => {
    await open({ title: 'Delete', body: 'Sure?', confirmLabel: 'Delete', abortLabel: 'Cancel', requireText: 'slug' } as never)
    const footer = document.querySelector('[data-dialog-footer]') as HTMLElement
    expect(footer.className).toContain('flex-col-reverse')
    expect(footer.className).toContain('sm:flex-row')
    const input = document.querySelector('input') as HTMLInputElement
    expect(input.className).toContain('h-11')
    expect(input.className).toContain('text-base')
  })
})

describe('ToastContainer placement', () => {
  it('clears the tab bar on mobile and sits bottom-right from lg', () => {
    const wrapper = mount(ToastContainer, { attachTo: document.body })
    const cls = wrapper.get('[aria-relevant]').classes().join(' ')
    expect(cls).toContain('inset-x-4')
    expect(cls).toContain('bottom-[calc(5.5rem+env(safe-area-inset-bottom))]')
    expect(cls).toContain('lg:inset-x-auto')
    expect(cls).toContain('lg:right-6')
    expect(cls).toContain('lg:bottom-6')
    expect(cls).not.toContain('bottom-24')
  })

  it('has a 44px dismiss target and pauses on touch', async () => {
    vi.useFakeTimers()
    try {
      const wrapper = mount(ToastContainer, { attachTo: document.body })
      const toast = useToast()
      toast.info('Saved')
      await nextTick()
      expect(wrapper.get('button[aria-label="Dismiss"]').classes()).toContain('size-11')
      const item = wrapper.get('[role="status"]')
      await item.trigger('touchstart')
      vi.advanceTimersByTime(10000)
      expect(toast.toasts.value).toHaveLength(1)
      await item.trigger('touchend')
      vi.advanceTimersByTime(10000)
      expect(toast.toasts.value).toHaveLength(0)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('slide panels are bottom sheets on mobile', () => {
  it.each([
    ['./links/LinkEditorPanel.vue'],
    ['./AnalyticsPanel.vue'],
    ['./tix/AddGuestPanel.vue'],
  ])('%s', (file) => {
    const s = src(file)
    expect(s).toContain('rounded-t-3xl')
    expect(s).toContain('dvh')
    expect(s).toContain('p-5')
    expect(s).toContain('sm:p-8')
    expect(s).not.toContain('top-20')
    expect(s).not.toContain('max-h-screen')
  })

  it('link editor has a sticky safe-area action footer', () => {
    const s = src('./links/LinkEditorPanel.vue')
    expect(s).toContain('sticky bottom-0')
    expect(s).toContain('env(safe-area-inset-bottom)')
  })
})
