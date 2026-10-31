// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { copyShortLink } from './copyShortLink'
import { useToast } from '@/composables/useToast'

describe('copyShortLink', () => {
  beforeEach(() => {
    useToast().toasts.value = []
  })

  it('writes https://eypi.cc/{slug} and shows Link copied.', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    await copyShortLink('aa')

    expect(writeText).toHaveBeenCalledWith('https://eypi.cc/aa')
    expect(useToast().toasts.value.some((t) => t.type === 'success' && t.message === 'Link copied.')).toBe(true)
  })

  it('shows Could not copy the link. when the clipboard rejects and does not throw', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'))
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    await expect(copyShortLink('bb')).resolves.toBeUndefined()
    expect(useToast().toasts.value.some((t) => t.type === 'error' && t.message === 'Could not copy the link.')).toBe(true)
  })

  it('shows an error toast when clipboard is missing and does not throw', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    })

    await expect(copyShortLink('cc')).resolves.toBeUndefined()
    expect(useToast().toasts.value.some((t) => t.type === 'error' && t.message === 'Could not copy the link.')).toBe(true)
  })
})
