import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (rel: string) => readFileSync(resolve(__dirname, '..', rel), 'utf8')

const AUTH_SCREENS = [
  'views/LoginView.vue',
  'views/UnlockView.vue',
  'views/ExpiredView.vue',
  'views/ReportView.vue',
  'views/ConsentView.vue',
  'views/NotFoundView.vue',
  'components/LegalLayout.vue',
]

describe('mobile-first auth and static pages', () => {
  it.each(AUTH_SCREENS)('%s uses dvh, never min-h-screen or 100vh', (file) => {
    const src = read(file)
    expect(src).not.toMatch(/min-h-screen|100vh/)
    expect(src).toContain('min-h-dvh')
  })

  it.each(AUTH_SCREENS)('%s carries no data-cursor attributes', (file) => {
    expect(read(file)).not.toContain('data-cursor')
  })

  it('views/UnlockView.vue uses the Input primitive and a full-width lg Button', () => {
    const src = read('views/UnlockView.vue')
    expect(src).toContain('<Input')
    expect(src).toMatch(/<Button[^>]*size="lg"[^>]*class="[^"]*w-full/)
    expect(src).toContain('aria-invalid')
  })

  it.each(['views/ReportView.vue'])('%s uses labelled 44px fields and a full-width lg primary button', (file) => {
    const src = read(file)
    expect(src).toContain('<Textarea')
    expect(src).toContain('<Label')
    expect(src).toMatch(/<Button[^>]*size="lg"[^>]*class="[^"]*w-full/)
    expect(src).toContain('aria-invalid')
  })

  it('consent checkboxes have a 44px tap row', () => {
    const src = read('views/ConsentView.vue')
    expect(src).not.toContain('h-4 w-4')
    expect(src).toContain('min-h-11')
    expect(src).toMatch(/<Button[^>]*size="lg"/)
  })

  it('login keeps a 44px+ Microsoft button', () => {
    expect(read('views/LoginView.vue')).toMatch(/min-h-12|min-h-\[48px\]|h-12/)
  })

  it('dashboard modules form a 1/2/3 column grid of 44px+ links', () => {
    const src = read('views/DashboardView.vue')
    expect(src).toContain('grid-cols-1')
    expect(src).toContain('sm:grid-cols-2')
    expect(src).toContain('lg:grid-cols-3')
    expect(src).toContain('min-h-11')
    expect(src).toContain('<AppPage')
    expect(src).not.toContain('paintCardBorder')
  })

  it.each(['views/AccountView.vue', 'views/InvitesView.vue'])('%s uses AppPage', (file) => {
    expect(read(file)).toContain('<AppPage')
  })

  it('account sections use AppSection with Input fields', () => {
    const src = read('views/AccountView.vue')
    expect((src.match(/<AppSection/g) ?? []).length).toBeGreaterThanOrEqual(4)
    expect(src).toContain('<Input')
    expect(src).toContain('aria-invalid')
    expect(src).toContain('variant="destructive"')
  })
})
