// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { defineComponent, h, nextTick, ref } from 'vue'
import CommandPalette from './CommandPalette.vue'
import { useActiveOrg } from '@/composables/useActiveOrg'
import { useSession } from '@/stores/session'
import type { OrgListItem } from '@/types/orgs'

const stub = { template: '<div />' }
const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', component: stub },
    { path: '/dashboard', component: stub },
    { path: '/links', component: stub },
    { path: '/tickets', component: stub },
    { path: '/manage/tix', component: stub },
    { path: '/manage/frames', component: stub },
    { path: '/orgs', component: stub },
    { path: '/wallpaper', component: stub },
    { path: '/invites', component: stub },
    { path: '/forms', component: stub },
    { path: '/account', component: stub },
    { path: '/admin/users', component: stub },
    { path: '/orgs/modify/:slug', name: 'orgs-modify', component: stub },
  ],
})

function org(id: string, name: string): OrgListItem {
  return {
    org_id: id,
    org_name: name,
    owner_id: 'owner-1',
    is_owner: 0,
    created_at: '2026-01-01T00:00:00.000Z',
  }
}

const open = ref(false)
let wrapper: VueWrapper | undefined

const Harness = defineComponent({
  setup() {
    return () =>
      h('div', [
        h('button', { type: 'button', id: 'outside', onClick: () => { open.value = true } }, 'Search'),
        h(CommandPalette, {
          open: open.value,
          'onUpdate:open': (value: boolean) => { open.value = value },
        }),
      ])
  },
})

function setSession(role: 'user' | 'admin' = 'user') {
  const session = useSession()
  session.user.value = { id: 'user-1', email: 'ada@apc.edu.ph', name: 'Ada', role, avatarIcon: null, avatarColor: null }
  session.status.value = 'ready'
}

function setOrgs(list: OrgListItem[], active: string | null = null) {
  const state = useActiveOrg()
  state.orgs.value = list
  state.activeOrg.value = list.find((item) => item.org_id === active) ?? null
}

function input(): HTMLInputElement {
  return document.body.querySelector<HTMLInputElement>('[role="combobox"]')!
}

function options(): HTMLElement[] {
  return Array.from(document.body.querySelectorAll<HTMLElement>('[role="option"]'))
}

function optionLabels(): string[] {
  return options().map((option) => option.querySelector('[data-command-label]')?.textContent?.trim() ?? option.textContent?.trim() ?? '')
}

async function mountOpen() {
  wrapper = mount(Harness, { attachTo: document.body, global: { plugins: [router] } })
  const outside = document.body.querySelector<HTMLButtonElement>('#outside')!
  outside.focus()
  open.value = true
  await flushPromises()
  await new Promise((resolve) => setTimeout(resolve, 20))
  await nextTick()
}

async function type(value: string) {
  const field = input()
  field.value = value
  field.dispatchEvent(new Event('input', { bubbles: true }))
  await nextTick()
}

function key(name: string, init: KeyboardEventInit = {}) {
  input().dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...init }))
}

beforeEach(async () => {
  open.value = false
  setSession()
  setOrgs([])
  await router.push('/')
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  open.value = false
  useSession().user.value = null
  setOrgs([])
  document.body.innerHTML = ''
})

