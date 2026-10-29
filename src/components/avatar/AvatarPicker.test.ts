// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AvatarPicker from './AvatarPicker.vue'
import { useSession } from '@/stores/session'
import { useToast } from '@/composables/useToast'

const patch = vi.hoisted(() => vi.fn())
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, api: { ...actual.api, patch } }
})

let wrapper: VueWrapper | undefined

function setUser(avatarIcon: string | null, avatarColor: string | null) {
  const session = useSession()
  session.user.value = { id: 'user-1', email: 'ada@apc.edu.ph', name: 'Ada', role: 'user', avatarIcon, avatarColor } as never
  session.status.value = 'ready'
}

function mountPicker() {
  wrapper = mount(AvatarPicker, { props: { open: true }, attachTo: document.body })
  return wrapper
}

const q = (sel: string) => document.body.querySelector<HTMLElement>(sel)
const qa = (sel: string) => Array.from(document.body.querySelectorAll<HTMLElement>(sel))
const iconBtn = (key: string) => q(`[aria-label="Icon"] [data-value="${key}"]`)!
const colorBtn = (key: string) => q(`[aria-label="Colour"] [data-value="${key}"]`)!
const save = () => qa('button').find((b) => b.textContent?.trim() === 'Save') as HTMLButtonElement
const reset = () => qa('button').find((b) => b.textContent?.trim() === 'Reset') as HTMLButtonElement

beforeEach(() => {
  patch.mockReset()
  patch.mockResolvedValue({})
  useToast().toasts.value = []
  setUser(null, null)
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
  useSession().reset()
})

describe('AvatarPicker', () => {
  it('disables Save until both an icon and a colour are chosen, with initials in the preview', async () => {
    mountPicker()
    await flushPromises()
    expect(save().disabled).toBe(true)
    expect(q('[data-avatar-preview]')!.textContent).toContain('AD')
    iconBtn('cat').click()
    await flushPromises()
    expect(save().disabled).toBe(true)
    colorBtn('teal').click()
    await flushPromises()
    expect(save().disabled).toBe(false)
    const preview = q('[data-avatar-preview]')!
    expect(preview.querySelector('svg')).not.toBeNull()
    expect(preview.outerHTML).toContain('--avatar-teal')
  })

  it('starts from the current avatar with exactly one checked radio per group', async () => {
    setUser('dog', 'red')
    mountPicker()
    await flushPromises()
    expect(qa('[aria-label="Icon"] [aria-checked="true"]')).toHaveLength(1)
    expect(qa('[aria-label="Colour"] [aria-checked="true"]')).toHaveLength(1)
    expect(iconBtn('dog').getAttribute('aria-checked')).toBe('true')
    expect(colorBtn('red').getAttribute('aria-checked')).toBe('true')
    expect(save().disabled).toBe(false)
  })

  it('gives every icon and swatch an accessible name and a 44px target', async () => {
    mountPicker()
    await flushPromises()
    const icons = qa('[aria-label="Icon"] [role="radio"]')
    const colours = qa('[aria-label="Colour"] [role="radio"]')
    expect(icons).toHaveLength(36)
    expect(colours).toHaveLength(12)
    for (const el of [...icons, ...colours]) {
      expect(el.getAttribute('aria-label')).toBeTruthy()
      expect(el.className).toContain('min-h-11')
      expect(el.className).toContain('min-w-11')
    }
    expect(iconBtn('book-open').getAttribute('aria-label')).toBe('book open')
    expect(colorBtn('gold').getAttribute('aria-label')).toBe('gold')
  })

  it('moves the selection with the arrow keys and ignores modified keys', async () => {
    mountPicker()
    await flushPromises()
    colorBtn('blue').click()
    await flushPromises()
    colorBtn('blue').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    await flushPromises()
    expect(colorBtn('indigo').getAttribute('aria-checked')).toBe('true')
    expect(colorBtn('indigo').getAttribute('tabindex')).toBe('0')
    expect(colorBtn('blue').getAttribute('tabindex')).toBe('-1')
    colorBtn('indigo').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', ctrlKey: true, bubbles: true }))
    await flushPromises()
    expect(colorBtn('indigo').getAttribute('aria-checked')).toBe('true')
  })

  it('saves exactly { icon, color }, updates the session, toasts and closes', async () => {
    mountPicker()
    await flushPromises()
    iconBtn('rocket').click()
    colorBtn('violet').click()
    await flushPromises()
    save().click()
    await flushPromises()
    expect(patch).toHaveBeenCalledWith('/api/account/avatar', { icon: 'rocket', color: 'violet' })
    const user = useSession().user.value!
    expect(user.avatarIcon).toBe('rocket')
    expect(user.avatarColor).toBe('violet')
    expect(wrapper!.emitted('update:open')?.slice(-1)[0]).toEqual([false])
    expect(useToast().toasts.value.map((t) => t.message)).toContain('Avatar updated')
  })

  it('keeps the dialog open, the old avatar and shows an error toast when saving fails', async () => {
    setUser('cat', 'blue')
    patch.mockRejectedValue(new Error('offline'))
    mountPicker()
    await flushPromises()
    iconBtn('rocket').click()
    await flushPromises()
    save().click()
    await flushPromises()
    expect(wrapper!.emitted('update:open')).toBeUndefined()
    const user = useSession().user.value!
    expect(user.avatarIcon).toBe('cat')
    expect(user.avatarColor).toBe('blue')
    const toast = useToast().toasts.value.find((t) => t.type === 'error')
    expect(toast?.message).toBe('Could not save your avatar. Try again.')
    expect(q('[data-slot="dialog-content"]')).not.toBeNull()
  })

  it('resets with nulls, clears the session avatar and closes', async () => {
    setUser('cat', 'blue')
    mountPicker()
    await flushPromises()
    reset().click()
    await flushPromises()
    expect(patch).toHaveBeenCalledWith('/api/account/avatar', { icon: null, color: null })
    const user = useSession().user.value!
    expect(user.avatarIcon).toBeNull()
    expect(user.avatarColor).toBeNull()
    expect(wrapper!.emitted('update:open')?.slice(-1)[0]).toEqual([false])
    expect(useToast().toasts.value.map((t) => t.message)).toContain('Avatar reset')
  })

  it('ignores close requests while saving, then closes once the save succeeds', async () => {
    let resolve!: (value: unknown) => void
    patch.mockReturnValue(new Promise((r) => (resolve = r)))
    mountPicker()
    await flushPromises()
    iconBtn('rocket').click()
    colorBtn('violet').click()
    await flushPromises()
    save().click()
    await flushPromises()
    q('[data-slot="dialog-content"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    expect(wrapper!.emitted('update:open')).toBeUndefined()
    resolve({})
    await flushPromises()
    expect(wrapper!.emitted('update:open')).toEqual([[false]])
  })

  it('closes on Escape without calling the API', async () => {
    mountPicker()
    await flushPromises()
    q('[data-slot="dialog-content"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    expect(wrapper!.emitted('update:open')?.slice(-1)[0]).toEqual([false])
    expect(patch).not.toHaveBeenCalled()
  })
})
