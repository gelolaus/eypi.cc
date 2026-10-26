// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { handleClientError } from '@/lib/reportClientError'
import { useToast } from '@/composables/useToast'

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  const { toasts, dismiss } = useToast()
  for (const toast of [...toasts.value]) dismiss(toast.id)
})

describe('handleClientError', () => {
  it('shows a Signal-strip toast when the network is unreachable', () => {
    handleClientError(new TypeError('Failed to fetch'))

    expect(useToast().toasts.value.map((toast) => toast.message)).toEqual([
      "Can't reach eypi.cc. Check your connection.",
    ])
    expect(useToast().toasts.value[0]?.type).toBe('error')
  })

  it('states the next action for an unexpected error', () => {
    handleClientError(new Error('render exploded'))

    expect(useToast().toasts.value.map((toast) => toast.message)).toEqual([
      'Something went wrong. Refresh the page and try again.',
    ])
  })

  it('shows the API message for an ApiError', () => {
    const err = new Error('That slug is taken.')
    err.name = 'ApiError'
    handleClientError(err)

    expect(useToast().toasts.value.map((toast) => toast.message)).toEqual([
      'That slug is taken.',
    ])
  })

  it('stays quiet when a lazy chunk fails so the router can reload', () => {
    handleClientError(new TypeError('Failed to fetch dynamically imported module'))

    expect(useToast().toasts.value).toEqual([])
  })
})
