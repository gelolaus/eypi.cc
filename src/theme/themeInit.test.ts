import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import vm from 'node:vm'
import { describe, expect, it } from 'vitest'
import {
  PAGE_BACKGROUND,
  THEME_STORAGE_KEY,
  pageBackground,
  parsePreference,
  resolveTheme,
} from './theme'

const script = readFileSync(resolve(__dirname, '../../public/theme-init.js'), 'utf8')

type Env = {
  stored?: string | null
  systemDark?: boolean
  noMatchMedia?: boolean
  noLocalStorage?: boolean
  throwingStorage?: boolean
  noMeta?: boolean
}

function run(env: Env) {
  const classes = new Set<string>()
  const meta: { content: string } = { content: PAGE_BACKGROUND.light }
  const sandbox: Record<string, unknown> = {
    document: {
      documentElement: {
        classList: {
          add: (...names: string[]) => names.forEach((n) => classes.add(n)),
          remove: (...names: string[]) => names.forEach((n) => classes.delete(n)),
          toggle: (name: string, force?: boolean) => {
            if (force === undefined ? !classes.has(name) : force) classes.add(name)
            else classes.delete(name)
          },
        },
      },
      querySelector: (selector: string) =>
        selector === 'meta[name="theme-color"]' && !env.noMeta
          ? {
              setAttribute: (name: string, value: string) => {
                if (name === 'content') meta.content = value
              },
              get content() {
                return meta.content
              },
              set content(value: string) {
                meta.content = value
              },
            }
          : null,
    },
  }
  if (!env.noLocalStorage) {
    sandbox.localStorage = {
      getItem: (key: string) => {
        if (env.throwingStorage) throw new Error('blocked')
        return key === THEME_STORAGE_KEY ? (env.stored ?? null) : null
      },
    }
  }
  if (!env.noMatchMedia) {
    sandbox.matchMedia = (query: string) => ({
      matches: query === '(prefers-color-scheme: dark)' && !!env.systemDark,
    })
  }
  sandbox.window = sandbox
  vm.createContext(sandbox)
  expect(() => vm.runInContext(script, sandbox)).not.toThrow()
  return { classes: [...classes].sort(), themeColor: meta.content }
}

function expected(stored: string | null, systemDark: boolean) {
  const resolved = resolveTheme(parsePreference(stored), systemDark)
  const classes: string[] = []
  if (resolved.theme === 'dark') classes.push('dark')
  if (resolved.black) classes.push('black')
  return { classes: classes.sort(), themeColor: pageBackground(resolved) }
}

describe('theme-init.js', () => {
  const stored: (string | null)[] = [
    null,
    ...(['system', 'light', 'dark'] as const).flatMap((mode) =>
      [false, true].map((black) => JSON.stringify({ mode, black })),
    ),
  ]
  for (const raw of stored) {
    for (const systemDark of [false, true]) {
      it(`matches theme.ts for ${raw ?? 'no saved value'} with system dark ${systemDark}`, () => {
        expect(run({ stored: raw, systemDark })).toEqual(expected(raw, systemDark))
      })
    }
  }

  const light = { classes: [], themeColor: PAGE_BACKGROUND.light }

  it('stays light without matchMedia', () => {
    expect(run({ noMatchMedia: true })).toEqual(light)
  })
  it('stays light without localStorage', () => {
    expect(run({ noLocalStorage: true })).toEqual(light)
  })
  it('stays light when getItem throws', () => {
    expect(run({ throwingStorage: true, systemDark: false })).toEqual(light)
  })
  it('falls back to the system theme when getItem throws', () => {
    expect(run({ throwingStorage: true, systemDark: true })).toEqual({
      classes: ['dark'],
      themeColor: PAGE_BACKGROUND.dark,
    })
  })
  it.each(['{', 'dark', '[]', 'null', '{"mode":"neon","black":false}', '{"mode":"dark"}', '{"mode":"dark","black":"yes"}'])(
    'ignores the corrupted value %s',
    (raw) => {
      expect(run({ stored: raw, systemDark: false })).toEqual(light)
      expect(run({ stored: raw, systemDark: true })).toEqual({
        classes: ['dark'],
        themeColor: PAGE_BACKGROUND.dark,
      })
    },
  )
  it('does not throw when the theme-color meta is missing', () => {
    expect(run({ stored: JSON.stringify({ mode: 'dark', black: true }), noMeta: true }).classes).toEqual([
      'black',
      'dark',
    ])
  })
})
