import { describe, expect, it } from 'vitest'
import { parseRams } from '@shared/schedule/parseRams'
import { SAMPLE_TERM2, SAMPLE_TERM3 } from '@shared/schedule/fixtures'
import type { ParsedSchedule } from '@shared/schedule/types'
import { renderGrid } from './renderGrid'
import { contentTop } from './safeZone'
import { createRecordingContext } from './testContext'
import type { RenderInput } from './types'

const SIZES: [number, number][] = [[1170, 2532], [1080, 1920], [1080, 2400]]

function draw(schedule: ParsedSchedule, width = 1170, height = 2532) {
  const ctx = createRecordingContext(width, height)
  const input: RenderInput = { schedule, width, height, theme: 'dark', layout: 'grid', photo: null, dim: 0.4 }
  renderGrid(ctx as unknown as CanvasRenderingContext2D, input)
  const texts = ctx.calls.filter((c) => c.op === 'fillText')
  return { texts, labels: texts.map((c) => c.text), blocks: ctx.calls.filter((c) => c.op === 'roundRect') }
}

const subject = (code: string, day: 'Mon' | 'Tue', start: number, end: number) =>
  ({ code, section: 'AB101', units: 3, instructor: '', meetings: [{ day, start, end, room: '101' }] })
const make = (...subjects: ReturnType<typeof subject>[]): ParsedSchedule => ({ term: null, warnings: [], subjects })

describe('renderGrid', () => {
  it.each(SIZES)('draws day columns below the lock screen zone at %i x %i', (width, height) => {
    const { texts, labels } = draw(parseRams(SAMPLE_TERM2), width, height)
    for (const call of texts) expect(call.y).toBeGreaterThanOrEqual(contentTop(height))
    expect(labels).toEqual(expect.arrayContaining(['TUE', 'FRI', 'SAT']))
    expect(labels).not.toContain('MON')
    const codes = ['MIKE1', 'NOVEMBER1', 'OSCAR1', 'PAPA1', 'QUEBEC1']
    expect(codes.filter((code) => labels.includes(code))).toHaveLength(5)
  })

  it.each<[number, number]>([[1920, 1080], [2560, 1440], [1366, 768]])('fills the width of a landscape screen below a small top gap at %i x %i', (width, height) => {
    const { texts, blocks } = draw(parseRams(SAMPLE_TERM2), width, height)
    for (const call of texts) expect(call.y).toBeGreaterThanOrEqual(contentTop(height, width))
    for (const call of texts) expect(call.y).toBeLessThanOrEqual(height * 0.96)
    for (const block of blocks) expect(block.y! + block.h!).toBeLessThanOrEqual(height * 0.96)
    expect(Math.max(...blocks.map((b) => b.x! + b.w!))).toBeGreaterThan(width * 0.85)
    expect(Math.max(...blocks.map((b) => b.x! + b.w!))).toBeLessThanOrEqual(width)
  })

  it('labels the grid every two hours from 7:30 and borders it on the whole hours', () => {
    const { texts, blocks } = draw(parseRams(SAMPLE_TERM2))
    const ticks = texts.filter((c) => /^[0-9]{1,2}:30$/.test(c.text ?? ''))
    expect(ticks.map((c) => c.text)).toEqual(['7:30', '9:30', '11:30', '1:30', '3:30', '5:30'])
    expect(texts.some((c) => /^[0-9]{1,2} (AM|PM)$/.test(c.text ?? ''))).toBe(false)
    const gaps = ticks.slice(1).map((c, i) => c.y - ticks[i].y)
    for (const gap of gaps) expect(gap).toBeCloseTo(gaps[0])
    // a 7:30 class starts on the first label's line
    const firstBlock = Math.min(...blocks.map((b) => b.y!))
    expect(firstBlock).toBeLessThan(ticks[0].y + 40)
  })

  it('draws lines at both borders and at each label', () => {
    const ctx = createRecordingContext(1170, 2532)
    renderGrid(ctx as unknown as CanvasRenderingContext2D, { schedule: parseRams(SAMPLE_TERM2), width: 1170, height: 2532, theme: 'dark', layout: 'grid', photo: null, dim: 0.4 })
    const lines = ctx.calls.filter((c) => c.op === 'fillRect' && c.w! < 1170)
    expect(lines).toHaveLength(8)
  })

  it('places blocks by time and sizes them by duration', () => {
    const { blocks } = draw(make(subject('AAA1', 'Mon', 450, 570), subject('BBB1', 'Mon', 570, 690), subject('CCC1', 'Tue', 450, 570)))
    expect(blocks).toHaveLength(3)
    const [early, later, other] = blocks
    expect(early.y!).toBeLessThan(later.y!)
    expect(early.h).toBeCloseTo(later.h!)
    expect(other.h).toBeCloseTo(early.h!)
  })

  it('splits the column between overlapping classes', () => {
    const alone = draw(make(subject('AAA1', 'Mon', 540, 660))).blocks[0]
    const { blocks } = draw(make(subject('AAA1', 'Mon', 540, 660), subject('BBB1', 'Mon', 600, 720)))
    expect(blocks).toHaveLength(2)
    for (const block of blocks) expect(block.w!).toBeLessThanOrEqual(alone.w! / 2)
    expect(blocks[0].x).not.toBe(blocks[1].x)
  })

  it('shows the instructor of each class', () => {
    const { labels } = draw(parseRams(SAMPLE_TERM3))
    expect(labels).toEqual(expect.arrayContaining(['Doe, Jordan', 'Smith, Pat', 'Cruz, Sam']))
  })

  it('lists async classes under the grid', () => {
    const { texts, blocks } = draw(parseRams(SAMPLE_TERM3))
    const async = texts.find((c) => c.text?.includes('Async'))!
    expect(async.text).toContain('ALPHA1')
    for (const block of blocks) expect(async.y).toBeGreaterThan(block.y! + block.h!)
  })

  it('says so when there are no classes', () => {
    expect(draw({ term: null, subjects: [], warnings: [] }).labels).toContain('No classes to show.')
  })

  it('draws nothing below the bottom margin', () => {
    const { texts } = draw(parseRams(SAMPLE_TERM3), 1080, 1920)
    for (const call of texts) expect(call.y).toBeLessThanOrEqual(1920 * 0.96)
  })
})
