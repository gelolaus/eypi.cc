import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = resolve(__dirname)

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

const rel = (f: string) => relative(SRC, f).split(String.fromCharCode(92)).join('/')
const isTest = (f: string) => /\.test\.ts$/.test(f)
const markup = walk(SRC).filter((f) => /\.vue$/.test(f))
const sources = walk(SRC).filter((f) => /\.(vue|ts|css)$/.test(f) && !isTest(f))

function offenders(files: string[], pattern: RegExp): string[] {
  return files.filter((f) => pattern.test(readFileSync(f, 'utf8'))).map(rel)
}

describe('mobile regression guards', () => {
  it('has no fixed three-digit min-w table wrappers', () => {
    expect(offenders(sources, /min-w-\[\d{3}px\]/)).toEqual([])
  })

  it('never uses bare 100vh or min-h-screen outside the dvh fallback utility', () => {
    const css = readFileSync(join(SRC, 'styles/legacy.css'), 'utf8').replace(
      /height:\s*100vh;\s*height:\s*100dvh;/g,
      '',
    )
    expect(css).not.toMatch(/100vh/)
    expect(offenders(markup, /100vh|min-h-screen|\bh-screen\b/)).toEqual([])
  })

  it('has no sub-44px h-6 w-6 or h-9 w-9 buttons', () => {
    const bad: string[] = []
    for (const f of markup) {
      const tags = readFileSync(f, 'utf8').match(/<button\b[^>]*>/g) ?? []
      for (const tag of tags) {
        if (/\bh-(6|9)\b/.test(tag) && /\bw-(6|9)\b/.test(tag) && !/min-h-11|min-w-11/.test(tag)) {
          bad.push(`${rel(f)}: ${tag.slice(0, 80)}`)
        }
      }
    }
    expect(bad).toEqual([])
  })

  it('has no data-cursor attributes or selectors left', () => {
    expect(offenders(sources, /data-cursor/)).toEqual([])
  })
})

describe('template validity', () => {
  it('compiles every SFC template without errors', async () => {
    const { parse, compileTemplate } = await import('@vue/compiler-sfc')
    const bad: string[] = []
    for (const f of markup) {
      const source = readFileSync(f, 'utf8')
      const { descriptor, errors } = parse(source, { filename: f })
      if (errors.length) bad.push(`${rel(f)}: ${String(errors[0].message)}`)
      else if (descriptor.template) {
        const out = compileTemplate({ source: descriptor.template.content, filename: f, id: rel(f) })
        if (out.errors.length) bad.push(`${rel(f)}: ${String(out.errors[0])}`)
      }
    }
    expect(bad).toEqual([])
  })
})
