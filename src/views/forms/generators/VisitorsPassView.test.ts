// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import VisitorsPassView from './VisitorsPassView.vue'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('missing', { status: 404 })))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('VisitorsPassView', () => {
  it('shows an inline error when walkInCount is 501', async () => {
    const wrapper = mount(VisitorsPassView)

    await wrapper.get('#walkInCount').setValue('501')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.get('#walkInCount-error').text()).toBe('Walk-in slots cannot be more than 500.')
    expect(fetch).not.toHaveBeenCalled()
  })
})
