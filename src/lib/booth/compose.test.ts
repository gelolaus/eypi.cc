import { describe, expect, it } from 'vitest'
import type { BoothWindow } from '@shared/boothWindows'
import { composeStrip, coverCrop } from './compose'

describe('coverCrop', () => {
  it('for a square source into a tall window crops the sides equally', () => {
    const c = coverCrop(1000, 1000, 300, 600)
    expect(c.sh).toBe(1000)
    expect(c.sw).toBeCloseTo(500, 5)
    expect(c.sy).toBe(0)
    expect(c.sx).toBeCloseTo(250, 5)
    expect(c.sx + c.sw / 2).toBeCloseTo(500, 5)
  })

  it('for a wide source into a wide window crops nothing', () => {
    expect(coverCrop(1600, 900, 800, 450)).toEqual({ sx: 0, sy: 0, sw: 1600, sh: 900 })
  })

  it('for a very wide window from a portrait source crops top and bottom', () => {
    const c = coverCrop(900, 1600, 900, 300)
    expect(c.sw).toBe(900)
    expect(c.sx).toBe(0)
    expect(c.sh).toBeCloseTo(300, 5)
    expect(c.sy).toBeCloseTo(650, 5)
  })

  it('never exceeds the source and keeps the destination aspect ratio', () => {
    const cases = [
      [1920, 1080, 400, 700],
      [1080, 1920, 900, 500],
      [640, 480, 300, 300],
      [333, 777, 120, 90],
      [1000, 1000, 1000, 1000],
    ]
    for (const [srcW, srcH, dw, dh] of cases) {
      const { sx, sy, sw, sh } = coverCrop(srcW, srcH, dw, dh)
      expect(sx).toBeGreaterThanOrEqual(0)
      expect(sy).toBeGreaterThanOrEqual(0)
      expect(sx + sw).toBeLessThanOrEqual(srcW + 1e-6)
      expect(sy + sh).toBeLessThanOrEqual(srcH + 1e-6)
      expect(Math.abs(sw * (dh / dw) - sh)).toBeLessThanOrEqual(1)
    }
  })
})

type Call = { op: string; args: unknown[]; ctx: string }

function makeStub(name: string, calls: Call[]) {
  const record = (op: string) => (...args: unknown[]) => {
    calls.push({ op, args, ctx: name })
  }
  let size = { w: 0, h: 0 }
  const ctx = {
    canvas: { id: `${name}-canvas` },
    drawImage: record('drawImage'),
    putImageData: record('putImageData'),
    clearRect: record('clearRect'),
    scale: record('scale'),
    transform: record('transform'),
    setTransform: record('setTransform'),
    getImageData: (_x: number, _y: number, w: number, h: number) => {
      size = { w, h }
      return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h }
    },
    get size() {
      return size
    },
  }
  return ctx
}

const windows: BoothWindow[] = [
  { x: 100, y: 100, w: 400, h: 500 },
  { x: 100, y: 700, w: 400, h: 500 },
  { x: 100, y: 1300, w: 400, h: 500 },
]

function run(shots: (object | null)[]) {
  const calls: Call[] = []
  const main = makeStub('main', calls)
  const frame = { id: 'frame' }
  composeStrip(main as unknown as CanvasRenderingContext2D, {
    frame: frame as unknown as CanvasImageSource,
    windows,
    shots: shots as (CanvasImageSource | null)[],
    shotSize: () => ({ width: 1080, height: 1080 }),
    filter: 'normal',
    makeScratch: (w, h) => {
      const s = makeStub('scratch', calls)
      calls.push({ op: 'makeScratch', args: [w, h], ctx: 'main' })
      return s as unknown as CanvasRenderingContext2D
    },
  })
  return { calls, frame }
}

describe('composeStrip', () => {
  it('draws shots first and the frame last', () => {
    const { calls, frame } = run([{ id: 1 }, { id: 2 }, { id: 3 }])
    const mainDraws = calls.filter((c) => c.ctx === 'main' && c.op === 'drawImage')
    expect(mainDraws).toHaveLength(4)
    expect(mainDraws[3].args[0]).toBe(frame)
    expect(mainDraws[3].args.slice(1)).toEqual([0, 0, 1080, 1920])
    expect(mainDraws.slice(0, 3).every((c) => c.args[0] !== frame)).toBe(true)
  })

  it('skips a null shot', () => {
    const { calls } = run([{ id: 1 }, null, { id: 3 }])
    const mainDraws = calls.filter((c) => c.ctx === 'main' && c.op === 'drawImage')
    expect(mainDraws).toHaveLength(3)
    expect(calls.filter((c) => c.op === 'makeScratch')).toHaveLength(2)
  })

  it('draws into each window rectangle', () => {
    const { calls } = run([{ id: 1 }, { id: 2 }, { id: 3 }])
    const mainDraws = calls.filter((c) => c.ctx === 'main' && c.op === 'drawImage').slice(0, 3)
    mainDraws.forEach((c, i) => {
      const w = windows[i]
      expect(c.args.slice(1)).toEqual([w.x, w.y, w.w, w.h])
    })
  })

  it('does not flip the canvas (no negative scale)', () => {
    const { calls } = run([{ id: 1 }, { id: 2 }, { id: 3 }])
    expect(calls.some((c) => c.op === 'scale' || c.op === 'transform' || c.op === 'setTransform')).toBe(false)
    for (const c of calls.filter((x) => x.op === 'drawImage')) {
      const nums = c.args.filter((a): a is number => typeof a === 'number')
      expect(nums.every((n) => n >= 0)).toBe(true)
    }
  })
})
