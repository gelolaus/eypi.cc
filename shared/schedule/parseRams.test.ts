import { describe, expect, it } from 'vitest'
import { normalizeText, parseTerm } from './parseRams'

describe('normalizeText', () => {
  it('turns browser whitespace into plain lines', () => {
    expect(normalizeText('A B
	C  

D')).toBe('A B
C
D')
  })
})

describe('parseTerm', () => {
  it('reads the term from the two-line RAMS label', () => {
    expect(parseTerm('Academic Year & Term: 2026\n -2027, Term 2')).toBe('2026-2027 · Term 2')
  })

  it('reads the term when the label is on one line with a stray space', () => {
    expect(parseTerm('Academic Year & Term: 2025 -2026, Term 3')).toBe('2025-2026 · Term 3')
  })

  it('returns null when there is no term line', () => {
    expect(parseTerm('hello')).toBeNull()
  })
})
