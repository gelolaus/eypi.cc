import { describe, expect, it } from 'vitest'
import { applyFilter, BOOTH_FILTERS, type BoothFilterId } from './filters'

const IDS: BoothFilterId[] = ['normal', 'soft', 'bright', 'warm', 'cool', 'film', 'matte', 'bw', 'vivid']

// skin tone, mid grey, dark, saturated, transparent skin tone
const PIXELS = [
  [224, 172, 140, 255],
  [128, 128, 128, 255],
  [20, 18, 22, 255],
  [220, 40, 60, 255],
  [224, 172, 140, 0],
  [10, 200, 90, 128],
]

function sample() {
  return new Uint8ClampedArray(PIXELS.flat())
}

function lum(d: Uint8ClampedArray, i: number) {
  return 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]
}

function sat(d: Uint8ClampedArray, i: number) {
  const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2]
  return Math.max(r, g, b) - Math.min(r, g, b)
}

function run(id: BoothFilterId, data = sample()) {
  applyFilter(id, data, PIXELS.length, 1)
  return data
}

describe('applyFilter', () => {
  for (const id of IDS) {
    it(`${id}: keeps alpha unchanged`, () => {
      const out = run(id)
      PIXELS.forEach((p, i) => expect(out[i * 4 + 3]).toBe(p[3]))
    })
    it(`${id}: is deterministic (same input, same output)`, () => {
      expect(Array.from(run(id))).toEqual(Array.from(run(id)))
    })
    it(`${id}: keeps values in 0-255`, () => {
      const extreme = new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255, 255, 0, 0, 255])
      applyFilter(id, extreme, 3, 1)
      for (const v of extreme) {
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(255)
      }
    })
  }

  it('normal leaves pixels identical', () => {
    expect(Array.from(run('normal'))).toEqual(Array.from(sample()))
  })

  it('bw makes r, g and b equal', () => {
    const out = run('bw')
    for (let i = 0; i < PIXELS.length; i++) {
      expect(out[i * 4]).toBe(out[i * 4 + 1])
      expect(out[i * 4 + 1]).toBe(out[i * 4 + 2])
    }
  })

  it('warm raises red relative to blue', () => {
    const before = sample()
    const out = run('warm')
    for (const i of [0, 1, 2, 3]) {
      expect(out[i * 4] - out[i * 4 + 2]).toBeGreaterThan(before[i * 4] - before[i * 4 + 2])
    }
  })

  it('cool raises blue relative to red', () => {
    const before = sample()
    const out = run('cool')
    for (const i of [0, 1, 2, 3]) {
      expect(out[i * 4 + 2] - out[i * 4]).toBeGreaterThan(before[i * 4 + 2] - before[i * 4])
    }
  })

  it('bright raises mean luminance', () => {
    const before = sample()
    const out = run('bright')
    let a = 0, b = 0
    for (let i = 0; i < PIXELS.length; i++) {
      a += lum(before, i)
      b += lum(out, i)
    }
    expect(b).toBeGreaterThan(a)
  })

  it('matte raises the darkest value (lifted blacks)', () => {
    const data = new Uint8ClampedArray([0, 0, 0, 255, 5, 5, 5, 255])
    applyFilter('matte', data, 2, 1)
    expect(Math.min(data[0], data[1], data[2])).toBeGreaterThan(0)
  })

  it('vivid raises saturation of a muted pixel', () => {
    const muted = new Uint8ClampedArray([140, 120, 110, 255])
    const before = sat(muted, 0)
    applyFilter('vivid', muted, 1, 1)
    expect(sat(muted, 0)).toBeGreaterThan(before)
  })

  it('film grain is the same for the same pixel index across runs', () => {
    const grey = () => new Uint8ClampedArray(Array.from({ length: 16 }, () => [128, 128, 128, 255]).flat())
    const a = grey()
    const b = grey()
    applyFilter('film', a, 4, 4)
    applyFilter('film', b, 4, 4)
    expect(Array.from(a)).toEqual(Array.from(b))
    // grain actually varies between pixels
    expect(new Set(Array.from({ length: 16 }, (_, i) => a[i * 4])).size).toBeGreaterThan(1)
  })

  it('BOOTH_FILTERS lists the nine ids in order', () => {
    expect(BOOTH_FILTERS.map((f) => f.id)).toEqual(IDS)
    expect(BOOTH_FILTERS.map((f) => f.label)).toEqual([
      'Normal', 'Soft', 'Bright', 'Warm', 'Cool', 'Film', 'Matte', 'B&W', 'Vivid',
    ])
  })
})
