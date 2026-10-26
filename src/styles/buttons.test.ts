import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync('src/styles/main.css', 'utf8')

describe('button states', () => {
  it('defines hover only for fine hover-capable pointers', () => {
    const open = css.indexOf('@media (hover: hover) and (pointer: fine) {')
    expect(open).toBeGreaterThan(-1)
    for (const name of ['btn-primary', 'btn-secondary', 'btn-danger']) {
      const hover = css.indexOf(`.${name}:not(:disabled):hover`)
      expect(hover, name).toBeGreaterThan(open)
    }
    expect(css).not.toMatch(/^\s*\.btn-(?:primary|secondary|danger):hover/m)
  })

  it('takes the primary fill from the token', () => {
    expect(css).toMatch(/\.btn-primary \{\s*background-color: var\(--color-primary\)/)
  })

  it('drops unused variants and the shadowed global scroll-top hover', () => {
    expect(css).not.toContain('.btn-ghost')
    expect(css).not.toContain('.btn-sm')
    expect(css).not.toContain('.scroll-top-btn:hover')
  })
})
