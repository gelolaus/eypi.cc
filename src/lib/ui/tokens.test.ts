import { describe, expect, it } from 'vitest'
import { TOKENS } from './tokens'

describe('TOKENS', () => {
  it('uses APC gold as interactive primary in both themes', () => {
    expect(TOKENS.light.primary).toBe('#DEAC4B')
    expect(TOKENS.dark.primary).toBe('#DEAC4B')
  })

  it('uses APC blue as brand secondary', () => {
    expect(TOKENS.light.brand).toBe('#34418F')
    expect(TOKENS.dark.brand).toBe('#34418F')
  })

  it('locks friendly radius', () => {
    expect(TOKENS.radius).toBe('0.875rem')
  })
})
