// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import AccountMenu from './AccountMenu.vue'
import { appNav, orgEntries, overflowEntries } from './appNav'
import { useSession } from '@/stores/session'

const signOut = vi.hoisted(() => vi.fn())
vi.mock('./useSignOut', () => ({ useSignOut: () => signOut }))

const stub = { template: '<div />' }
const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/:pathMatch(.*)*', component: stub }],
})

function stubMedia(phone: boolean) {
  vi.stubGlobal('matchMedia', () => ({
    matches: phone,
    media: '',
    addEventListener() {},
    removeEventListener() {},
  }))
}

function signIn(role: 'user' | 'admin' = 'user') {
  const session = useSession()
  session.user.value = { id: 'user-1', email: 'ada@apc.edu.ph', name: 'Ada', role, avatarIcon: null, avatarColor: null }
  session.status.value = 'ready'
  session.pendingInviteCount.value = 0
}

type Who = { member: boolean; admin?: boolean }

async function mountMenu({ member, admin = false }: Who, variant: 'header' | 'sidebar' = 'header') {
  signIn(admin ? 'admin' : 'user')
  await router.push('/dashboard')
  await router.isReady()
  const entries = appNav({ admin, org: member })
  const wrapper = mount(AccountMenu, {
    props: { variant, overflow: overflowEntries(entries), orgEntries: orgEntries(entries) },
    attachTo: document.body,
    global: { plugins: [router] },
  })
  await flushPromises()
  return wrapper
}

const trigger = (wrapper: Awaited<ReturnType<typeof mountMenu>>, variant = 'header') =>
  wrapper.get(`[data-account-menu="${variant}"]`)

async function openSheet(who: Who, variant: 'header' | 'sidebar' = 'header') {
  stubMedia(true)
  const wrapper = await mountMenu(who, variant)
  await trigger(wrapper, variant).trigger('click')
  await flushPromises()
  const sheet = document.body.querySelector<HTMLElement>('[role="dialog"][aria-label="Account"]')
  return { wrapper, sheet }
}

const text = (el: Element) => el.textContent?.replace(/\s+/g, ' ').trim() ?? ''
const headings = (sheet: HTMLElement) => Array.from(sheet.querySelectorAll('[data-sheet-heading]')).map(text)
const link = (sheet: HTMLElement, label: string) =>
  Array.from(sheet.querySelectorAll<HTMLElement>('a')).find((el) => text(el) === label)

beforeEach(() => {
  signOut.mockReset()
})

afterEach(() => {
  window.dispatchEvent(new Event('appinstalled'))
  document.body.innerHTML = ''
  useSession().reset()
  vi.unstubAllGlobals()
})