describe('CommandPalette', () => {
  it('renders grouped commands for a regular user without admin entries', async () => {
    setOrgs([org('robotics', 'Robotics Club')], 'robotics')
    await mountOpen()

    const labels = optionLabels()
    for (const label of [
      'Dashboard', 'Links', 'My tickets', 'Wallpaper', 'Invites', 'Orgs',
      'Tix', 'Frames', 'Forms', 'My org', 'Account', 'Create a link', 'Robotics Club',
    ]) {
      expect(labels).toContain(label)
    }
    expect(labels).not.toContain('Admin')
    const text = document.body.textContent ?? ''
    for (const group of ['Go to', 'Create', 'Switch org']) expect(text).toContain(group)
  })

  it('hides org-only destinations from a non-member and keeps wallpaper and invites', async () => {
    const state = useActiveOrg()
    state.orgs.value = []
    state.orgsLoaded.value = true
    localStorage.removeItem('eypi.hasOrg')
    await mountOpen()

    const labels = optionLabels()
    for (const label of ['Tix', 'Frames', 'Forms', 'My org']) expect(labels).not.toContain(label)
    for (const label of ['Wallpaper', 'Invites']) expect(labels).toContain(label)
  })

  it('shows admin destinations to admins only', async () => {
    setSession('admin')
    await mountOpen()
    expect(optionLabels()).toContain('Admin')
  })

  it('lists a Switch org row for each of the user organizations', async () => {
    setOrgs([org('robotics', 'Robotics Club'), org('debate', 'Debate Society')], 'robotics')
    await mountOpen()
    const text = document.body.textContent ?? ''
    expect(text).toContain('Switch org')
    expect(optionLabels()).toEqual(expect.arrayContaining(['Robotics Club', 'Debate Society']))
    expect(optionLabels().filter((label) => label === 'Robotics Club')).toHaveLength(1)
  })

  it('has no Switch org group when the user has no organizations', async () => {
    await mountOpen()
    expect(optionLabels()).toContain('Dashboard')
    expect(optionLabels()).toContain('Create a link')
    expect(document.body.textContent ?? '').not.toContain('Switch org')
  })

  it('exposes combobox and listbox semantics tied to the highlighted row', async () => {
    await mountOpen()
    const field = input()
    expect(field.getAttribute('role')).toBe('combobox')
    expect(field.getAttribute('aria-expanded')).toBe('true')
    const list = document.getElementById(field.getAttribute('aria-controls')!)!
    expect(list.getAttribute('role')).toBe('listbox')
    expect(field.getAttribute('aria-activedescendant')).toBe(options()[0].id)
    expect(options()[0].getAttribute('aria-selected')).toBe('true')

    key('ArrowDown')
    await nextTick()
    expect(field.getAttribute('aria-activedescendant')).toBe(options()[1].id)
    expect(options()[1].getAttribute('aria-selected')).toBe('true')
    expect(options()[0].getAttribute('aria-selected')).toBe('false')
  })

  it('moves focus into the dialog input when it opens', async () => {
    await mountOpen()
    expect(document.activeElement).toBe(input())
    expect(document.body.querySelector('[data-slot="dialog-content"]')!.contains(document.activeElement)).toBe(true)
  })

  it('runs the selected command with Enter and closes', async () => {
    await mountOpen()
    // Dashboard is first; move to Links and run it.
    key('ArrowDown')
    await nextTick()
    key('Enter')
    await flushPromises()
    expect(open.value).toBe(false)
    expect(router.currentRoute.value.path).toBe('/links')
  })

  it('runs a command when its row is clicked', async () => {
    await mountOpen()
    options().find((option) => option.textContent?.trim() === 'My tickets')!.click()
    await flushPromises()
    expect(open.value).toBe(false)
    expect(router.currentRoute.value.path).toBe('/tickets')
  })

  it('switches orgs through the shared org switcher', async () => {
    setOrgs([org('robotics', 'Robotics Club'), org('debate', 'Debate Society')], 'robotics')
    await router.push('/orgs/modify/robotics')
    await mountOpen()

    options().find((option) => option.querySelector('[data-command-label]')?.textContent?.trim() === 'Debate Society')!.click()
    await flushPromises()

    expect(useActiveOrg().activeOrg.value?.org_id).toBe('debate')
    expect(localStorage.getItem('active_org_id')).toBe('debate')
    expect(router.currentRoute.value.path).toBe('/orgs/modify/debate')
  })

  it('marks the current organization and keeps choosing it a no-op', async () => {
    setOrgs([org('robotics', 'Robotics Club'), org('debate', 'Debate Society')], 'robotics')
    await router.push('/')
    await mountOpen()

    const current = options().find((option) => option.querySelector('[data-command-label]')?.textContent?.trim() === 'Robotics Club')!
    expect(current.getAttribute('aria-current')).toBe('true')
    expect(current.textContent).toContain('Current')
    expect(options().find((option) => option.querySelector('[data-command-label]')?.textContent?.trim() === 'Debate Society')!.getAttribute('aria-current')).toBeNull()

    current.click()
    await flushPromises()

    expect(useActiveOrg().activeOrg.value?.org_id).toBe('robotics')
    expect(router.currentRoute.value.path).toBe('/')
    expect(open.value).toBe(false)
  })

  it('gives every row a 44px touch target and one selected row', async () => {
    await mountOpen()
    for (const option of options()) {
      expect(option.className).toContain('min-h-11')
    }
    const selected = options().filter((option) => option.getAttribute('aria-selected') === 'true')
    expect(selected).toHaveLength(1)
    for (const cls of ['ring-2', 'ring-ring']) expect(selected[0].classList).toContain(cls)
  })

  it('filters as you type and clamps the selection at the ends', async () => {
    setOrgs([org('robotics', 'Robotics Club')], 'robotics')
    await mountOpen()
    await type('tix')
    expect(optionLabels()).toEqual(['Tix'])
    key('ArrowDown')
    await nextTick()
    expect(input().getAttribute('aria-activedescendant')).toBe(options()[0].id)
    key('ArrowUp')
    await nextTick()
    expect(input().getAttribute('aria-activedescendant')).toBe(options()[0].id)
  })

  it('navigates in the same order the rows are rendered across groups', async () => {
    setOrgs([org('robotics', 'Robotics Club'), org('debate', 'Debate Society')], 'robotics')
    await mountOpen()
    await type('c')

    const ids = options().map((option) => Number(option.id.split('-').pop()))
    expect(ids.length).toBeGreaterThan(3)
    expect(ids).toEqual(ids.map((_, index) => index))
    expect(optionLabels()).toEqual([
      'Orgs', 'My org', 'My tickets', 'Wallpaper', 'Tix', 'Account',
      'Create a link',
      'Robotics Club', 'Debate Society',
    ])

    for (const [index, option] of options().entries()) {
      if (index === 0) continue
      key('ArrowDown')
      await nextTick()
      expect(input().getAttribute('aria-activedescendant')).toBe(option.id)
      expect(option.getAttribute('aria-selected')).toBe('true')
    }
  })

  it('scrolls the highlighted row into view as the selection moves', async () => {
    await mountOpen()
    const second = options()[1]
    const scrollIntoView = vi.fn()
    second.scrollIntoView = scrollIntoView

    key('ArrowDown')
    await nextTick()
    await nextTick()

    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' })
  })

  it('announces an empty result outside the listbox', async () => {
    await mountOpen()
    await type('zzzz')

    expect(options()).toHaveLength(0)
    const list = document.getElementById('command-palette-list')!
    expect(list.textContent?.trim()).toBe('')
    const status = list.parentElement!.querySelector('[role="status"]')!
    expect(status.getAttribute('aria-live')).toBe('polite')
    expect(status.textContent).toContain('No commands match "zzzz"')
    expect(list.contains(status)).toBe(false)
    expect(input().hasAttribute('aria-activedescendant')).toBe(false)
  })

  it('ignores keys while an IME composition is active', async () => {
    await mountOpen()
    const first = options()[0]

    key('ArrowDown', { isComposing: true })
    await nextTick()
    expect(input().getAttribute('aria-activedescendant')).toBe(first.id)

    key('Enter', { isComposing: true })
    await flushPromises()
    expect(open.value).toBe(true)
    expect(router.currentRoute.value.path).toBe('/')
  })

  it('keeps the mobile gutter and widens only from sm', async () => {
    await mountOpen()
    const dialog = document.body.querySelector<HTMLElement>('[data-slot="dialog-content"]')!
    expect(dialog.classList).toContain('max-w-[calc(100%-2rem)]')
    expect(dialog.classList).toContain('sm:max-w-lg')
    expect(dialog.classList.contains('max-w-lg')).toBe(false)
  })

  it('closes on Escape and returns focus to the previously focused element', async () => {
    await mountOpen()
    expect(document.activeElement).toBe(input())
    key('Escape')
    await flushPromises()
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(open.value).toBe(false)
    expect(document.body.querySelector('[data-slot="dialog-content"]')).toBeNull()
    expect(document.activeElement?.id).toBe('outside')
  })
})
