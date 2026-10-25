import { describe, expect, it } from 'vitest'
import { createTestApp, migrationsDir } from '../test/createTestApp'

describe('createTestApp migrations', () => {
  it('resolves the migrations directory to backend/migrations', () => {
    expect(
      migrationsDir.endsWith('backend/migrations') || migrationsDir.endsWith('backend\\migrations'),
    ).toBe(true)
  })
})

describe('GET /api/health', () => {
  it('returns ok when the database ping succeeds', async () => {
    const { request } = await createTestApp()

    const res = await request('/api/health')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, db: true })
  })

  it('answers unknown paths with the not_found body', async () => {
    const { request } = await createTestApp()

    const res = await request('/forms/templates/waiver_form.docx')

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: { code: 'not_found', message: 'Not found' } })
  })
})
