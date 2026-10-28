// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useToast } from '@/composables/useToast'
import { activeOrgHeaders, previousKey, reinsert, runWithUndo } from '@/composables/useUndoToast'

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

  it('flushes on visibilitychange once, so the timer cannot commit again', () => {
    const o = opts()
    runWithUndo(o)
    const spy = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    spy.mockRestore()
    vi.advanceTimersByTime(10_000)
    expect(o.commit).toHaveBeenCalledTimes(1)
  })

  it('reverts when a commit flushed by pagehide fails', async () => {
    const o = opts({ commit: vi.fn(() => Promise.reject(new Error('Slug taken'))) })
    runWithUndo(o)
    window.dispatchEvent(new Event('pagehide'))
    await vi.advanceTimersByTimeAsync(0)
    expect(o.revert).toHaveBeenCalledTimes(1)
    expect(useToast().toasts.value.find((t) => t.type === 'error')?.detail).toBe('Slug taken')
  })

  it('holds the commit while the toast is hovered or focused, then resumes with the time left', async () => {
    const o = opts()
    runWithUndo(o)
    const { toasts, pause, resume } = useToast()
    const id = toasts.value[0].id
    await vi.advanceTimersByTimeAsync(3_000)
    pause(id)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(o.commit).not.toHaveBeenCalled()
    resume(id)
    await vi.advanceTimersByTimeAsync(1_999)
    expect(o.commit).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(o.commit).toHaveBeenCalledTimes(1)
  })

  it('never evicts a pending Undo toast', () => {
    const a = opts({ message: 'A' })
    runWithUndo(a)
    const t = useToast()
    for (let i = 0; i < 6; i++) t.success('plain ' + i)
    expect(undoButton('A')).toBeTruthy()
    expect(t.toasts.value.filter((x) => !x.action).length).toBeLessThanOrEqual(3)
  })

  it('keeps two toasts with the same message because each has its own action', () => {
    runWithUndo(opts({ message: 'Same' }))
    runWithUndo(opts({ message: 'Same' }))
    expect(useToast().toasts.value.filter((x) => x.message === 'Same')).toHaveLength(2)
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

describe('undo helpers', () => {
  type Row = { id: string }
  const k = (r: Row) => r.id
  const rows = ['a', 'b', 'c', 'd'].map((id) => ({ id }))

  it('reinserts a row after its neighbour without touching other rows', () => {
    const b = rows[1]
    const prev = previousKey(rows, 'b', k)
    const afterBothGone = rows.filter((r) => r.id !== 'b' && r.id !== 'c')
    expect(reinsert(afterBothGone, b, prev, k).map(k)).toEqual(['a', 'b', 'd'])
  })

  it('puts a first row back at the top and ignores a row that is already present', () => {
    const a = rows[0]
    expect(reinsert(rows.slice(1), a, previousKey(rows, 'a', k), k).map(k)).toEqual(['a', 'b', 'c', 'd'])
    expect(reinsert(rows, a, undefined, k)).toBe(rows)
  })

  it('pins the active org header at call time', () => {
    localStorage.setItem('active_org_id', 'org-1')
    const h = activeOrgHeaders()
    localStorage.setItem('active_org_id', 'org-2')
    expect(h).toEqual({ 'X-Active-Org-Id': 'org-1' })
    localStorage.removeItem('active_org_id')
    expect(activeOrgHeaders()).toEqual({})
  })
})
