// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import EventBuilderView from './EventBuilderView.vue'

const { route, push, replace, uploadVariants } = vi.hoisted(() => ({
  route: { params: {} as Record<string, string>, query: {} },
  push: vi.fn(),
  replace: vi.fn(),
  uploadVariants: vi.fn(),
}))
vi.mock('vue-router', () => ({ useRoute: () => route, useRouter: () => ({ push, replace }), onBeforeRouteLeave: vi.fn() }))
vi.mock('@/lib/images/uploadVariants', () => ({ uploadVariants }))

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

type Call = { method: string; path: string; body: Record<string, unknown> | null }
let calls: Call[]
let handlers: Record<string, (body: Record<string, unknown> | null) => Response>
let wrapper: VueWrapper

const managed = {
  id: 'e1', slug: 'launch', name: 'Launch', status: 'draft', isLead: true, eventDate: '2099-01-01', eventTime: '09:00',
  endTime: null, location: 'Hall', description: 'Hello', admissionMode: 'fcfs', visibility: 'unlisted', capacity: 20,
  waitlistEnabled: false, registrationOpensAt: null, registrationClosesAt: null, questions: [], coverUrl: null, coverMeta: null,
}

beforeEach(() => {
  localStorage.clear()
  calls = []
  route.params = {}
  push.mockReset()
  replace.mockReset()
  uploadVariants.mockReset()
  uploadVariants.mockResolvedValue(null)
  handlers = {
    'POST /api/events': () => json({ status: 'ok', event: { id: 'e1', slug: 'launch', status: 'draft' } }, 201),
    'PATCH /api/events/launch': () => json({ status: 'ok', event: { slug: 'launch', status: 'draft' } }),
    'POST /api/events/launch/publish': () => json({ status: 'ok', event: { slug: 'launch', status: 'published' } }),
    'GET /api/events/launch': () => json({ status: 'ok', event: managed }),
    'PUT /api/events/launch/cover': () => json({ status: 'ok', coverKey: 'events/e1/cover-abc12345.png', coverUrl: '/media/events/e1/cover-abc12345.png' }),
  }
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const url = new URL(raw)
    const method = init?.method ?? 'GET'
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) as Record<string, unknown> : null
    calls.push({ method, path: url.pathname, body })
    const handler = handlers[`${method} ${url.pathname}`]
    return handler ? handler(body) : json({ status: 'error' }, 404)
  }))
})
afterEach(() => {
  wrapper?.unmount()
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

async function mountBuilder(slug?: string) {
  if (slug) route.params = { id: slug }
  wrapper = mount(EventBuilderView, { attachTo: document.body, global: { stubs: { RouterLink: { props: ['to'], template: '<a :href="String(to)"><slot /></a>' } } } })
  await flushPromises()
  return wrapper
}

async function fillBasics() {
  await wrapper.get('#field-name').setValue('Launch')
  await wrapper.get('#field-date').setValue('2099-01-01')
  await wrapper.get('#field-time').setValue('09:00')
  await wrapper.get('#field-location').setValue('Hall')
}
const button = (label: string) => [...document.body.querySelectorAll('button')].find((b) => b.textContent?.trim() === label) as HTMLButtonElement | undefined
const writes = () => calls.filter((c) => c.method !== 'GET')

describe('EventBuilderView', () => {
  it('labels the fields, says the times are Manila time, and derives the link from the name', async () => {
    await mountBuilder()
    expect(wrapper.find('[data-app-page]').exists()).toBe(true)
    for (const id of ['name', 'slug', 'date', 'time', 'endTime', 'location', 'description', 'capacity', 'opensAt', 'closesAt']) {
      expect(wrapper.find(`#field-${id}`).exists(), id).toBe(true)
      expect(wrapper.find(`label[for="field-${id}"]`).exists(), id).toBe(true)
    }
    expect(wrapper.text()).toContain('Manila time')
    await wrapper.get('#field-name').setValue('BWAI 2026!')
    expect((wrapper.get('#field-slug').element as HTMLInputElement).value).toBe('bwai2026')
  })

  it('disables the add button at 5 questions and lets you remove one', async () => {
    await mountBuilder()
    const add = () => wrapper.get('[data-add-question]')
    for (let i = 0; i < 5; i += 1) await add().trigger('click')
    expect(wrapper.findAll('[data-question]').length).toBe(5)
    expect(add().attributes('disabled')).toBeDefined()
    await wrapper.get('[data-question] [data-remove-question]').trigger('click')
    expect(wrapper.findAll('[data-question]').length).toBe(4)
    expect(add().attributes('disabled')).toBeUndefined()
  })

  it('needs at least one option for choice questions and shows an error summary without calling the API', async () => {
    await mountBuilder()
    await fillBasics()
    await wrapper.get('[data-add-question]').trigger('click')
    await wrapper.get('[data-question] input[data-question-label]').setValue('Diet')
    await wrapper.get('[data-question] select[data-question-type]').setValue('choice')
    await button('Save draft')!.click()
    await flushPromises()
    const summary = wrapper.get('[data-error-summary]')
    expect(summary.attributes('aria-live')).toBe('assertive')
    expect(summary.text()).toContain('add at least one option')
    expect(writes()).toHaveLength(0)
  })

  it('counts the description live and previews it as Markdown', async () => {
    await mountBuilder()
    expect(wrapper.get('[data-description-count]').text()).toContain('0 / 4000')
    await wrapper.get('#field-description').setValue('Hello **bold**')
    expect(wrapper.get('[data-description-count]').text()).toContain('14 / 4000')
    await button('Preview')!.click()
    await vi.waitFor(() => expect(wrapper.get('[data-description-preview]').html()).toContain('<strong>bold</strong>'))
  })

  it('rejects a description over the limit and a close time before the open time', async () => {
    await mountBuilder()
    await fillBasics()
    await wrapper.get('#field-description').setValue('x'.repeat(4001))
    await wrapper.get('#field-opensAt').setValue('2099-01-02T10:00')
    await wrapper.get('#field-closesAt').setValue('2099-01-02T09:00')
    await button('Save draft')!.click()
    await flushPromises()
    expect(wrapper.get('[data-error-summary]').text()).toContain('Keep the description under 4000')
    expect(wrapper.get('[data-error-summary]').text()).toContain('Registration must close after it opens.')
    expect(writes()).toHaveLength(0)
  })

  it('saves a new event as a draft and moves to its edit page', async () => {
    await mountBuilder()
    await fillBasics()
    await wrapper.get('#field-capacity').setValue('40')
    await button('Save draft')!.click()
    await flushPromises()
    expect(writes()).toHaveLength(1)
    expect(writes()[0]).toMatchObject({ method: 'POST', path: '/api/events', body: { name: 'Launch', slug: 'launch', date: '2099-01-01', time: '09:00', location: 'Hall', capacity: 40, admissionMode: 'fcfs' } })
    expect(replace).toHaveBeenCalledWith('/manage/tix/launch/edit')
  })

  it('shows a summary before publishing, then creates and publishes on confirm', async () => {
    await mountBuilder()
    await fillBasics()
    await wrapper.get('#field-capacity').setValue('40')
    await button('Publish')!.click()
    await flushPromises()
    const dialog = document.body.querySelector('[role="dialog"]')!
    expect(dialog.textContent).toContain('Launch')
    expect(dialog.textContent).toContain('Manila time')
    expect(dialog.textContent).toContain('Hall')
    expect(dialog.textContent).toContain('First come, first served')
    expect(dialog.textContent).toContain('40')
    expect(dialog.textContent).toContain('0 questions')
    expect(dialog.textContent).toContain('https://eypi.cc/tix/launch')
    expect(writes()).toHaveLength(0)
    ;(dialog.querySelector('[data-confirm-publish]') as HTMLButtonElement).click()
    await flushPromises()
    expect(writes().map((c) => `${c.method} ${c.path}`)).toEqual(['POST /api/events', 'POST /api/events/launch/publish'])
    expect(push).toHaveBeenCalledWith('/manage/tix/launch')
  })

  it('does not send anything when the publish summary is dismissed', async () => {
    await mountBuilder()
    await fillBasics()
    await button('Publish')!.click()
    await flushPromises()
    ;(document.body.querySelector('[data-cancel-publish]') as HTMLButtonElement).click()
    await flushPromises()
    expect(writes()).toHaveLength(0)
  })

  it('loads an existing event and publishes without a PATCH when nothing changed', async () => {
    await mountBuilder('launch')
    expect((wrapper.get('#field-name').element as HTMLInputElement).value).toBe('Launch')
    expect((wrapper.get('#field-slug').element as HTMLInputElement).readOnly).toBe(true)
    await button('Publish')!.click()
    await flushPromises()
    ;(document.body.querySelector('[data-confirm-publish]') as HTMLButtonElement).click()
    await flushPromises()
    expect(writes().map((c) => `${c.method} ${c.path}`)).toEqual(['POST /api/events/launch/publish'])
  })

  it('patches first when the form changed, then publishes', async () => {
    await mountBuilder('launch')
    await wrapper.get('#field-location').setValue('Atrium')
    await button('Publish')!.click()
    await flushPromises()
    ;(document.body.querySelector('[data-confirm-publish]') as HTMLButtonElement).click()
    await flushPromises()
    expect(writes().map((c) => `${c.method} ${c.path}`)).toEqual(['PATCH /api/events/launch', 'POST /api/events/launch/publish'])
    expect(writes()[0].body).toMatchObject({ location: 'Atrium' })
  })

  it('offers Save changes instead of Publish for a published event', async () => {
    handlers['GET /api/events/launch'] = () => json({ status: 'ok', event: { ...managed, status: 'published' } })
    await mountBuilder('launch')
    expect(button('Publish')).toBeUndefined()
    expect(button('Save changes')).toBeDefined()
  })

  it('explains a locked admission mode', async () => {
    handlers['PATCH /api/events/launch'] = () => json({ error: { code: 'admission_locked', message: 'locked' } }, 409)
    await mountBuilder('launch')
    await wrapper.get('input[name="admissionMode"][value="lottery"]').setValue(true)
    await wrapper.get('#field-closesAt').setValue('2099-01-02T09:00')
    await button('Save draft')!.click()
    await flushPromises()
    expect(wrapper.get('[data-error-summary]').text()).toContain('cannot be changed once people have registered')
  })

  it('reports a taken link on the slug field', async () => {
    handlers['POST /api/events'] = () => json({ error: { code: 'slug_taken', message: 'Slug already taken — choose another.' } }, 409)
    await mountBuilder()
    await fillBasics()
    await button('Save draft')!.click()
    await flushPromises()
    expect(wrapper.get('#field-slug').attributes('aria-invalid')).toBe('true')
    expect(wrapper.get('[data-error-summary]').text()).toContain('already taken')
    expect(replace).not.toHaveBeenCalled()
  })

  it('shows field errors from the API', async () => {
    handlers['POST /api/events'] = () => json({ error: { code: 'invalid_event', message: 'Check the highlighted fields.', fields: { location: 'Enter a location.' } } }, 422)
    await mountBuilder()
    await fillBasics()
    await button('Save draft')!.click()
    await flushPromises()
    expect(wrapper.get('#field-location').attributes('aria-invalid')).toBe('true')
    expect(wrapper.get('[data-error-summary]').text()).toContain('Enter a location.')
  })

  it('creates and publishes import events right away, then opens the attendee selection flow', async () => {
    await mountBuilder()
    await fillBasics()
    await wrapper.get('input[name="admissionMode"][value="import"]').setValue(true)
    expect(wrapper.find('[data-add-question]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Import events go live right away')
    expect(button('Publish')).toBeUndefined()
    await button('Save event')!.click()
    await flushPromises()
    expect(writes().map((c) => `${c.method} ${c.path}`)).toEqual(['POST /api/events', 'POST /api/events/launch/publish'])
    expect(writes()[0].body).toMatchObject({ admissionMode: 'import', questions: [] })
    expect(push).toHaveBeenCalledWith('/manage/tix/launch/select')
  })

  it('publishes an existing draft import event on save', async () => {
    handlers['GET /api/events/launch'] = () => json({ status: 'ok', event: { ...managed, admissionMode: 'import' } })
    await mountBuilder('launch')
    await button('Save event')!.click()
    await flushPromises()
    expect(writes().map((c) => `${c.method} ${c.path}`)).toEqual(['POST /api/events/launch/publish'])
  })

  it('keeps registration events as drafts on save', async () => {
    await mountBuilder()
    await fillBasics()
    await button('Save draft')!.click()
    await flushPromises()
    expect(writes().map((c) => `${c.method} ${c.path}`)).toEqual(['POST /api/events'])
  })

  it('uses publish copy that fits the mode', async () => {
    await mountBuilder()
    await fillBasics()
    await button('Publish')!.click()
    await flushPromises()
    expect(document.body.querySelector('[role="dialog"]')!.textContent).toContain('Anyone with the link can open the event page and register')
  })

  it('warns about changed questions and locks the admission mode once people registered', async () => {
    handlers['GET /api/events/launch'] = () => json({ status: 'ok', event: { ...managed, status: 'published', registrationCount: 3, questions: [{ id: 'a', label: 'Why', type: 'text', required: false }] } })
    await mountBuilder('launch')
    expect(wrapper.find('[data-answers-warning]').exists()).toBe(false)
    expect(wrapper.get('input[name="admissionMode"][value="lottery"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('input[name="admissionMode"][value="fcfs"]').attributes('disabled')).toBeUndefined()
    await wrapper.get('[data-question] select[data-question-type]').setValue('choice')
    expect(wrapper.get('[data-answers-warning]').text()).toContain('People already answered this')
    await wrapper.get('[data-question] select[data-question-type]').setValue('text')
    expect(wrapper.find('[data-answers-warning]').exists()).toBe(false)
    await wrapper.get('[data-remove-question]').trigger('click')
    expect(wrapper.find('[data-answers-warning]').exists()).toBe(true)
  })

  it('says that import clears questions, window and waitlist', async () => {
    await mountBuilder()
    expect(wrapper.text()).toContain('Choosing CSV import clears questions, the registration window and the waitlist')
  })

  it('uploads a picked cover once the event exists and makes variants from the returned key', async () => {
    await mountBuilder()
    await fillBasics()
    const file = new File([new Uint8Array([1, 2, 3])], 'cover.png', { type: 'image/png' })
    const input = wrapper.get('input[type="file"]')
    Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
    await input.trigger('change')
    await vi.waitFor(() => expect(wrapper.find('img[alt="Cover preview"]').exists()).toBe(true))
    await button('Save draft')!.click()
    await flushPromises()
    expect(writes().map((c) => `${c.method} ${c.path}`)).toEqual(['POST /api/events', 'PUT /api/events/launch/cover'])
    expect(String(writes()[1].body?.image)).toMatch(/^data:image\/png;base64,/)
    expect(uploadVariants).toHaveBeenCalledWith(file, 'banner', 'events/e1/cover-abc12345.png')
  })

  it('keeps a cancelled event read-only', async () => {
    handlers['GET /api/events/launch'] = () => json({ status: 'ok', event: { ...managed, status: 'cancelled' } })
    await mountBuilder('launch')
    expect(wrapper.text()).toContain('cancelled event cannot be edited')
    expect(button('Save changes')?.disabled ?? true).toBe(true)
  })
})
