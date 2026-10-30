import { describe, expect, it } from 'vitest'
import { parseRams } from '@shared/schedule/parseRams'
import { SAMPLE_TERM2, SAMPLE_TERM3 } from '@shared/schedule/fixtures'
import type { ParsedSchedule } from '@shared/schedule/types'
import { renderCards } from './renderCards'
import { contentTop } from './safeZone'
import { createRecordingContext } from './testContext'
import type { RenderInput } from './types'

const SIZES: [number, number][] = [[1170, 2532], [1080, 1920], [1080, 2400]]

function draw(schedule: ParsedSchedule, width = 1170, height = 2532) {
  const ctx = createRecordingContext(width, height)
  const input: RenderInput = { schedule, width, height, theme: 'dark', layout: 'cards', photo: null, dim: 0.4 }
  renderCards(ctx as unknown as CanvasRenderingContext2D, input)
  const texts = ctx.calls.filter((c) => c.op === 'fillText')
  return { texts, labels: texts.map((c) => c.text), cards: ctx.calls.filter((c) => c.op === 'roundRect') }
}

const subject = (code: string) => ({ code, section: 'AB101', units: 3, instructor: '', meetings: [{ day: 'Mon' as const, start: 540, end: 660, room: '101' }] })

describe('renderCards', () => {
  it.each(SIZES)('draws one card per subject below the lock screen zone at %i x %i', (width, height) => {
    const { texts, labels, cards } = draw(parseRams(SAMPLE_TERM2), width, height)
    expect(cards).toHaveLength(5)
    for (const call of texts) expect(call.y).toBeGreaterThanOrEqual(contentTop(height))
    for (const card of cards) expect(card.y).toBeGreaterThanOrEqual(contentTop(height))
    expect(labels).toEqual(expect.arrayContaining([
      'NOVEMBER1', 'Tue Fri · 7:30 to 9:30 AM · 208', 'OSCAR1', 'Sat · 7:30 to 11:30 AM · 502',
    ]))
  })

  describe('on a landscape screen', () => {
    it.each<[number, number]>([[1920, 1080], [2560, 1440], [1366, 768]])('sets the cards in rows of three below a small top gap at %i x %i', (width, height) => {
      const { texts, cards } = draw(parseRams(SAMPLE_TERM2), width, height)
      expect(cards).toHaveLength(5)
      for (const call of texts) expect(call.y).toBeGreaterThanOrEqual(contentTop(height, width))
      const rowOne = cards.filter((card) => card.y === cards[0].y)
      expect(rowOne).toHaveLength(3)
      expect(new Set(rowOne.map((card) => card.x)).size).toBe(3)
      for (const card of cards) expect(card.x! + card.w!).toBeLessThanOrEqual(width)
      for (const card of cards) expect(card.y! + card.h!).toBeLessThanOrEqual(height * 0.96)
    })

    it('keeps the pasted order across the rows', () => {
      const { labels } = draw(parseRams(SAMPLE_TERM2), 1920, 1080)
      const codes = labels.filter((text) => /^[A-Z0-9]+$/.test(text ?? ''))
      expect(codes).toEqual(['MIKE1', 'NOVEMBER1', 'OSCAR1', 'PAPA1', 'QUEBEC1'])
    })

    it('adds a +N more line when the rows run out of room', () => {
      const schedule = { term: null, warnings: [], subjects: Array.from({ length: 9 }, (_, i) => subject(`CODE${i + 1}`)) }
      const { cards, labels } = draw(schedule, 1366, 768)
      expect(cards.length).toBeLessThan(9)
      expect(labels.some((text) => /^\+[0-9]+ more$/.test(text ?? ''))).toBe(true)
      for (const card of cards) expect(card.y! + card.h!).toBeLessThanOrEqual(768 * 0.96)
    })
  })

  it('writes one line per distinct time and room', () => {
    const { labels } = draw(parseRams(SAMPLE_TERM3))
    expect(labels).toEqual(expect.arrayContaining(['Mon · 1:30 to 3:30 PM · 1001', 'Mon · 12:50 to 1:30 PM · Async']))
  })

  it('shows the instructor of each class', () => {
    const { labels } = draw(parseRams(SAMPLE_TERM3))
    expect(labels).toEqual(expect.arrayContaining(['Doe, Jordan', 'Smith, Pat', 'Cruz, Sam']))
  })

  it('keeps cards in the pasted order', () => {
    const { labels } = draw(parseRams(SAMPLE_TERM2))
    const codes = labels.filter((text) => /^[A-Z0-9]+$/.test(text ?? ''))
    expect(codes).toEqual(['MIKE1', 'NOVEMBER1', 'OSCAR1', 'PAPA1', 'QUEBEC1'])
  })

  it('draws seven cards and a +N more line for nine subjects', () => {
    const schedule = { term: null, warnings: [], subjects: Array.from({ length: 9 }, (_, i) => subject(`CODE${i + 1}`)) }
    const { cards, labels } = draw(schedule)
    expect(cards).toHaveLength(7)
    expect(labels).toContain('+2 more')
  })

  it('draws nothing below the bottom margin', () => {
    const schedule = { term: null, warnings: [], subjects: Array.from({ length: 9 }, (_, i) => subject(`CODE${i + 1}`)) }
    const { texts, cards } = draw(schedule, 1080, 1920)
    for (const call of texts) expect(call.y).toBeLessThanOrEqual(1920 * 0.96)
    for (const card of cards) expect(card.y! + card.h!).toBeLessThanOrEqual(1920 * 0.96)
  })

  it('says so when there are no classes', () => {
    expect(draw({ term: null, subjects: [], warnings: [] }).labels).toContain('No classes to show.')
  })
})
