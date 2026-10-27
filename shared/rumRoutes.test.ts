import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { RUM_ROUTE_NAMES } from './rumRoutes'

describe('RUM_ROUTE_NAMES', () => {
  it('matches the route names declared in src/router/index.ts', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/router/index.ts'), 'utf8')
    // Route records declare `name: '...'`; redirects and navigations write `{ name: '...' }`.
    const declared = new Set([...source.matchAll(/(?<!\{\s)name:\s*'([^']+)'/g)].map((m) => m[1]))
    expect([...declared].sort()).toEqual([...RUM_ROUTE_NAMES].sort())
  })
})
