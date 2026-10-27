import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isSpaRoute } from './index'

/** Static router paths, with nested children joined to their parent and params filled in. */
function routerPaths(): string[] {
  const source = readFileSync(resolve(process.cwd(), 'src/router/index.ts'), 'utf8')
  const paths: string[] = []
  let parent = ''
  for (const line of source.split('\n')) {
    const match = line.match(/^(\s*)\{?\s*path:\s*'([^']*)'/)
    if (!match) continue
    const [, indent, path] = match
    const nested = indent.length >= 8 && !path.startsWith('/')
    const full = path.startsWith('/') ? path : `${parent}/${path}`.replace(/\/$/, '')
    if (!nested) parent = path
    paths.push(nested ? full : path)
  }
  return paths
}

describe('worker SPA route table', () => {
  const candidates = routerPaths()
    // `/:slug` is a short link and the catch-all is a 404; the worker decides those itself.
    .filter((path) => path !== '/:slug' && !path.includes('pathMatch'))
    .map((path) => path.replace(/:[A-Za-z]+/g, 'x'))

  it('finds the static routes', () => {
    expect(candidates.length).toBeGreaterThan(30)
    expect(candidates).toContain('/admin/speed')
  })

  it.each([...new Set(candidates)])('serves %s from the app shell', (path) => {
    expect(isSpaRoute(path)).toBe(true)
  })
})
