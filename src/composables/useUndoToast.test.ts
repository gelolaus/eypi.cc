// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useToast } from '@/composables/useToast'
import { runWithUndo } from '@/composables/useUndoToast'

function opts(over: Partial<Parameters<typeof runWithUndo>[0]> = {}) {
  return {
    message: 'Link deleted.',
    apply: vi.fn(),
    revert: vi.fn(),
    commit: vi.fn(() => Promise.resolve()),
    ...over,
  }
}

function undoButton(label = 'Link deleted.') {
  const t = useToast().toasts.value.find((x) => x.message === label)
  return t?.action
}

describe('runWithUndo', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useToast().toasts.value = []
  })
  afterEach(() => {
    window.dispatchEvent(new Event('pagehide'))
    vi.useRealTimers()
  })

  it('applies immediately and offers an Undo action without committing yet', () => {
    const o = opts()
    runWithUndo(o)
    expect(o.apply).toHaveBeenCalledTimes(1)
    expect(o.commit).not.toHaveBeenCalled()
    expect(undoButton()?.label).toBe('Undo')
  })

  it('reverts on Undo and never commits', async () => {
    const o = opts()
    runWithUndo(o)
    undoButton()!.onClick()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(o.revert).toHaveBeenCalledTimes(1)
    expect(o.commit).not.toHaveBeenCalled()
  })

  it('commits exactly once after the 5 s window', async () => {
    const o = opts()
    runWithUndo(o)
    await vi.advanceTimersByTimeAsync(4_999)
    expect(o.commit).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(o.commit).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(20_000)
    expect(o.commit).toHaveBeenCalledTimes(1)
    expect(o.revert).not.toHaveBeenCalled()
  })

  it('ignores Undo once the commit has started', async () => {
    const o = opts()
    runWithUndo(o)
    const action = undoButton()!
    await vi.advanceTimersByTimeAsync(5_000)
    action.onClick()
    expect(o.revert).not.toHaveBeenCalled()
  })

  it('honours a custom window', async () => {
    const o = opts({ windowMs: 1_000 })
    runWithUndo(o)
    await vi.advanceTimersByTimeAsync(1_000)
    expect(o.commit).toHaveBeenCalledTimes(1)
  })

  it('commits on pagehide', () => {
    const o = opts()
    runWithUndo(o)
    window.dispatchEvent(new Event('pagehide'))
    expect(o.commit).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(10_000)
    expect(o.commit).toHaveBeenCalledTimes(1)
  })

  it('commits when the page becomes hidden', () => {
    const o = opts()
    runWithUndo(o)
    const spy = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    spy.mockRestore()
    expect(o.commit).toHaveBeenCalledTimes(1)
  })

  it('does not commit an undone action on pagehide', () => {
    const o = opts()
    runWithUndo(o)
    undoButton()!.onClick()
    window.dispatchEvent(new Event('pagehide'))
    expect(o.commit).not.toHaveBeenCalled()
  })

  it('reverts and shows an error toast when the commit fails', async () => {
    const o = opts({ commit: vi.fn(() => Promise.reject(new Error('nope'))) })
    runWithUndo(o)
    await vi.advanceTimersByTimeAsync(5_000)
    expect(o.revert).toHaveBeenCalledTimes(1)
    expect(useToast().toasts.value.some((t) => t.type === 'error')).toBe(true)
  })

  it('tracks concurrent actions independently', async () => {
    const a = opts({ message: 'A' })
    const b = opts({ message: 'B' })
    runWithUndo(a)
    await vi.advanceTimersByTimeAsync(2_000)
    runWithUndo(b)
    undoButton('A')!.onClick()
    await vi.advanceTimersByTimeAsync(5_000)
    expect(a.commit).not.toHaveBeenCalled()
    expect(a.revert).toHaveBeenCalledTimes(1)
    expect(b.commit).toHaveBeenCalledTimes(1)
    expect(b.revert).not.toHaveBeenCalled()
  })
})
