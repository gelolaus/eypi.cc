// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ParsedSchedule } from '@shared/schedule/types'
import type { LayoutId, RenderInput } from './types'

const drawn = vi.hoisted(() => ({ grid: vi.fn(), agenda: vi.fn(), cards: vi.fn() }))
vi.mock('./renderGrid', () => ({ renderGrid: drawn.grid }))
vi.mock('./renderAgenda', () => ({ renderAgenda: drawn.agenda }))
vi.mock('./renderCards', () => ({ renderCards: drawn.cards }))

import { render, renderToBlob, wallpaperFilename } from './render'

const schedule: ParsedSchedule = { term: '2026-2027 · Term 2', subjects: [], warnings: [] }
const input = (layout: LayoutId): RenderInput => ({ schedule, width: 1170, height: 2532, theme: 'dark', layout, photo: null, dim: 0.4 })

describe('render', () => {
  beforeEach(() => vi.clearAllMocks())

  it.each([['grid', 'grid'], ['agenda', 'agenda'], ['cards', 'cards']] as const)('draws only the %s layout', async (layout, key) => {
    const ctx = {}
    const canvas = { width: 0, height: 0, getContext: () => ctx } as unknown as HTMLCanvasElement
    await render(canvas, input(layout))
    expect(canvas.width).toBe(1170)
    expect(canvas.height).toBe(2532)
    for (const name of ['grid', 'agenda', 'cards'] as const) {
      expect(drawn[name]).toHaveBeenCalledTimes(name === key ? 1 : 0)
    }
    expect(drawn[key]).toHaveBeenCalledWith(ctx, input(layout))
  })
})

describe('renderToBlob', () => {
  afterEach(() => vi.restoreAllMocks())

  const stubCanvas = (blob: Blob | null) => {
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({}),
      toBlob: (done: (value: Blob | null) => void, type: string) => {
        expect(type).toBe('image/png')
        done(blob)
      },
    }
    vi.spyOn(document, 'createElement').mockReturnValue(canvas as unknown as HTMLCanvasElement)
  }

  it('resolves a PNG blob', async () => {
    const png = new Blob(['x'], { type: 'image/png' })
    stubCanvas(png)
    await expect(renderToBlob(input('agenda'))).resolves.toBe(png)
  })

  it('rejects when the canvas gives no blob', async () => {
    stubCanvas(null)
    await expect(renderToBlob(input('agenda'))).rejects.toThrow('Could not render the image. Try again.')
  })
})

describe('wallpaperFilename', () => {
  it('names the file after the term', () => {
    expect(wallpaperFilename(schedule, 'agenda')).toBe('eypi-schedule-2026-2027-term-2.png')
  })

  it('falls back to a plain name without a term', () => {
    expect(wallpaperFilename({ ...schedule, term: null }, 'agenda')).toBe('eypi-schedule.png')
  })
})
