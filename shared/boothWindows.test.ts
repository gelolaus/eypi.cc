import { describe, expect, it } from 'vitest'
import {
  BOOTH_HEIGHT,
  BOOTH_WIDTH,
  parseWindows,
  sortWindows,
  validateBoothWindows,
  type BoothWindow,
} from './boothWindows'

const three: BoothWindow[] = [
  { x: 90, y: 100, w: 900, h: 500 },
  { x: 90, y: 700, w: 900, h: 500 },
  { x: 90, y: 1300, w: 900, h: 500 },
]

const check = (windows: unknown) => validateBoothWindows(windows, BOOTH_WIDTH, BOOTH_HEIGHT)

describe('validateBoothWindows', () => {
  it('accepts three separate windows', () => {
    expect(check(three)).toBeNull()
  })

  it('rejects 2 and 4 windows with a message that names the count', () => {
    expect(check(three.slice(0, 2))).toBe(
      'We found 2 photo windows. A booth frame needs exactly 3 separate transparent areas.',
    )
    expect(check([...three, { x: 0, y: 0, w: 100, h: 100 }])).toBe(
      'We found 4 photo windows. A booth frame needs exactly 3 separate transparent areas.',
    )
    expect(check('nope')).not.toBeNull()
  })

  it('rejects a window outside the image', () => {
    expect(check([three[0], three[1], { x: 500, y: 1300, w: 900, h: 500 }])).not.toBeNull()
    expect(check([three[0], three[1], { x: 90, y: 1500, w: 900, h: 500 }])).not.toBeNull()
  })

  it('rejects overlapping windows', () => {
    expect(check([three[0], { x: 90, y: 500, w: 900, h: 500 }, three[2]])).not.toBeNull()
  })

  it('accepts windows that only touch edges', () => {
    const touching: BoothWindow[] = [
      { x: 0, y: 0, w: 1080, h: 600 },
      { x: 0, y: 600, w: 1080, h: 600 },
      { x: 0, y: 1200, w: 1080, h: 720 },
    ]
    expect(check(touching)).toBeNull()
  })

  it('rejects a window under 5% of the width or height', () => {
    expect(check([three[0], three[1], { x: 90, y: 1300, w: 53, h: 500 }])).not.toBeNull()
    expect(check([three[0], three[1], { x: 90, y: 1300, w: 900, h: 95 }])).not.toBeNull()
    expect(check([three[0], three[1], { x: 90, y: 1300, w: 54, h: 96 }])).toBeNull()
  })

  it('rejects non-integer, negative or non-numeric values', () => {
    expect(check([three[0], three[1], { x: 90.5, y: 1300, w: 900, h: 500 }])).not.toBeNull()
    expect(check([three[0], three[1], { x: -1, y: 1300, w: 900, h: 500 }])).not.toBeNull()
    expect(check([three[0], three[1], { x: 90, y: 1300, w: '900', h: 500 }])).not.toBeNull()
    expect(check([three[0], three[1], null])).not.toBeNull()
  })
})

describe('sortWindows', () => {
  it('orders by y then x without mutating the input', () => {
    const input: BoothWindow[] = [
      { x: 500, y: 10, w: 1, h: 1 },
      { x: 0, y: 50, w: 1, h: 1 },
      { x: 100, y: 10, w: 1, h: 1 },
    ]
    const copy = JSON.parse(JSON.stringify(input))
    const sorted = sortWindows(input)
    expect(sorted.map((w) => [w.x, w.y])).toEqual([
      [100, 10],
      [500, 10],
      [0, 50],
    ])
    expect(sorted).not.toBe(input)
    expect(input).toEqual(copy)
  })
})

describe('parseWindows', () => {
  it('reads a JSON string, passes an array, and returns null for garbage', () => {
    expect(parseWindows(JSON.stringify(three))).toEqual(three)
    expect(parseWindows(three)).toEqual(three)
    expect(parseWindows(null)).toBeNull()
    expect(parseWindows(undefined)).toBeNull()
    expect(parseWindows('not json')).toBeNull()
    expect(parseWindows('{"x":1}')).toBeNull()
    expect(parseWindows([{ x: 1 }])).toBeNull()
  })
})
