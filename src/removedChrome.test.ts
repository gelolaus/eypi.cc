import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function read(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8')
}

describe('removed chrome', () => {
  it('does not mount the custom cursor, splash loader, or Space handler', () => {
    const app = read('./App.vue')
    expect(app).not.toMatch(/AppCur(?:sor)|AppLoa(?:der)|useKeyboard(?:Nav)/)
  })

  it('does not hide the native cursor', () => {
    const css = read('./styles/legacy.css')
    expect(css).not.toContain('has-custom-cursor')
    expect(css).not.toContain('cursor: none')
  })

  it('does not import the qr-scanner worker a second time', () => {
    const view = read('./views/tix/EventDetailView.vue')
    expect(view).not.toContain('qr-scanner-worker.min.js?url')
  })
})
