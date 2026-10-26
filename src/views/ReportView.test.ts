// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ReportView from './ReportView.vue'

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: {}, query: { slug: 'promo' } }),
}))

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ReportView', () => {
  it('shows an inline error when a reason is not chosen', async () => {
    const wrapper = mount(ReportView)

    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.get('#reason-error').text()).toBe('Choose a reason.')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('shows the review confirmation after a report is accepted', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(201, { id: 'report-1' }))
    const wrapper = mount(ReportView)

    await wrapper.get('#report-reason').setValue('phishing')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain("Thanks. We'll review this link.")
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/reports')
    expect(JSON.parse(String(init.body))).toEqual({
      slug: 'promo',
      reason: 'phishing',
      details: '',
    })
  })
})
