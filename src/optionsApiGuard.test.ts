import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// vite.config.ts defines __VUE_OPTIONS_API__ as false, which vitest does not apply.
// This guard fails if a component starts using the Options API, which that build drops.
const RULES: Array<{ name: string; re: RegExp; vueOnly?: boolean }> = [
  { name: 'export default { ... }', re: /export\s+default\s*\{/ },
  { name: '<script> block without setup', re: /<script(?![^>]*\bsetup\b)[^>]*>/, vueOnly: true },
  { name: 'mixins option', re: /\bmixins\s*:/ },
  { name: 'extends option', re: /\bextends\s*:\s*[A-Za-z_$]/ },
  { name: 'methods option', re: /\bmethods\s*:\s*\{/ },
  { name: 'computed option object', re: /\bcomputed\s*:\s*\{/ },
  { name: 'data() option', re: /\bdata\s*\(\s*\)\s*\{/ },
  { name: 'in-component route guard', re: /\bbeforeRoute(?:Enter|Update)\b/ },
]

function findings(text: string, file: string): string[] {
  const isVue = file.endsWith('.vue')
  return RULES.filter((r) => (!r.vueOnly || isVue) && r.re.test(text)).map((r) => r.name)
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    return /\.(vue|ts)$/.test(entry.name) && !/\.test\.ts$/.test(entry.name) ? [full] : []
  })
}

describe('Options API guard', () => {
  it('detects Options API usage in a fixture', () => {
    const fixture = `<script>\nexport default {\n  mixins: [a],\n  data() { return {} },\n  methods: { go() {} },\n  beforeRouteEnter() {},\n}\n</script>`
    expect(findings(fixture, 'Bad.vue')).toEqual(
      expect.arrayContaining([
        'export default { ... }',
        '<script> block without setup',
        'mixins option',
        'methods option',
        'data() option',
        'in-component route guard',
      ]),
    )
    expect(findings('<script setup lang="ts">\nconst a = 1\n</script>', 'Ok.vue')).toEqual([])
  })

  it('finds no Options API components under src', () => {
    const files = sourceFiles(path.resolve(__dirname))
    expect(files.length).toBeGreaterThan(50)
    const bad = files
      .map((file) => ({ file: path.relative(__dirname, file), found: findings(readFileSync(file, 'utf8'), file) }))
      .filter((r) => r.found.length > 0)
    expect(bad).toEqual([])
  })
})
