import { describe, expect, it } from 'vitest'
import { parseRams } from '@shared/schedule/parseRams'
import { SAMPLE_TERM2, SAMPLE_TERM3 } from '@shared/schedule/fixtures'
import type { ParsedSchedule } from '@shared/schedule/types'
import { renderAgenda } from './renderAgenda'
import { contentTop } from './safeZone'
import { createRecordingContext } from './testContext'
import type { RenderInput } from './types'

const SIZES: [number, number][] = [[1170, 2532], [1080, 1920], [1080, 2400]]

function draw(schedule: ParsedSchedule, width: number, height: number) {
  const ctx = createRecordingContext(width, height)
  const input: RenderInput = { schedule, width, height, theme: 'dark', layout: 'agenda', photo: null, dim: 0.4 }
  renderAgenda(ctx as unknown as CanvasRenderingContext2D, input)
  const texts = ctx.calls.filter((c) => c.op === 'fillText')
  return { texts, labels: texts.map((c) => c.text) }
}

const meeting = (day: 'Mon', start: number, end: number, room = '101') => ({ day, start, end, room })
const subject = (code: string, ...meetings: ReturnType<typeof meeting>[]) => ({ code, section: 'AB101', units: 3, instructor: '', meetings })

describe('renderAgenda', () => {
  it.each(SIZES)('keeps text out of the lock screen zone at %i x %i', (width, height) => {
    const { texts, labels } = draw(parseRams(SAMPLE_TERM2), width, height)
    expect(texts.length).toBeGreaterThan(0)
    for (const call of texts) expect(call.y).toBeGreaterThanOrEqual(contentTop(height))
    expect(labels).toEqual(expect.arrayContaining(['TUE · FRI', 'SAT', 'MIKE1 · 318', 'OSCAR1 · 502']))
  })

  describe('on a landscape screen', () => {
    it.each<[number, number]>([[1920, 1080], [2560, 1440], [1366, 768]])('starts near the top and lists the day groups side by side at %i x %i', (width, height) => {
      const { texts, labels } = draw(parseRams(SAMPLE_TERM2), width, height)
      for (const call of texts) expect(call.y).toBeGreaterThanOrEqual(contentTop(height, width))
      for (const call of texts) expect(call.y).toBeLessThanOrEqual(height * 0.96)
      const headings = texts.filter((c) => c.text === 'TUE · FRI' || c.text === 'SAT')
      expect(headings).toHaveLength(2)
      expect(headings[0].y).toBe(headings[1].y)
      expect(headings[0].x).toBeLessThan(headings[1].x!)
      expect(labels).toEqual(expect.arrayContaining(['MIKE1 · 318', 'OSCAR1 · 502']))
    })

    it('keeps every column inside the screen', () => {
      const { texts } = draw(parseRams(SAMPLE_TERM3), 1920, 1080)
      for (const call of texts) expect(call.x).toBeLessThan(1920)
    })

    it('stops at the bottom margin and adds a +N more line', () => {
      const many = Array.from({ length: 40 }, (_, i) => subject(`CODE${i}`, meeting('Mon', 480 + i * 10, 485 + i * 10)))
      const { texts, labels } = draw({ term: null, warnings: [], subjects: many }, 1920, 1080)
      for (const call of texts) expect(call.y).toBeLessThanOrEqual(1080 * 0.96)
      expect(labels.some((text) => /^\+[0-9]+ more$/.test(text ?? ''))).toBe(true)
    })
  })

  it('writes Async for a meeting with no room', () => {
    const { labels } = draw(parseRams(SAMPLE_TERM3), 1170, 2532)
    expect(labels).toContain('ALPHA1 · Async')
  })

  it('shows the instructor of each class', () => {
    const { labels } = draw(parseRams(SAMPLE_TERM3), 1170, 2532)
    expect(labels).toEqual(expect.arrayContaining(['Doe, Jordan', 'Smith, Pat', 'Cruz, Sam']))
  })

  it('draws the term as the title', () => {
    const schedule = { ...parseRams(SAMPLE_TERM2), term: '2026-2027 · Term 2' }
    expect(draw(schedule, 1170, 2532).labels).toContain('2026-2027 · Term 2')
  })

  it('says so when there are no classes', () => {
    const { labels } = draw({ term: null, subjects: [], warnings: [] }, 1170, 2532)
    expect(labels).toContain('No classes to show.')
    expect(labels.some((text) => text === 'MON' || text === 'TUE')).toBe(false)
  })

  it('marks overlapping classes', () => {
    const schedule = { term: null, warnings: [], subjects: [subject('AAA1', meeting('Mon', 540, 660)), subject('BBB1', meeting('Mon', 600, 720))] }
    expect(draw(schedule, 1170, 2532).labels).toContain('!')
    const clear = { ...schedule, subjects: [subject('AAA1', meeting('Mon', 540, 600)), subject('BBB1', meeting('Mon', 600, 720))] }
    expect(draw(clear, 1170, 2532).labels).not.toContain('!')
  })

  it('stops at the bottom margin and adds a +N more line', () => {
    const many = Array.from({ length: 40 }, (_, i) => subject(`CODE${i}`, meeting('Mon', 480 + i * 10, 485 + i * 10)))
    const { texts, labels } = draw({ term: null, warnings: [], subjects: many }, 1080, 1920)
    for (const call of texts) expect(call.y).toBeLessThanOrEqual(1920 * 0.96)
    expect(labels.some((text) => /^\+\d+ more$/.test(text ?? ''))).toBe(true)
  })
})
