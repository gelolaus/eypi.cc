import { describe, expect, it } from 'vitest'
import { selectAttendees } from './selection'

const mapping = { emailCol: 'email', clusterCol: 'cluster' }

describe('selectAttendees', () => {
  it('duplicate emails count once', () => {
    const rows = [
      { id: '1', rawData: { email: 'Dup@x.com', cluster: 'A' } },
      { id: '2', rawData: { email: 'dup@x.com', cluster: 'A' } },
      { id: '3', rawData: { email: ' DUP@x.com ', cluster: 'A' } },
      { id: '4', rawData: { email: 'other@x.com', cluster: 'A' } },
    ]

    const result = selectAttendees(rows, {
      mapping,
      clusters: [{ value: 'A', maxCount: 2, filters: {} }],
      globalFilters: {},
      guaranteed: [],
      seed: 'dup',
    })

    expect(result.selected.map((row) => row.id)).toEqual(['1', '4'])
    expect(result.byCluster).toEqual({ A: 2 })
  })

  it('filters exclude ineligible rows', () => {
    const rows = [
      { id: 'yes-1', rawData: { email: 'y1@x.com', cluster: 'A', status: 'yes' } },
      { id: 'no-1', rawData: { email: 'n1@x.com', cluster: 'A', status: 'no' } },
      { id: 'yes-2', rawData: { email: 'y2@x.com', cluster: 'A', status: 'yes' } },
    ]

    const result = selectAttendees(rows, {
      mapping,
      clusters: [{ value: 'A', maxCount: 10, filters: { status: ['yes'] } }],
      globalFilters: {},
      guaranteed: [],
      seed: 'filter',
    })

    expect(result.selected.map((row) => row.id)).toEqual(['yes-1', 'yes-2'])
    expect(result.byCluster).toEqual({ A: 2 })
  })

  it('guaranteed rows are kept within quota', () => {
    const rows = [
      { id: 'g1', rawData: { email: 'g1@x.com', cluster: 'A', status: 'no' } },
      { id: 'g2', rawData: { email: 'g2@x.com', cluster: 'A', status: 'no' } },
      { id: 'a', rawData: { email: 'a@x.com', cluster: 'A', status: 'yes' } },
      { id: 'b', rawData: { email: 'b@x.com', cluster: 'A', status: 'yes' } },
    ]

    const result = selectAttendees(rows, {
      mapping,
      clusters: [{ value: 'A', maxCount: 1, filters: { status: ['yes'] } }],
      globalFilters: {},
      guaranteed: ['g1', 'g2'],
      seed: 'keep',
    })

    expect(result.selected.map((row) => row.id)).toEqual(['g1'])
    expect(result.byCluster).toEqual({ A: 1 })
  })

  it('same seed → same result', () => {
    const rows = Array.from({ length: 8 }, (_, index) => ({
      id: `r${index}`,
      rawData: { email: `p${index}@x.com`, cluster: 'A' },
    }))
    const opts = {
      mapping,
      clusters: [{ value: 'A', maxCount: 3, filters: {} }],
      globalFilters: {},
      guaranteed: [] as string[],
      seed: 'raffle-seed',
    }

    const first = selectAttendees(rows, opts).selected.map((row) => row.id)
    expect(first).toEqual(['r1', 'r0', 'r5'])
    for (let i = 0; i < 10; i++) {
      expect(selectAttendees(rows, opts).selected.map((row) => row.id)).toEqual(first)
    }
    expect(selectAttendees(rows, { ...opts, seed: 'other-seed' }).selected.map((row) => row.id)).not.toEqual(first)
  })
})