describe('AccountMenu on a phone', () => {
  it('opens as a modal sheet titled Account instead of the dropdown', async () => {
    const { wrapper, sheet } = await openSheet({ member: true })
    expect(sheet).not.toBeNull()
    expect(sheet!.getAttribute('aria-modal')).toBe('true')
    expect(document.body.querySelector('[data-slot="dropdown-menu-content"]')).toBeNull()
    expect(sheet!.className).toContain('rounded-t-3xl')
    expect(document.body.querySelector('[data-sheet-backdrop]')!.getAttribute('aria-label')).toBe('Close')
    expect(trigger(wrapper).attributes('aria-haspopup')).toBe('dialog')
    expect(trigger(wrapper).attributes('aria-expanded')).toBe('true')
    expect(trigger(wrapper).attributes('aria-controls')).toBe(sheet!.id)
    wrapper.unmount()
  })

  it('lists the identity block, Rams, Orgs, Account, avatar, Appearance, legal links and Sign out in order', async () => {
    const { wrapper, sheet } = await openSheet({ member: true })
    const stable = [
      'Rams',
      'Orgs',
      'Orgs',
      'Tix',
      'Frames',
      'Forms',
      'My org',
      'Account',
      'Change avatar',
      'Appearance',
      'Contact',
      'Privacy',
      'Terms',
      'Sign out',
    ]
    const seen = Array.from(sheet!.querySelectorAll('[data-sheet-heading], a, button'))
      .map(text)
      .filter((label) => stable.includes(label))
    expect(seen).toEqual(stable)

    const identity = sheet!.querySelector('[data-sheet-identity]')!
    expect(text(identity)).toContain('Ada')
    expect(text(identity)).toContain('ada@apc.edu.ph')
    const firstHeading = sheet!.querySelector('[data-sheet-heading]')!
    expect(identity.compareDocumentPosition(firstHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    wrapper.unmount()
  })

  it('puts the Orgs directory under Rams and the org tools under Orgs', async () => {
    const { wrapper, sheet } = await openSheet({ member: true })
    expect(headings(sheet!)).toEqual(['Rams', 'Orgs', 'Appearance'])
    expect(link(sheet!, 'Orgs')!.getAttribute('href')).toBe('/orgs')
    expect(link(sheet!, 'Tix')!.getAttribute('href')).toBe('/manage/tix')
    expect(link(sheet!, 'Frames')!.getAttribute('href')).toBe('/manage/frames')
    expect(link(sheet!, 'Forms')!.getAttribute('href')).toBe('/forms')
    expect(link(sheet!, 'My org')!.getAttribute('href')).toBe('/orgs/modify')
    // The five phone tabs are not repeated here.
    for (const label of ['Dashboard', 'Links', 'My tickets', 'Wallpaper', 'Invites']) {
      expect(link(sheet!, label)).toBeUndefined()
    }
    wrapper.unmount()
  })

  it('hides the Orgs heading and the org tools from a non-member', async () => {
    const { wrapper, sheet } = await openSheet({ member: false })
    expect(headings(sheet!)).toEqual(['Rams', 'Appearance'])
    for (const label of ['Tix', 'Frames', 'Forms', 'My org']) expect(link(sheet!, label)).toBeUndefined()
    expect(link(sheet!, 'Orgs')).toBeDefined()
    expect(link(sheet!, 'Account')).toBeDefined()
    wrapper.unmount()
  })

  it('shows Admin for an admin who is not a member, still without Orgs', async () => {
    const { wrapper, sheet } = await openSheet({ member: false, admin: true })
    expect(headings(sheet!)).toEqual(['Rams', 'Appearance'])
    expect(link(sheet!, 'Admin')!.getAttribute('href')).toBe('/admin/users')
    expect(link(sheet!, 'Tix')).toBeUndefined()
    const labels = Array.from(sheet!.querySelectorAll('a')).map(text)
    expect(labels.indexOf('Admin')).toBeLessThan(labels.indexOf('Account'))
    wrapper.unmount()
  })

  it('shows both Admin and the Orgs section for an admin who is a member', async () => {
    const { wrapper, sheet } = await openSheet({ member: true, admin: true })
    expect(headings(sheet!)).toEqual(['Rams', 'Orgs', 'Appearance'])
    expect(link(sheet!, 'Admin')).toBeDefined()
    expect(link(sheet!, 'Tix')).toBeDefined()
    wrapper.unmount()
  })

  it('does not show the Rams or Orgs sections in the sidebar variant', async () => {
    const { wrapper, sheet } = await openSheet({ member: true }, 'sidebar')
    expect(headings(sheet!)).toEqual(['Appearance'])
    expect(link(sheet!, 'Tix')).toBeUndefined()
    wrapper.unmount()
  })

  it('keeps every row at least 44px tall', async () => {
    const { wrapper, sheet } = await openSheet({ member: true })
    const rows = Array.from(sheet!.querySelectorAll<HTMLElement>('a, button'))
    expect(rows.length).toBeGreaterThan(8)
    for (const row of rows) expect(row.className, text(row)).toContain('min-h-11')
    wrapper.unmount()
  })

  it('closes when a link is chosen', async () => {
    const { wrapper, sheet } = await openSheet({ member: true })
    link(sheet!, 'Tix')!.click()
    await flushPromises()
    expect(document.body.querySelector('[role="dialog"][aria-label="Account"]')).toBeNull()
    expect(router.currentRoute.value.path).toBe('/manage/tix')
    wrapper.unmount()
  })

  it('closes and signs out', async () => {
    const { wrapper, sheet } = await openSheet({ member: true })
    Array.from(sheet!.querySelectorAll<HTMLElement>('button')).find((el) => text(el) === 'Sign out')!.click()
    await flushPromises()
    expect(signOut).toHaveBeenCalledTimes(1)
    expect(document.body.querySelector('[role="dialog"][aria-label="Account"]')).toBeNull()
    wrapper.unmount()
  })

  it('closes and opens the avatar picker from Change avatar', async () => {
    const { wrapper, sheet } = await openSheet({ member: true })
    const menuButton = trigger(wrapper).element as HTMLElement
    const focused: HTMLElement[] = []
    const orig = HTMLElement.prototype.focus
    HTMLElement.prototype.focus = function (this: HTMLElement, ...args: []) {
      focused.push(this)
      return orig.apply(this, args)
    }
    try {
      Array.from(sheet!.querySelectorAll<HTMLElement>('button')).find((el) => text(el) === 'Change avatar')!.click()
      await flushPromises()
      expect(document.body.querySelector('[role="dialog"][aria-label="Account"]')).toBeNull()
      const picker = document.body.querySelector('[data-slot="dialog-content"]')
      expect(picker).not.toBeNull()
      expect(picker!.textContent).toContain('Choose your avatar')
      expect(picker!.contains(document.activeElement)).toBe(true)
      expect(document.activeElement).not.toBe(menuButton)
      const tookPicker = focused.findIndex((el) => picker!.contains(el))
      expect(tookPicker).toBeGreaterThanOrEqual(0)
      expect(focused.slice(tookPicker)).not.toContain(menuButton)
    } finally {
      HTMLElement.prototype.focus = orig
    }
    wrapper.unmount()
  })

  it('switches the theme from the Appearance section', async () => {
    const { wrapper, sheet } = await openSheet({ member: true })
    const group = sheet!.querySelector('[role="radiogroup"][aria-label="Theme"]')!
    const radios = Array.from(group.querySelectorAll<HTMLElement>('[role="radio"]'))
    expect(radios.map(text)).toEqual(['System', 'Light', 'Dark'])
    expect(radios.filter((el) => el.getAttribute('aria-checked') === 'true')).toHaveLength(1)
    radios[2].click()
    await flushPromises()
    expect(radios[2].getAttribute('aria-checked')).toBe('true')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    document.documentElement.classList.remove('dark')
    wrapper.unmount()
  })

  it('closes on Escape and returns focus to the trigger', async () => {
    stubMedia(true)
    const wrapper = await mountMenu({ member: true })
    const button = trigger(wrapper).element as HTMLElement
    button.focus()
    await trigger(wrapper).trigger('click')
    await flushPromises()
    expect(document.body.querySelector('[role="dialog"][aria-label="Account"]')).not.toBeNull()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(document.body.querySelector('[role="dialog"][aria-label="Account"]')).toBeNull()
    expect(document.activeElement).toBe(button)
    wrapper.unmount()
  })

  it('may show Install Eypi between Appearance and the legal links', async () => {
    const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
      prompt: () => Promise<void>
      userChoice: Promise<{ outcome: string }>
    }
    event.prompt = vi.fn(async () => undefined)
    event.userChoice = Promise.resolve({ outcome: 'dismissed' })
    window.dispatchEvent(event)

    const { wrapper, sheet } = await openSheet({ member: true })
    const order = Array.from(sheet!.querySelectorAll('[data-sheet-heading], a, button')).map(text)
    expect(order.indexOf('Install Eypi')).toBeGreaterThan(order.indexOf('Appearance'))
    expect(order.indexOf('Install Eypi')).toBeLessThan(order.indexOf('Contact'))
    wrapper.unmount()
  })
})

describe('AccountMenu from sm up', () => {
  async function openDropdown(who: Who) {
    stubMedia(false)
    const wrapper = await mountMenu(who)
    await trigger(wrapper).trigger('click')
    await flushPromises()
    return { wrapper, menu: document.body.querySelector<HTMLElement>('[data-slot="dropdown-menu-content"]')! }
  }

  it('keeps the dropdown and gives it the org switcher width class', async () => {
    const { wrapper, menu } = await openDropdown({ member: true })
    expect(menu).not.toBeNull()
    expect(menu.className).toContain('sm:w-72')
    expect(document.body.querySelector('[role="dialog"][aria-label="Account"]')).toBeNull()
    expect(trigger(wrapper).attributes('aria-haspopup')).toBe('menu')
    wrapper.unmount()
  })

  it('lists the Rams and Orgs sections in the dropdown for a member', async () => {
    const { wrapper, menu } = await openDropdown({ member: true })
    expect(Array.from(menu.querySelectorAll('[data-sheet-heading]')).map(text)).toEqual(['Rams', 'Orgs'])
    for (const label of ['Tix', 'Frames', 'Forms', 'My org']) expect(text(menu)).toContain(label)
    wrapper.unmount()
  })

  it('leaves the Orgs section out of the dropdown for a non-member', async () => {
    const { wrapper, menu } = await openDropdown({ member: false })
    expect(Array.from(menu.querySelectorAll('[data-sheet-heading]')).map(text)).toEqual(['Rams'])
    for (const label of ['Tix', 'Frames', 'Forms', 'My org']) expect(text(menu)).not.toContain(label)
    wrapper.unmount()
  })
})
