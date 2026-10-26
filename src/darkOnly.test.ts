import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '..')

describe('dark only', () => {
  it('has no theme-init script or dark mode composable', () => {
    expect(existsSync(resolve(root, 'public/theme-init.js'))).toBe(false)
    expect(existsSync(resolve(root, 'src/composables/useDarkMode.ts'))).toBe(false)
    expect(existsSync(resolve(root, 'src/components/ThemeToggle.vue'))).toBe(false)
  })
  it('pins the dark class in index.html without inline or theme scripts', () => {
    const html = readFileSync(resolve(root, 'index.html'), 'utf8')
    expect(html).toMatch(/<html[^>]*class="dark"/)
    expect(html).not.toContain('theme-init')
    expect(html.match(/<script\b[^>]*>/g)).toEqual(['<script type="module" src="/src/main.ts">'])
  })
})
