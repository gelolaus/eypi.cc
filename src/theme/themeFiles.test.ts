import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')

describe('theme page chrome', () => {
  const html = read('index.html')

  it('loads theme-init.js in the head, then the module entry, with no inline scripts', () => {
    expect(html.match(/<script\b[^>]*>[\s\S]*?<\/script>/g)).toEqual([
      '<script src="/theme-init.js"></script>',
      '<script type="module" src="/src/main.ts"></script>',
    ])
    const head = html.slice(html.indexOf('<head>'), html.indexOf('</head>'))
    expect(head).toContain('<script src="/theme-init.js"></script>')
    expect(head).not.toContain('/src/main.ts')
  })
  it('declares both colour schemes and the light chrome colour', () => {
    expect(html).toContain('<meta name="color-scheme" content="light dark" />')
    expect(html).toContain('<meta name="theme-color" content="#f5f5f5" />')
  })
  it('keeps the manifest on the light page background', () => {
    const manifest = JSON.parse(read('public/manifest.webmanifest'))
    expect(manifest.theme_color).toBe('#f5f5f5')
    expect(manifest.background_color).toBe('#f5f5f5')
  })
  it('does not force the dark class from main.ts', () => {
    expect(read('src/main.ts')).not.toContain("classList.add('dark')")
  })
  it('serves theme-init.js with no-cache', () => {
    expect(read('public/_headers')).toMatch(/\/theme-init\.js\r?\n\s+Cache-Control: no-cache/)
  })
})
