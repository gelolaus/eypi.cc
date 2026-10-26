import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Hono } from 'hono'
import { createClient, type Client } from '@libsql/client/node'
import { createSession, sessionCookieName } from '../lib/auth/session'
import type { Client as RequestClient } from '@libsql/client/web'
import { LEGAL_VERSIONS } from '../../../shared/legalVersions'
import api from '../index'
import type { Bindings } from '../lib/db'
import { CONSENT_DOCUMENTS } from '../middleware/requireConsent'

export const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'migrations')

function assertMigrationsDir(dir: string): void {
  if (!dir.endsWith('backend/migrations') && !dir.endsWith('backend\\migrations')) {
    throw new Error(`createTestApp migrations path must end with backend/migrations, got ${dir}`)
  }
}

export type TestUser = {
  id: string
  email: string
  name: string
  role: string
}

export type CreateTestAppOptions = {
  user?: TestUser
  seed?: (client: Client) => Promise<void>
  env?: Partial<Bindings>
}

type StoredObject = {
  body: Uint8Array
  httpMetadata?: Record<string, string>
}

function memoryKv(): KVNamespace {
  const store = new Map<string, string>()
  return {
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string) => {
      store.set(key, value)
    },
    delete: async (key: string) => {
      store.delete(key)
    },
    list: async () => ({
      keys: [...store.keys()].map((name) => ({ name })),
      list_complete: true,
      cacheStatus: null,
    }),
  } as unknown as KVNamespace
}

function memoryR2() {
  const objects = new Map<string, StoredObject>()
  const toBytes = async (value: ArrayBuffer | ArrayBufferView | string | Blob | ReadableStream | null) => {
    if (value == null) return new Uint8Array()
    if (typeof value === 'string') return new TextEncoder().encode(value)
    if (value instanceof ArrayBuffer) return new Uint8Array(value)
    if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
    if (value instanceof Blob) return new Uint8Array(await value.arrayBuffer())
    const buffer = await new Response(value).arrayBuffer()
    return new Uint8Array(buffer)
  }
  return {
    put: async (
      key: string,
      value: ArrayBuffer | ArrayBufferView | string | Blob | ReadableStream | null,
      options?: { httpMetadata?: { contentType?: string } },
    ) => {
      const body = await toBytes(value)
      const contentType = options?.httpMetadata?.contentType
      objects.set(key, {
        body,
        httpMetadata: contentType ? { contentType } : undefined,
      })
      return { key, size: body.byteLength }
    },
    get: async (key: string) => {
      const stored = objects.get(key)
      if (!stored) return null
      const bytes = stored.body
      return {
        key,
        size: bytes.byteLength,
        httpMetadata: stored.httpMetadata,
        arrayBuffer: async () => bytes.slice().buffer,
        text: async () => new TextDecoder().decode(bytes),
        json: async () => JSON.parse(new TextDecoder().decode(bytes)),
      }
    },
    head: async (key: string) => {
      const stored = objects.get(key)
      if (!stored) return null
      return { key, size: stored.body.byteLength }
    },
    delete: async (key: string) => {
      objects.delete(key)
    },
    list: async () => ({
      objects: [...objects.keys()].map((key) => ({ key })),
      truncated: false,
    }),
  }
}

/** Current privacy and terms, so opts.user requests are not stopped by the consent gate. */
export async function grantCurrentConsent(client: Client, userId: string): Promise<void> {
  for (const document of CONSENT_DOCUMENTS) {
    await client.execute({
      sql: `INSERT OR IGNORE INTO legal_consents (id, user_id, document, version)
            VALUES (?, ?, ?, ?)`,
      args: [`consent-${userId}-${document}`, userId, document, LEGAL_VERSIONS[document]],
    })
  }
}

export async function applyMigrations(client: Client, names?: readonly string[]): Promise<void> {
  assertMigrationsDir(migrationsDir)
  let files: string[]
  if (names) {
    files = [...names]
  } else {
    try {
      files = (await readdir(migrationsDir)).filter((name) => name.endsWith('.sql')).sort()
    } catch (err) {
      if (err instanceof Error && 'code' in err && err.code === 'ENOENT') return
      throw err
    }
  }
  for (const name of files) {
    const sql = await readFile(join(migrationsDir, name), 'utf8')
    if (sql.trim()) await client.executeMultiple(sql)
  }
}

function testEnv(overrides: Partial<Bindings> = {}): Bindings {
  return {
    TURSO_DATABASE_URL: ':memory:',
    TURSO_AUTH_TOKEN: 'test-token',
    PASS_TOKEN_SECRET: 'test-pass-secret',
    RESEND_API_KEY: 'test-resend',
    RATE_LIMIT_KV: memoryKv(),
    LINKS_KV: memoryKv(),
    MEDIA: memoryR2() as unknown as R2Bucket,
    ...overrides,
  }
}

export async function createTestApp(opts: CreateTestAppOptions = {}) {
  const client = createClient({ url: ':memory:' })
  await applyMigrations(client)
  if (opts.seed) await opts.seed(client)

  const env = testEnv(opts.env)
  const app = new Hono<{
    Bindings: Bindings
    Variables: { db?: RequestClient; user?: TestUser; userId?: string; userEmail?: string }
  }>()

  app.use('*', async (c, next) => {
    c.set('db', client as unknown as RequestClient)
    await next()
  })
  app.route('/', api)

  const executionCtx = {
    waitUntil(promise: Promise<unknown>) {
      promise.catch(() => {})
    },
    passThroughOnException() {},
    props: {},
  }

  let sessionCookie: string | null = null

  async function sessionHeader(): Promise<string | null> {
    if (!opts.user) return null
    if (sessionCookie) return sessionCookie
    const existing = await client.execute({
      sql: 'SELECT id FROM users WHERE id = ?',
      args: [opts.user.id],
    })
    if (existing.rows.length === 0) {
      await client.execute({
        sql: 'INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)',
        args: [opts.user.id, opts.user.email, opts.user.name, opts.user.role || 'user'],
      })
    }
    await grantCurrentConsent(client, opts.user.id)
    const { token } = await createSession(
      client as unknown as Parameters<typeof createSession>[0],
      env,
      opts.user.id,
      new Request('https://eypi.cc/'),
    )
    sessionCookie = `${sessionCookieName(env)}=${token}`
    return sessionCookie
  }

  async function request(path: string, init?: RequestInit): Promise<Response> {
    const headers = new Headers(init?.headers)
    const cookie = await sessionHeader()
    if (cookie && !headers.has('Cookie')) headers.set('Cookie', cookie)
    return app.request(path, { ...init, headers }, env, executionCtx)
  }

  return { app, client, request, env }
}
