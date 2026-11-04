// Framework-free photo booth session: 3-2-1 before every shot, a short pause
// after each, then review. No Vue and no DOM so the timing is unit-testable.

export const COUNTDOWN_SECONDS = 3
export const SHOT_PAUSE_MS = 1000
export const SHOT_COUNT = 3

export type BoothPhase = 'idle' | 'counting' | 'flash' | 'review'

export type BoothState = {
  phase: BoothPhase
  shots: (CanvasImageSource | null)[]
  currentIndex: number
  secondsLeft: number
}

export type BoothSession = {
  startAll(): void
  retake(index: number): void
  setShot(index: number, source: CanvasImageSource): void
  reset(): void
  dispose(): void
}

export type BoothSessionDeps = {
  capture: () => Promise<ImageBitmap | HTMLCanvasElement | null>
  onChange: (state: BoothState) => void
}

function emptyShots(): (CanvasImageSource | null)[] {
  return Array.from({ length: SHOT_COUNT }, () => null)
}

export function createBoothSession(deps: BoothSessionDeps): BoothSession {
  let phase: BoothPhase = 'idle'
  let shots = emptyShots()
  let currentIndex = 0
  let secondsLeft = 0
  let generation = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  let disposed = false

  function emit() {
    deps.onChange({ phase, shots: shots.slice(), currentIndex, secondsLeft })
  }

  function clearTimer() {
    if (timer !== null) clearTimeout(timer)
    timer = null
  }

  // Invalidates every pending step (timers and in-flight captures).
  function invalidate() {
    generation++
    clearTimer()
  }

  function wait(ms: number, gen: number, next: () => void) {
    timer = setTimeout(() => {
      timer = null
      if (gen !== generation) return
      next()
    }, ms)
  }

  // 3-2-1, capture, flash/pause, then done().
  function runShot(index: number, gen: number, done: () => void) {
    phase = 'counting'
    currentIndex = index
    secondsLeft = COUNTDOWN_SECONDS
    emit()

    const tick = () => {
      secondsLeft--
      if (secondsLeft > 0) {
        emit()
        wait(1000, gen, tick)
        return
      }
      secondsLeft = 0
      void takeShot()
    }

    const takeShot = async () => {
      let shot: CanvasImageSource | null = null
      try {
        shot = await deps.capture()
      } catch {
        shot = null
      }
      if (gen !== generation) return
      shots[index] = shot
      phase = 'flash'
      emit()
      wait(SHOT_PAUSE_MS, gen, done)
    }

    wait(1000, gen, tick)
  }

  function busy() {
    return phase === 'counting' || phase === 'flash'
  }

  return {
    startAll() {
      if (disposed || busy()) return
      invalidate()
      const gen = generation
      shots = emptyShots()
      const step = (i: number) => {
        if (i >= SHOT_COUNT) {
          phase = 'review'
          currentIndex = 0
          secondsLeft = 0
          emit()
          return
        }
        runShot(i, gen, () => step(i + 1))
      }
      step(0)
    },

    retake(index) {
      if (disposed || phase !== 'review') return
      if (!Number.isInteger(index) || index < 0 || index >= SHOT_COUNT) return
      invalidate()
      const gen = generation
      runShot(index, gen, () => {
        phase = 'review'
        secondsLeft = 0
        emit()
      })
    },

    setShot(index, source) {
      if (disposed || busy()) return
      if (!Number.isInteger(index) || index < 0 || index >= SHOT_COUNT) return
      shots[index] = source
      phase = 'review'
      secondsLeft = 0
      emit()
    },

    reset() {
      if (disposed) return
      invalidate()
      shots = emptyShots()
      phase = 'idle'
      currentIndex = 0
      secondsLeft = 0
      emit()
    },

    dispose() {
      disposed = true
      invalidate()
    },
  }
}
