import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = join(__dirname, '..', '..', '..')
const pub = (name: string) => join(root, 'public', name)

function pngSize(path: string): [number, number] {
  const buf = readFileSync(path)
  return [buf.readUInt32BE(16), buf.readUInt32BE(20)]
}

describe('Eypi mascot assets', () => {
  it.each([
    ['eypi-mark.png', 192],
    ['favicon-32.png', 32],
    ['favicon-48.png', 48],
    ['apple-touch-icon.png', 180],
    ['icon-192.png', 192],
    ['icon-512.png', 512],
  ])('ships %s as a %ipx square', (name, size) => {
    expect(pngSize(pub(name))).toEqual([size, size])
  })

  it('ships a 192px WebP mark for the in-app logo', () => {
    const buf = readFileSync(pub('eypi-mark.webp'))
    expect(buf.subarray(0, 4).toString('latin1')).toBe('RIFF')
    expect(buf.subarray(8, 12).toString('latin1')).toBe('WEBP')
    expect(buf.byteLength).toBeLessThan(readFileSync(pub('eypi-mark.png')).byteLength)
  })

  it('no longer ships the letter-mark favicon', () => {
    expect(existsSync(pub('favicon.svg'))).toBe(false)
  })

  it('links the png icons from index.html', () => {
    const html = readFileSync(join(root, 'index.html'), 'utf8')
    expect(html).toContain('href="/favicon-32.png"')
    expect(html).toContain('href="/favicon-48.png"')
    expect(html).toContain('href="/apple-touch-icon.png"')
    expect(html).not.toContain('favicon.svg')
  })

  it('lists existing 192 and 512 icons in the manifest', () => {
    const manifest = JSON.parse(readFileSync(pub('manifest.webmanifest'), 'utf8')) as {
      icons: { src: string; sizes: string }[]
    }
    const sizes = manifest.icons.map((icon) => icon.sizes)
    expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']))
    for (const icon of manifest.icons) expect(existsSync(pub(icon.src.replace(/^\//, '')))).toBe(true)
  })
})
