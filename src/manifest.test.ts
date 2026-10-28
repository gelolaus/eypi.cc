import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '..')
const manifest = JSON.parse(readFileSync(resolve(root, 'public/manifest.webmanifest'), 'utf8')) as {
  id: string
  name: string
  short_name: string
  start_url: string
  display: string
  icons: Array<{ src: string; sizes: string }>
  shortcuts: Array<{ name: string; url: string; icons?: Array<{ src: string }> }>
}

describe('web app manifest', () => {
  it('is installable as a standalone app that opens the dashboard', () => {
    expect(manifest.id).toBe('/')
    expect(manifest.name).toBe('Eypi')
    expect(manifest.short_name).toBe('Eypi')
    expect(manifest.start_url).toBe('/dashboard')
    expect(manifest.display).toBe('standalone')
  })

  it('has existing 192 and 512 icons', () => {
    const sizes = manifest.icons.map((icon) => icon.sizes)
    expect(sizes).toContain('192x192')
    expect(sizes).toContain('512x512')
    for (const icon of manifest.icons) expect(existsSync(resolve(root, 'public', icon.src.slice(1)))).toBe(true)
  })

  it('offers shortcuts for Links and My tickets', () => {
    expect(manifest.shortcuts.map((s) => [s.name, s.url])).toEqual([
      ['Links', '/links'],
      ['My tickets', '/tickets'],
    ])
    for (const s of manifest.shortcuts) for (const i of s.icons ?? []) expect(existsSync(resolve(root, 'public', i.src.slice(1)))).toBe(true)
  })
})
