// @vitest-environment happy-dom
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useQrScanner } from './useQrScanner'

const TOKEN = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

afterEach(() => {
  vi.useRealTimers()
})

describe('useQrScanner', () => {
  it('ignores the same token within 5 s', async () => {
    vi.useFakeTimers()
    let now = 1_000
    const submitted: string[] = []
    const { onDecoded } = useQrScanner({
      slug: 'door',
      now: () => now,
      submit: async (token) => {
        submitted.push(token)
        return { ok: true, kind: 'success', message: 'Ana Santos checked in.' }
      },
    })

    onDecoded(TOKEN)
    await flushPromises()
    vi.advanceTimersByTime(1500)

    now = 1_000 + 4_999
    onDecoded(TOKEN)
    await flushPromises()
    expect(submitted).toEqual([TOKEN])

    now = 1_000 + 5_000
    onDecoded(TOKEN)
    await flushPromises()
    expect(submitted).toEqual([TOKEN, TOKEN])
  })

  it('accepts a different token inside the 5 s window', async () => {
    vi.useFakeTimers()
    let now = 1_000
    const submitted: string[] = []
    const { onDecoded } = useQrScanner({
      slug: 'door',
      now: () => now,
      submit: async (token) => {
        submitted.push(token)
        return { ok: true, kind: 'success', message: 'Checked in.' }
      },
    })

    onDecoded(TOKEN)
    await flushPromises()
    vi.advanceTimersByTime(1500)

    now = 2_000
    onDecoded(OTHER)
    await flushPromises()
    expect(submitted).toEqual([TOKEN, OTHER])
  })
})
