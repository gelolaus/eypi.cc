import { describe, expect, it } from 'vitest'
import { normalizeText } from './parseRams'

describe('normalizeText', () => {
  it('turns browser whitespace into plain lines', () => {
    expect(normalizeText('A B\r\n\tC  \r\n\r\nD')).toBe('A B\nC\nD')
  })
})
