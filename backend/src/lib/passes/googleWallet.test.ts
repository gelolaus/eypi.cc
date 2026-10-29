import { afterEach, describe, expect, it, vi } from 'vitest'
import { exportPKCS8, generateKeyPair } from 'jose'
import type { Bindings } from '../db'
import type { PassContext } from './context'
import { buildGoogleWalletSaveUrl } from './googleWallet'

const ISSUER = 'issuer'
const CLASS_ID = `${ISSUER}.eypi_event_launch`
const CLASS_URL = `https://walletobjects.googleapis.com/walletobjects/v1/eventTicketClass/${CLASS_ID}`
const CLASS_COLLECTION = 'https://walletobjects.googleapis.com/walletobjects/v1/eventTicketClass'

type FetchCall = { url: string; method: string; body: string | null }

function passContext(name: string, eventTime = '09:00'): PassContext {
  return {
    event: {
      id: 'event-1',
      slug: 'launch',
      name,
      eventDate: '2026-11-01',
      eventTime,
      location: 'Hall',
    },
    attendee: {
      id: '11111111-2222-3333-4444-555555555555',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@x.com',
      qrToken: 'qr-1',
      clusterValue: 'General',
    },
    customFields: {},
  }
}

async function walletEnv(): Promise<Bindings> {
  const { privateKey } = await generateKeyPair('RS256', { extractable: true })
  return {
    GOOGLE_WALLET_ISSUER_ID: ISSUER,
    GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL: 'wallet@example.com',
    GOOGLE_WALLET_SERVICE_ACCOUNT_PRIVATE_KEY: await exportPKCS8(privateKey),
  } as Bindings
}

function installFetch(onCall: (call: FetchCall) => Response): FetchCall[] {
  const calls: FetchCall[] = []
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    const body = typeof init?.body === 'string' ? init.body : null
    const call = { url, method: (init?.method ?? 'GET').toUpperCase(), body }
    calls.push(call)
    return onCall(call)
  })
  return calls
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function googleApi(existingStatus: number, existingBody: unknown): (call: FetchCall) => Response {
  return (call) => {
    if (call.url === 'https://oauth2.googleapis.com/token') return jsonResponse(200, { access_token: 'tok' })
    if (call.method === 'GET' && call.url === CLASS_URL) return jsonResponse(existingStatus, existingBody)
    if (call.method === 'PATCH' || call.method === 'POST') return jsonResponse(200, {})
    return jsonResponse(404, {})
  }
}

function decodeSavePayload(url: string): {
  eventTicketClasses: Record<string, unknown>[]
  eventTicketObjects: { validTimeInterval?: { start?: { date?: string }; end?: { date?: string } } }[]
} {
  const token = url.slice(url.lastIndexOf('/') + 1)
  const part = token.split('.')[1] ?? ''
  const padded = part.replace(/-/g, '+').replace(/_/g, '/')
  const json = atob(padded.padEnd(padded.length + ((4 - (padded.length % 4)) % 4), '='))
  return JSON.parse(json).payload
}

describe('Google Wallet class upsert', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('patches the class payload when the event name changes', async () => {
    const calls = installFetch(googleApi(200, {
      id: CLASS_ID,
      eventName: { defaultValue: { language: 'en-US', value: 'Old Night' } },
    }))

    await buildGoogleWalletSaveUrl(passContext('Launch Night'), await walletEnv())

    const patch = calls.find((call) => call.method === 'PATCH' && call.url === CLASS_URL)
    expect(patch?.body).toBeTruthy()
    expect(JSON.parse(patch!.body!)).toMatchObject({
      id: CLASS_ID,
      eventName: { defaultValue: { language: 'en-US', value: 'Launch Night' } },
    })
    expect(calls.filter((call) => call.method === 'POST' && call.url === CLASS_COLLECTION)).toHaveLength(0)
  })

  it('inserts the class when Google has no class yet', async () => {
    const calls = installFetch(googleApi(404, {}))

    await buildGoogleWalletSaveUrl(passContext('Launch Night'), await walletEnv())

    const insert = calls.find((call) => call.method === 'POST' && call.url === CLASS_COLLECTION)
    expect(insert?.body).toBeTruthy()
    expect(JSON.parse(insert!.body!)).toMatchObject({
      id: CLASS_ID,
      eventName: { defaultValue: { language: 'en-US', value: 'Launch Night' } },
    })
    expect(calls.filter((call) => call.method === 'PATCH')).toHaveLength(0)
  })
})

describe('Google Wallet review status', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sets UNDER_REVIEW only when inserting a new class', async () => {
    const calls = installFetch(googleApi(404, {}))

    await buildGoogleWalletSaveUrl(passContext('Launch Night'), await walletEnv())

    const insert = calls.find((call) => call.method === 'POST' && call.url === CLASS_COLLECTION)
    expect(JSON.parse(insert!.body!)).toMatchObject({ reviewStatus: 'UNDER_REVIEW' })
  })

  it('keeps reviewStatus out of the save token so an approved class stays approved', async () => {
    installFetch(googleApi(200, { id: CLASS_ID }))

    const payload = decodeSavePayload(
      await buildGoogleWalletSaveUrl(passContext('Launch Night'), await walletEnv()),
    )

    expect(payload.eventTicketClasses).toHaveLength(1)
    expect(payload.eventTicketClasses[0]).not.toHaveProperty('reviewStatus')
  })
})

describe('Google Wallet validTimeInterval', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses a +08:00 start and an end six hours later', async () => {
    installFetch(googleApi(200, {
      id: CLASS_ID,
      eventName: { defaultValue: { language: 'en-US', value: 'Launch Night' } },
    }))
    const env = await walletEnv()

    const daytime = decodeSavePayload(await buildGoogleWalletSaveUrl(passContext('Launch Night', '09:00'), env))
    expect(daytime.eventTicketObjects[0]?.validTimeInterval).toEqual({
      start: { date: '2026-11-01T09:00:00+08:00' },
      end: { date: '2026-11-01T15:00:00+08:00' },
    })

    const overnight = decodeSavePayload(await buildGoogleWalletSaveUrl(passContext('Launch Night', '22:00'), env))
    expect(overnight.eventTicketObjects[0]?.validTimeInterval).toEqual({
      start: { date: '2026-11-01T22:00:00+08:00' },
      end: { date: '2026-11-02T04:00:00+08:00' },
    })
  })
})
