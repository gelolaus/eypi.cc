import { describe, expect, it } from 'vitest'
import { createTestApp } from '../test/createTestApp'

const owner = {
  id: 'user-1',
  email: 'ada@student.apc.edu.ph',
  name: 'Ada',
  role: 'user',
}

function patch(body: unknown): RequestInit {
  return {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://eypi.cc',
      'CF-Connecting-IP': '203.0.113.10',
    },
    body: JSON.stringify(body),
  }
}

async function withLink() {
  const ctx = await createTestApp({
    user: owner,
    seed: async (db) => {
      await db.execute({
        sql: 'INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)',
        args: [owner.id, owner.email, owner.name, owner.role],
      })
      await db.execute({
        sql: `INSERT INTO links (id, user_id, original_url, slug)
              VALUES ('link-1', ?, 'https://example.com/old', 'link-1')`,
        args: [owner.id],
      })
    },
  })
  await ctx.env.LINKS_KV.put('link-1', JSON.stringify({ id: 'link-1', url: 'https://example.com/old' }))
  return ctx
}

/** Lands a moderator disable after the PATCH handler loaded the row, just before its UPDATE. */
function disableBeforeOwnerUpdate(ctx: Awaited<ReturnType<typeof withLink>>) {
  const original = ctx.client.execute.bind(ctx.client)
  let landed = false
  ctx.client.execute = (async (stmt: { sql: string; args?: unknown[] } | string) => {
    const sql = typeof stmt === 'string' ? stmt : stmt.sql
    if (!landed && /^\s*UPDATE links/i.test(sql)) {
      landed = true
      await original({
        sql: `UPDATE links SET disabled_at = '2026-10-26 00:00:00', disabled_reason = 'abuse' WHERE id = 'link-1'`,
        args: [],
      })
      await ctx.env.LINKS_KV.delete('link-1')
    }
    return original(stmt as never)
  }) as typeof ctx.client.execute
}

describe('PATCH /api/links/:id against a concurrent moderator disable', () => {
  it('keeps the link disabled and the KV key absent when an edit overlaps the disable', async () => {
    const ctx = await withLink()
    disableBeforeOwnerUpdate(ctx)

    const res = await ctx.request('/api/links/link-1', patch({ url: 'https://example.com/new' }))

    expect(res.status).toBe(200)
    const row = await ctx.client.execute("SELECT original_url, disabled_at, disabled_reason FROM links WHERE id = 'link-1'")
    expect(row.rows[0].disabled_at).toBe('2026-10-26 00:00:00')
    expect(row.rows[0].disabled_reason).toBe('abuse')
    expect(row.rows[0].original_url).toBe('https://example.com/new')
    expect(await ctx.env.LINKS_KV.get('link-1')).toBeNull()
  })

  it('does not let an owner enable toggle override a moderator disable that landed first', async () => {
    const ctx = await withLink()
    disableBeforeOwnerUpdate(ctx)

    const res = await ctx.request('/api/links/link-1', patch({ disabled: false }))

    expect(res.status).toBe(200)
    const row = await ctx.client.execute("SELECT disabled_at, disabled_reason FROM links WHERE id = 'link-1'")
    expect(row.rows[0].disabled_reason).toBe('abuse')
    expect(row.rows[0].disabled_at).not.toBeNull()
    expect(await ctx.env.LINKS_KV.get('link-1')).toBeNull()
  })
})
