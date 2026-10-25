import { describe, expect, it } from 'vitest'
import type { Client } from '@libsql/client/web'
import { db } from './db'

describe('db(c)', () => {
  it('reuses the client stored on c.var.db', () => {
    const client = { closed: false } as unknown as Client
    const vars: { db?: Client } = { db: client }
    const context = {
      env: {
        TURSO_DATABASE_URL: 'libsql://should-not-connect.turso.io',
        TURSO_AUTH_TOKEN: 'unused',
      },
      var: vars,
      set(key: 'db', value: Client) {
        vars[key] = value
      },
    }

    expect(db(context as never)).toBe(client)
  })
})
