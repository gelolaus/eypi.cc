import type { Client } from '@libsql/client/web'
import { normalizeEmail } from '../../../../shared/apcIdentity'

export type IdentityClaims = {
  tid: string
  oid: string
  email: string
  name: string
}

// Until migration 0004 drops users.password_hash it is NOT NULL with a length
// check, so a first sign-in must supply a value. This is a fixed placeholder,
// never a real hash: it is not a pbkdf2 string and no code verifies it.
const LEGACY_PASSWORD_SENTINEL = `disabled:microsoft-sign-in-only:${'0'.repeat(40)}`

async function insertUser(
  database: Client,
  userId: string,
  email: string,
  name: string,
  now: string,
): Promise<void> {
  try {
    await database.execute({
      sql: `INSERT INTO users (id, email, name, role, last_login_at)
            VALUES (?, ?, ?, 'user', ?)`,
      args: [userId, email, name, now],
    })
  } catch (err) {
    if (!(err instanceof Error) || !/password_hash/i.test(err.message)) throw err
    await database.execute({
      sql: `INSERT INTO users (id, email, name, role, last_login_at, password_hash)
            VALUES (?, ?, ?, 'user', ?, ?)`,
      args: [userId, email, name, now, LEGACY_PASSWORD_SENTINEL],
    })
  }
}

export async function resolveUser(
  database: Client,
  claims: IdentityClaims,
): Promise<{ userId: string; created: boolean }> {
  const email = normalizeEmail(claims.email)
  const name = claims.name.trim()
  const now = new Date().toISOString()

  const linked = await database.execute({
    sql: `SELECT user_id FROM user_identities
          WHERE provider = 'microsoft' AND tenant_id = ? AND subject = ?
          LIMIT 1`,
    args: [claims.tid, claims.oid],
  })
  if (linked.rows.length > 0) {
    const userId = String(linked.rows[0].user_id)
    await touchUser(database, userId, email, name, now)
    return { userId, created: false }
  }

  const byEmail = await database.execute({
    sql: 'SELECT id FROM users WHERE lower(email) = ? LIMIT 1',
    args: [email],
  })
  if (byEmail.rows.length > 0) {
    const userId = String(byEmail.rows[0].id)
    await database.execute({
      sql: `INSERT INTO user_identities (provider, tenant_id, subject, user_id, email_at_link)
            VALUES ('microsoft', ?, ?, ?, ?)`,
      args: [claims.tid, claims.oid, userId, email],
    })
    await touchUser(database, userId, email, name, now)
    return { userId, created: false }
  }

  const userId = crypto.randomUUID()
  await insertUser(database, userId, email, name, now)
  await database.execute({
    sql: `INSERT INTO user_identities (provider, tenant_id, subject, user_id, email_at_link)
          VALUES ('microsoft', ?, ?, ?, ?)`,
    args: [claims.tid, claims.oid, userId, email],
  })
  return { userId, created: true }
}

async function touchUser(
  database: Client,
  userId: string,
  email: string,
  name: string,
  now: string,
): Promise<void> {
  await database.execute({
    sql: 'UPDATE users SET email = ?, name = ?, last_login_at = ? WHERE id = ?',
    args: [email, name, now, userId],
  })
}
