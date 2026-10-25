import type { Client } from '@libsql/client/web'
import { hmacIp } from '../ipHash'

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000
const SESSION_MAX_AGE_SEC = 2592000
const SLIDE_AFTER_MS = 60 * 60 * 1000

export type SessionEnv = {
  ENVIRONMENT?: string
  IP_HASH_SECRET?: string
}

export type SessionUser = {
  id: string
  email: string
  name: string
  role: 'user' | 'admin'
}

export function sessionCookieName(env: SessionEnv | undefined): string {
  return env?.ENVIRONMENT === 'production' ? '__Host-eypi_session' : 'eypi_session'
}

export function clearSessionCookie(env: SessionEnv): string {
  return `${sessionCookieName(env)}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
}

export function readCookieHeader(header: string | undefined, name: string): string | null {
  if (!header) return null
  for (const part of header.split(';')) {
    const trimmed = part.trim()
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    if (trimmed.slice(0, eq) !== name) continue
    const value = trimmed.slice(eq + 1)
    return value.length > 0 ? value : null
  }
  return null
}

export function sessionTokenFromCookie(header: string | undefined, env: SessionEnv | undefined): string | null {
  if (!header) return null
  return readCookieHeader(header, sessionCookieName(env))
}

export async function createSession(
  database: Client,
  env: SessionEnv,
  userId: string,
  req: Request,
): Promise<{ token: string; cookie: string }> {
  const now = Date.now()
  const nowIso = new Date(now).toISOString()
  const token = randomToken()
  const id = await sha256Hex(token)
  const ip = req.headers.get('cf-connecting-ip')?.trim() ?? ''
  const secret = env.IP_HASH_SECRET?.trim() ?? ''
  const ipHash = secret && ip ? await hmacIp(secret, ip) : null

  await database.execute({
    sql: `INSERT INTO sessions (id, user_id, created_at, last_seen_at, expires_at, user_agent, ip_hash)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      userId,
      nowIso,
      nowIso,
      new Date(now + SESSION_TTL_MS).toISOString(),
      req.headers.get('user-agent'),
      ipHash,
    ],
  })

  return { token, cookie: sessionCookie(env, token) }
}

export async function readSession(database: Client, token: string): Promise<SessionUser | null> {
  if (!token) return null
  const id = await sha256Hex(token)
  const found = await database.execute({
    sql: `SELECT s.expires_at, s.last_seen_at, u.id, u.email, u.name, u.role, u.disabled_at
          FROM sessions s
          JOIN users u ON u.id = s.user_id
          WHERE s.id = ?
          LIMIT 1`,
    args: [id],
  })
  const row = found.rows[0]
  if (!row) return null
  if (row.disabled_at != null && String(row.disabled_at).length > 0) return null

  const now = Date.now()
  const expiresAt = parseTime(row.expires_at)
  if (expiresAt == null || expiresAt <= now) return null

  const lastSeen = parseTime(row.last_seen_at)
  if (lastSeen == null || now - lastSeen >= SLIDE_AFTER_MS) {
    await database.execute({
      sql: 'UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE id = ?',
      args: [new Date(now).toISOString(), new Date(now + SESSION_TTL_MS).toISOString(), id],
    })
  }

  return {
    id: String(row.id),
    email: String(row.email),
    name: row.name == null ? '' : String(row.name),
    role: row.role === 'admin' ? 'admin' : 'user',
  }
}

export async function destroySession(database: Client, token: string): Promise<void> {
  if (!token) return
  await database.execute({
    sql: 'DELETE FROM sessions WHERE id = ?',
    args: [await sha256Hex(token)],
  })
}

export async function destroyAllSessions(database: Client, userId: string): Promise<void> {
  await database.execute({
    sql: 'DELETE FROM sessions WHERE user_id = ?',
    args: [userId],
  })
}

function sessionCookie(env: SessionEnv, token: string): string {
  return `${sessionCookieName(env)}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE_SEC}`
}

function randomToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return bytesToBase64Url(bytes)
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function parseTime(value: unknown): number | null {
  if (typeof value !== 'string' || value.length === 0) return null
  const time = Date.parse(value)
  return Number.isFinite(time) ? time : null
}
