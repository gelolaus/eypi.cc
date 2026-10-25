import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Hono } from 'hono'
import { sign } from 'hono/jwt'
import { createClient, type Client } from '@libsql/client/node'
import type { Client as RequestClient } from '@libsql/client/web'
import api from '../index'
import type { Bindings } from '../lib/db'

const migrationsDir = join(fileURLToPath(import.meta.url), '..', '..', 'migrations')

export type TestUser = {
  id: string
  email: string
  name: string
  role: string
}

export type CreateTestAppOptions = {
  user?: TestUser
  seed?: (client: Client) => Promise<void>
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
    put: async (key: string, value: ArrayBuffer | ArrayBufferView | string | Blob | ReadableStream | null) => {
      const body = await toBytes(value)
      objects.set(key, { body })
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

async function applyMigrations(client: Client): Promise<void> {
  let names: string[]
  try {
    names = (await readdir(migrationsDir)).filter((name) => name.endsWith('.sql')).sort()
  } catch (err) {
    if (err instanceof Error && 'code' in err && err.code === 'ENOENT') return
    throw err
  }
  for (const name of names) {
    const sql = await readFile(join(migrationsDir, name), 'utf8')
    if (sql.trim()) await client.executeMultiple(sql)
  }
}

function testEnv(): Bindings & { MEDIA: ReturnType<typeof memoryR2> } {
  return {
    TURSO_DATABASE_URL: ':memory:',
    TURSO_AUTH_TOKEN: 'test-token',
    JWT_SECRET: 'test-jwt-secret',
    PASS_TOKEN_SECRET: 'test-pass-secret',
    RESEND_API_KEY: 'test-resend',
    RATE_LIMIT_KV: memoryKv(),
    LINKS_KV: memoryKv(),
    ASSETS: { fetch: async () => new Response(null, { status: 404 }) } as unknown as Bindings['ASSETS'],
    MEDIA: memoryR2(),
  }
}

export async function createTestApp(opts: CreateTestAppOptions = {}) {
  const client = createClient({ url: ':memory:' })
  await applyMigrations(client)
  if (opts.seed) await opts.seed(client)

  const env = testEnv()
  const app = new Hono<{
    Bindings: Bindings
    Variables: { db?: RequestClient; user?: TestUser; userId?: string; userEmail?: string }
  }>()

  app.use('*', async (c, next) => {
    c.set('db', client as unknown as RequestClient)
    if (opts.user) {
      c.set('user', opts.user)
      c.set('userId', opts.user.id)
      c.set('userEmail', opts.user.email)
    }
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

  async function request(path: string, init?: RequestInit): Promise<Response> {
    const headers = new Headers(init?.headers)
    if (opts.user && !headers.has('Authorization')) {
      const token = await sign(
        {
          sub: opts.user.id,
          email: opts.user.email,
          name: opts.user.name,
          exp: Math.floor(Date.now() / 1000) + 60 * 60,
        },
        env.JWT_SECRET,
      )
      headers.set('Authorization', `Bearer ${token}`)
    }
    return app.request(path, { ...init, headers }, env, executionCtx)
  }

  return { app, client, request }
}
