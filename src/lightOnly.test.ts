import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '..')

describe('light only', () => {
  it('has no theme-init script, dark mode composable or toggle', () => {
    expect(existsSync(resolve(root, 'public/theme-init.js'))).toBe(false)
    expect(existsSync(resolve(root, 'src/composables/useDarkMode.ts'))).toBe(false)
    expect(existsSync(resolve(root, 'src/components/ThemeToggle.vue'))).toBe(false)
  })
  it('declares a light colour scheme in index.html without inline or theme scripts', () => {
    const html = readFileSync(resolve(root, 'index.html'), 'utf8')
    expect(html).not.toMatch(/<html[^>]*class="dark"/)
    expect(html).toContain('<meta name="color-scheme" content="light" />')
    expect(html).not.toContain('theme-init')
    expect(html.match(/<script\b[^>]*>/g)).toEqual(['<script type="module" src="/src/main.ts">'])
  })
  it('does not force the dark class from main.ts', () => {
    expect(readFileSync(resolve(root, 'src/main.ts'), 'utf8')).not.toContain("classList.add('dark')")
  })
  it('uses the page background for the browser chrome and the manifest', () => {
    const html = readFileSync(resolve(root, 'index.html'), 'utf8')
    const manifest = JSON.parse(readFileSync(resolve(root, 'public/manifest.webmanifest'), 'utf8'))
    expect(html).toContain('<meta name="theme-color" content="#f5f5f5" />')
    expect(manifest.theme_color).toBe('#f5f5f5')
    expect(manifest.background_color).toBe('#f5f5f5')
  })
})
