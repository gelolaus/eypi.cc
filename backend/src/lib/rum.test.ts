import { describe, expect, it } from 'vitest'
import { parseRumBatch } from './rum'

const good = {
  route: 'home',
  metric: 'LCP',
  value: 1800,
  rating: 'good',
  device: 'mobile',
  connection: '4g',
  navType: 'navigate',
}

describe('parseRumBatch', () => {
  it('accepts a valid batch', () => {
    const parsed = parseRumBatch([good, { ...good, metric: 'CLS', value: 0.05, connection: undefined, navType: undefined }])
    expect(parsed).toHaveLength(2)
    expect(parsed?.[1]).toMatchObject({ metric: 'CLS', connection: null, navType: null })
  })

  it('rejects malformed batches', () => {
    expect(parseRumBatch([{ ...good, route: 'nope' }])).toBeNull()
    expect(parseRumBatch([{ ...good, value: NaN }])).toBeNull()
    expect(parseRumBatch([{ ...good, value: -1 }])).toBeNull()
    expect(parseRumBatch([{ ...good, value: 1e9 }])).toBeNull()
    expect(parseRumBatch([{ ...good, metric: 'CLS', value: 11 }])).toBeNull()
    expect(parseRumBatch(Array.from({ length: 11 }, () => good))).toBeNull()
    expect(parseRumBatch({ ...good })).toBeNull()
  })
})
