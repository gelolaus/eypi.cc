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

const mounted: { unmount: () => void }[] = []
function track<T extends { unmount: () => void }>(w: T): T {
  mounted.push(w)
  return w
}

afterEach(async () => {
  const toast = useToast()
  while (toast.toasts.value.length > 0) toast.dismiss(toast.toasts.value[0].id)
  const dialog = useDialog()
  if (dialog.current.value) dialog.abort()
  await nextTick()
  while (mounted.length) mounted.pop()!.unmount()
  document.body.innerHTML = ''
})

describe('DialogHost on the Dialog primitive', () => {
  async function open(opts: Parameters<ReturnType<typeof useDialog>['confirm']>[0]) {
    track(mount(DialogHost, { attachTo: document.body }))
    void useDialog().confirm(opts)
    await nextTick()
    await nextTick()
  }

  it('renders an aria-modal dialog with title and body wired up', async () => {
    await open({ title: 'Delete', body: 'Sure?', confirmLabel: 'Delete', abortLabel: 'Cancel' } as never)
    const panel = document.querySelector('[role="dialog"]') as HTMLElement
    expect(panel.getAttribute('data-slot')).toBe('dialog-content')
    const labelled = document.getElementById(panel.getAttribute('aria-labelledby')!)
    const described = document.getElementById(panel.getAttribute('aria-describedby')!)
    expect(labelled?.textContent).toContain('Delete')
    expect(described?.textContent).toContain('Sure?')
    expect(document.querySelector('[data-slot="dialog-overlay"]')).toBeTruthy()
  })

  it('uses the destructive Button variant for the confirm action', async () => {
    await open({ title: 'Delete', body: 'Sure?', confirmLabel: 'Delete', abortLabel: 'Cancel' } as never)
    const footer = document.querySelector('[data-dialog-footer]') as HTMLElement
    expect(footer.className).toContain('flex-col-reverse')
    const btns = [...footer.querySelectorAll('button')]
    expect(btns[btns.length - 1].className).toContain('text-destructive')
  })

  it('type-to-confirm keeps confirm disabled until the text matches', async () => {
    await open({ title: 'Delete', body: 'Sure?', confirmLabel: 'Delete', abortLabel: 'Cancel', requireText: 'slug' } as never)
    const input = document.querySelector('input') as HTMLInputElement
    expect(input.className).toContain('h-11')
    const confirm = [...document.querySelectorAll('[data-dialog-footer] button')].pop() as HTMLButtonElement
    expect(confirm.disabled).toBe(true)
    input.value = 'slug'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
    expect(confirm.disabled).toBe(false)
  })
})

describe('DialogHost queue focus', () => {
  it('focuses the type-to-confirm input of a queued second dialog', async () => {
    track(mount(DialogHost, { attachTo: document.body }))
    const d = useDialog()
    void d.confirm({ title: 'One', body: 'a', confirmLabel: 'Go', abortLabel: 'No' } as never)
    void d.confirm({ title: 'Two', body: 'b', confirmLabel: 'Go', abortLabel: 'No', requireText: 'slug' } as never)
    await nextTick()
    await nextTick()
    d.abort()
    await nextTick()
    await nextTick()
    await nextTick()
    expect(document.activeElement).toBe(document.querySelector('input'))
    expect(document.querySelector('[role="dialog"]')!.textContent).toContain('Two')
  })
})

describe('ToastContainer on vue-sonner', () => {
  it('mirrors a store toast into the sonner Toaster', async () => {
    const wrapper = track(mount(ToastContainer, { attachTo: document.body }))
    useToast().success('Saved', { detail: 'All good' })
    await nextTick()
    await nextTick()
    expect(document.body.textContent).toContain('Saved')
    expect(document.body.textContent).toContain('All good')
    wrapper.unmount()
  })

  it('dismisses the newest toast on Escape when no dialog is open', async () => {
    const wrapper = mount(ToastContainer, { attachTo: document.body })
    const toast = useToast()
    toast.info('Saved')
    await nextTick()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(toast.toasts.value).toHaveLength(0)
    wrapper.unmount()
  })

  it('renders the Toaster rich-colors at top-center', async () => {
    track(mount(ToastContainer, { attachTo: document.body }))
    await nextTick()
    const list = document.querySelector('[data-sonner-toaster]') as HTMLElement
    expect(list.getAttribute('data-y-position')).toBe('top')
    expect(list.getAttribute('data-x-position')).toBe('center')
    useToast().error('Bad')
    await nextTick()
    await nextTick()
    expect(document.querySelector('[data-sonner-toast]')!.getAttribute('data-rich-colors')).toBe('true')
  })

  it('pauses and resumes the store timer on hover, focus and touch', async () => {
    vi.useFakeTimers()
    try {
      track(mount(ToastContainer, { attachTo: document.body }))
      const toast = useToast()
      toast.info('Saved')
      await nextTick()
      await nextTick()
      for (const [on, off] of [['mouseover', 'mouseout'], ['focusin', 'focusout'], ['touchstart', 'touchend']]) {
        const el = document.querySelector('[data-sonner-toast]') as HTMLElement
        el.dispatchEvent(new Event(on, { bubbles: true }))
        vi.advanceTimersByTime(10000)
        expect(toast.toasts.value, on).toHaveLength(1)
        el.dispatchEvent(new Event(off, { bubbles: true }))
        vi.advanceTimersByTime(10000)
        expect(toast.toasts.value, off).toHaveLength(0)
        toast.info('Saved')
        await nextTick()
        await nextTick()
      }
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
