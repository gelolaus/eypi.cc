import { describe, expect, it } from 'vitest'
import { createTestApp } from '../test/createTestApp'

const sample = {
  route: 'home',
  metric: 'LCP',
  value: 1800,
  rating: 'good',
  device: 'mobile',
  connection: '4g',
  navType: 'navigate',
}

function post(body: string, contentType = 'application/json', ip = '203.0.113.7') {
  return {
    method: 'POST',
    headers: { 'Content-Type': contentType, 'CF-Connecting-IP': ip, Origin: 'https://eypi.cc' },
    body,
  } satisfies RequestInit
}

describe('POST /api/rum', () => {
  it('stores samples and returns 204', async () => {
    const { request, client } = await createTestApp()
    const res = await request('/api/rum', post(JSON.stringify([sample, { ...sample, metric: 'FCP', value: 900 }])))
    expect(res.status).toBe(204)
    const rows = await client.execute('SELECT day FROM rum_samples')
    expect(rows.rows).toHaveLength(2)
    expect(rows.rows[0].day).toBe(new Date().toISOString().slice(0, 10))
  })

  it('accepts text/plain bodies from sendBeacon', async () => {
    const { request } = await createTestApp()
    const res = await request('/api/rum', post(JSON.stringify([sample]), 'text/plain;charset=UTF-8'))
    expect(res.status).toBe(204)
  })

  it('returns 400 on malformed', async () => {
    const { request, client } = await createTestApp()
    const bad = await request('/api/rum', post(JSON.stringify([{ ...sample, route: 'nope' }])))
    const notJson = await request('/api/rum', post('not json'))
    expect(bad.status).toBe(400)
    expect(((await bad.json()) as { error: { code: string } }).error.code).toBe('invalid')
    expect(notJson.status).toBe(400)
    const rows = await client.execute('SELECT COUNT(*) AS c FROM rum_samples')
    expect(Number(rows.rows[0].c)).toBe(0)
  })

  it('rate limits at 60 per minute per IP', async () => {
    const { request } = await createTestApp()
    for (let i = 0; i < 60; i++) {
      expect((await request('/api/rum', post(JSON.stringify([sample])))).status).toBe(204)
    }
    expect((await request('/api/rum', post(JSON.stringify([sample])))).status).toBe(429)
    expect((await request('/api/rum', post(JSON.stringify([sample]), 'application/json', '203.0.113.8'))).status).toBe(204)
  })
})
