import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { collectPrecache, injectBuild, runPrecache } from './sw-precache.mjs'

const manifest = {
  'index.html': {
    file: 'assets/index-AAA.js',
    isEntry: true,
    css: ['assets/index-AAA.css'],
    imports: ['_vendor.js'],
    dynamicImports: ['src/views/Lazy.vue'],
  },
  '_vendor.js': { file: 'assets/vendor-BBB.js', css: ['assets/vendor-BBB.css'], imports: [] },
  'src/views/Lazy.vue': { file: 'assets/Lazy-CCC.js', isDynamicEntry: true },
}
const source = `// header\nconst BUILD = /*build*/ { hash: 'dev', precache: [] } /*end-build*/;\nself.BUILD = BUILD\n`

describe('sw-precache', () => {
  it('lists entry chunks, their static imports and css, but not lazy routes', () => {
    expect(collectPrecache(manifest)).toEqual([
      '/assets/index-AAA.js',
      '/assets/index-AAA.css',
      '/assets/vendor-BBB.js',
      '/assets/vendor-BBB.css',
    ])
  })

  it('injects the list and a stable build hash', () => {
    const a = injectBuild(source, collectPrecache(manifest))
    const b = injectBuild(source, collectPrecache(manifest))
    expect(a).toBe(b)
    expect(a).toMatch(/hash: "[0-9a-f]{10}"/)
    expect(a).toContain('"/assets/index-AAA.js"')
    expect(injectBuild(source, ['/assets/other.js'])).not.toBe(a)
  })

  it('rewrites dist/client/sw.js from the vite manifest', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'sw-precache-'))
    mkdirSync(path.join(dir, '.vite'))
    writeFileSync(path.join(dir, '.vite', 'manifest.json'), JSON.stringify(manifest))
    writeFileSync(path.join(dir, 'sw.js'), source)
    expect(runPrecache(dir)).toBe('injected')
    const out = readFileSync(path.join(dir, 'sw.js'), 'utf8')
    expect(out).toContain('/assets/index-AAA.js')
    expect(out).toContain('/assets/vendor-BBB.css')
    expect(out).not.toContain("precache: []")
  })

  it('leaves a sw.js without the build marker alone (kill switch)', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'sw-precache-'))
    mkdirSync(path.join(dir, '.vite'))
    writeFileSync(path.join(dir, '.vite', 'manifest.json'), JSON.stringify(manifest))
    writeFileSync(path.join(dir, 'sw.js'), '// kill switch\n')
    expect(runPrecache(dir)).toBe('skipped')
    expect(readFileSync(path.join(dir, 'sw.js'), 'utf8')).toBe('// kill switch\n')
  })
})
