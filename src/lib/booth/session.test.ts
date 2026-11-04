import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  COUNTDOWN_SECONDS,
  SHOT_COUNT,
  SHOT_PAUSE_MS,
  createBoothSession,
  type BoothState,
} from './session'

type Shot = HTMLCanvasElement

function fakeShot(label: string): Shot {
  return { label } as unknown as Shot
}

function setup(capture?: () => Promise<Shot | null>) {
  let n = 0
  const cap = vi.fn(capture ?? (async () => fakeShot(`shot-${++n}`)))
  const states: BoothState[] = []
  const session = createBoothSession({ capture: cap, onChange: (s) => states.push(s) })
  const last = () => states[states.length - 1]
  return { session, cap, states, last }
}

const SHOT_MS = COUNTDOWN_SECONDS * 1000 + SHOT_PAUSE_MS

describe('booth session', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('startAll runs 3 shots, each after a 3-2-1 countdown, then reaches review', async () => {
    const { session, cap, states, last } = setup()
    session.startAll()
    expect(last()).toMatchObject({ phase: 'counting', currentIndex: 0, secondsLeft: 3 })
    await vi.advanceTimersByTimeAsync(1000)
    expect(last()).toMatchObject({ phase: 'counting', secondsLeft: 2 })
    await vi.advanceTimersByTimeAsync(1000)
    expect(last()).toMatchObject({ phase: 'counting', secondsLeft: 1 })
    expect(cap).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1000)
    expect(cap).toHaveBeenCalledTimes(1)
    expect(last().phase).toBe('flash')
    expect(last().shots[0]).not.toBeNull()
    await vi.advanceTimersByTimeAsync(SHOT_PAUSE_MS)
    expect(last()).toMatchObject({ phase: 'counting', currentIndex: 1, secondsLeft: 3 })
    await vi.advanceTimersByTimeAsync(SHOT_MS * (SHOT_COUNT - 1))
    expect(cap).toHaveBeenCalledTimes(3)
    expect(last().phase).toBe('review')
    expect(last().shots.every((s) => s !== null)).toBe(true)
    expect(states.every((s) => s.shots.length === SHOT_COUNT)).toBe(true)
  })

  it('a second startAll while counting is ignored', async () => {
    const { session, cap, last } = setup()
    session.startAll()
    await vi.advanceTimersByTimeAsync(1000)
    session.startAll()
    expect(last()).toMatchObject({ phase: 'counting', secondsLeft: 2 })
    await vi.advanceTimersByTimeAsync(SHOT_MS * SHOT_COUNT)
    expect(cap).toHaveBeenCalledTimes(3)
    expect(last().phase).toBe('review')
  })

  it('retake during a countdown is ignored', async () => {
    const { session, cap, last } = setup()
    session.startAll()
    await vi.advanceTimersByTimeAsync(1000)
    session.retake(0)
    expect(last()).toMatchObject({ phase: 'counting', currentIndex: 0, secondsLeft: 2 })
    await vi.advanceTimersByTimeAsync(SHOT_MS * SHOT_COUNT)
    expect(cap).toHaveBeenCalledTimes(3)
  })

  it('retake replaces only that shot and returns to review', async () => {
    const { session, cap, last } = setup()
    session.startAll()
    await vi.advanceTimersByTimeAsync(SHOT_MS * SHOT_COUNT)
    const before = last().shots.slice()
    session.retake(1)
    expect(last()).toMatchObject({ phase: 'counting', currentIndex: 1, secondsLeft: 3 })
    await vi.advanceTimersByTimeAsync(SHOT_MS)
    expect(cap).toHaveBeenCalledTimes(4)
    expect(last().phase).toBe('review')
    expect(last().shots[0]).toBe(before[0])
    expect(last().shots[1]).not.toBe(before[1])
    expect(last().shots[1]).not.toBeNull()
    expect(last().shots[2]).toBe(before[2])
  })

  it('a capture that returns null leaves the slot empty and does not advance past it silently', async () => {
    let call = 0
    const { session, last } = setup(async () => (++call === 2 ? null : fakeShot(`s${call}`)))
    session.startAll()
    await vi.advanceTimersByTimeAsync(SHOT_MS * SHOT_COUNT)
    expect(last().phase).toBe('review')
    expect(last().shots[0]).not.toBeNull()
    expect(last().shots[1]).toBeNull()
    expect(last().shots[2]).not.toBeNull()
  })

  it('a capture that throws is treated as a null shot and does not wedge the session', async () => {
    let call = 0
    const { session, last } = setup(async () => {
      if (++call === 1) throw new Error('boom')
      return fakeShot(`s${call}`)
    })
    session.startAll()
    await vi.advanceTimersByTimeAsync(SHOT_MS * SHOT_COUNT)
    expect(last().phase).toBe('review')
    expect(last().shots[0]).toBeNull()
    expect(last().shots[1]).not.toBeNull()
  })

  it('dispose cancels pending timers and later ticks do nothing', async () => {
    const { session, cap, states } = setup()
    session.startAll()
    await vi.advanceTimersByTimeAsync(1000)
    session.dispose()
    const count = states.length
    await vi.advanceTimersByTimeAsync(SHOT_MS * SHOT_COUNT)
    expect(states.length).toBe(count)
    expect(cap).not.toHaveBeenCalled()
  })

  it('dispose while a capture is in flight drops the late result', async () => {
    let resolve!: (v: Shot) => void
    const { session, states } = setup(() => new Promise<Shot>((r) => (resolve = r)))
    session.startAll()
    await vi.advanceTimersByTimeAsync(3000)
    session.dispose()
    const count = states.length
    resolve(fakeShot('late'))
    await vi.advanceTimersByTimeAsync(SHOT_MS * SHOT_COUNT)
    expect(states.length).toBe(count)
  })

  it('reset during a countdown cancels it and clears to idle', async () => {
    const { session, cap, last } = setup()
    session.startAll()
    await vi.advanceTimersByTimeAsync(1000)
    session.reset()
    expect(last()).toMatchObject({ phase: 'idle', currentIndex: 0, secondsLeft: 0 })
    expect(last().shots).toEqual([null, null, null])
    await vi.advanceTimersByTimeAsync(SHOT_MS * SHOT_COUNT)
    expect(cap).not.toHaveBeenCalled()
    expect(last().phase).toBe('idle')
  })

  it('setShot fills a slot without a countdown', () => {
    const { session, cap, last } = setup()
    const src = fakeShot('gallery') as unknown as CanvasImageSource
    session.setShot(2, src)
    expect(last().shots[2]).toBe(src)
    expect(last().phase).toBe('review')
    expect(cap).not.toHaveBeenCalled()
  })

  it('shots are kept when the owner switches frames', async () => {
    const { session, last } = setup()
    session.startAll()
    await vi.advanceTimersByTimeAsync(SHOT_MS * SHOT_COUNT)
    const kept = last().shots.slice()
    // the session has no frame input at all; nothing a frame change does can touch it
    await vi.advanceTimersByTimeAsync(10_000)
    expect(last().shots).toEqual(kept)
    expect(last().phase).toBe('review')
  })

  it('hands out fresh state objects, not the internal one', async () => {
    const { session, states } = setup()
    session.setShot(0, fakeShot('a') as unknown as CanvasImageSource)
    const first = states[0]
    session.setShot(1, fakeShot('b') as unknown as CanvasImageSource)
    expect(first.shots[1]).toBeNull()
    expect(states[1]).not.toBe(first)
    expect(states[1].shots).not.toBe(first.shots)
  })
})
