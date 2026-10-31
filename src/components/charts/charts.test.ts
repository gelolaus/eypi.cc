// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import BarList from './BarList.vue'
import HeatGrid from './HeatGrid.vue'
import LineChart from './LineChart.vue'
import SparkLine from './SparkLine.vue'
import StatTile from './StatTile.vue'
import { linearScale, niceTicks } from './scale'

afterEach(() => vi.restoreAllMocks())

function expectAccessible(w: ReturnType<typeof mount>) {
  const el = w.find('[role="img"]')
  expect(el.exists()).toBe(true)
  expect(el.attributes('aria-label')).toBeTruthy()
  // A table ignores width and overflow, so a bare `table.sr-only` stays as wide as its columns and
  // makes the whole page scroll sideways on phones. The clipping box has to be a wrapper around it.
  expect(w.find('.sr-only table').exists()).toBe(true)
  expect(w.find('table.sr-only').exists()).toBe(false)
}

describe('scale', () => {
  it('niceTicks(87)', () => expect(niceTicks(87)).toEqual([0, 20, 40, 60, 80, 100]))
  it('niceTicks fractional', () => expect(niceTicks(0.7)).toEqual([0, 0.2, 0.4, 0.6, 0.8]))
  it('linearScale maps domain to range', () => {
    const s = linearScale([0, 10], [100, 0])
    expect(s(0)).toBe(100)
    expect(s(5)).toBe(50)
  })
})

describe('charts', () => {
  it('SparkLine', () => {
    const w = mount(SparkLine, { props: { values: [1, 3, 2], label: 'Clicks trend' } })
    expectAccessible(w)
    expect(w.findAll('table td').map((t) => t.text())).toEqual(['1', '3', '2'])
  })
  it('LineChart', () => {
    const w = mount(LineChart, {
      props: { yLabel: 'Clicks', series: [{ label: 'A', points: [{ x: 'Mon', y: 4 }, { x: 'Tue', y: 9 }] }] },
    })
    expectAccessible(w)
    expect(w.find('table').text()).toContain('9')
  })
  it('LineChart distinguishes series without color', () => {
    const pts = [{ x: 'Mon', y: 4 }, { x: 'Tue', y: 9 }]
    const w = mount(LineChart, { props: { yLabel: 'Clicks', series: [{ label: 'A', points: pts }, { label: 'B', points: pts }] } })
    const dashes = w.findAll('path[stroke-dasharray]').map((p) => p.attributes('stroke-dasharray'))
    expect(new Set(dashes).size).toBe(2)
    const markers = w.findAll('path[data-marker]').map((p) => p.attributes('data-marker'))
    expect(new Set(markers).size).toBe(2)
  })
  it('LineChart marks a single point', () => {
    const w = mount(LineChart, { props: { yLabel: 'Clicks', series: [{ label: 'A', points: [{ x: 'Mon', y: 4 }] }] } })
    expect(w.find('path[data-marker]').attributes('d')).toBeTruthy()
  })
  it('BarList clamps negatives', () => {
    const w = mount(BarList, { props: { items: [{ label: 'x', value: -3 }], max: 10 } })
    expect(w.find('div.h-2 > div').attributes('style')).toContain('width: 0%')
  })
  it('BarList', () => {
    const w = mount(BarList, { props: { items: [{ label: 'Mail', value: 5 }] } })
    expectAccessible(w)
    expect(w.find('table').text()).toContain('Mail')
  })
  it('HeatGrid renders 168 values', () => {
    const w = mount(HeatGrid, { props: { cells: Array.from({ length: 168 }, (_, i) => i), label: 'Clicks by hour' } })
    expectAccessible(w)
    expect(w.findAll('table tbody td')).toHaveLength(168)
  })
  it('HeatGrid warns and renders nothing for wrong length', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const w = mount(HeatGrid, { props: { cells: [1, 2], label: 'x' } })
    expect(warn).toHaveBeenCalled()
    expect(w.find('svg').exists()).toBe(false)
  })
  it('StatTile shows deltas as text', () => {
    expect(mount(StatTile, { props: { label: 'Clicks', value: '10', delta: 12 } }).text()).toContain('+12%')
    expect(mount(StatTile, { props: { label: 'Clicks', value: '10', delta: -5 } }).text()).toContain('−5%')
    const zero = mount(StatTile, { props: { label: 'Clicks', value: '10', delta: 0.2 } })
    expect(zero.text()).toContain('0%')
    expect(zero.text()).not.toMatch(/increase|decrease|\+/)
    expect(mount(StatTile, { props: { label: 'Clicks', value: '10', delta: null } }).find('[data-testid="delta"]').exists()).toBe(false)
  })
})
