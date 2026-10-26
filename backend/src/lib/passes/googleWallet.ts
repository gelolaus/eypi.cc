import { SignJWT, importPKCS8 } from 'jose'
import type { Bindings } from '../db'
import { buildBackFields, type PassContext } from './context'

const MANILA_OFFSET = '+08:00'
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000
const DEFAULT_DURATION_MS = 6 * 60 * 60 * 1000
const WALLET_SCOPE = 'https://www.googleapis.com/auth/wallet_object.issuer'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const CLASS_COLLECTION = 'https://walletobjects.googleapis.com/walletobjects/v1/eventTicketClass'

function sanitizeSlug(slug: string): string {
  return slug.replace(/[^a-z0-9]/g, '_')
}

function sanitizeModuleId(label: string, index: number): string {
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  return `field_${base || index}`
}

function clock(time: string): string {
  if (/^\d{2}:\d{2}:\d{2}$/.test(time)) return time
  return `${time}:00`
}

function formatManila(instant: Date): string {
  const shifted = new Date(instant.getTime() + MANILA_OFFSET_MS)
  return `${shifted.toISOString().slice(0, 19)}${MANILA_OFFSET}`
}

/** Start at the event's Manila wall time. End is six hours later when the event has no end. */
function buildManilaInterval(ctx: PassContext): { start: string; end: string } | undefined {
  if (!ctx.event.eventDate) return undefined
  const time = ctx.event.eventTime || '00:00'
  const start = new Date(`${ctx.event.eventDate}T${clock(time)}${MANILA_OFFSET}`)
  if (Number.isNaN(start.getTime())) return undefined
  return {
    start: formatManila(start),
    end: formatManila(new Date(start.getTime() + DEFAULT_DURATION_MS)),
  }
}

function buildEventTicketClass(ctx: PassContext, issuerId: string) {
  const classId = `${issuerId}.eypi_event_${sanitizeSlug(ctx.event.slug)}`
  const location = ctx.event.location?.trim() || 'TBA'
  const eventTicketClass: Record<string, unknown> = {
    id: classId,
    eventId: classId,
    issuerName: 'eypi.cc',
    reviewStatus: 'UNDER_REVIEW',
    eventName: {
      defaultValue: { language: 'en-US', value: ctx.event.name },
    },
    venue: {
      name: {
        defaultValue: { language: 'en-US', value: location },
      },
      address: {
        defaultValue: { language: 'en-US', value: location },
      },
    },
    hexBackgroundColor: '#FFFFFF',
  }

  const interval = buildManilaInterval(ctx)
  if (interval) {
    eventTicketClass.dateTime = { start: interval.start, end: interval.end }
  }

  return eventTicketClass
}

function buildEventTicketObject(ctx: PassContext, issuerId: string) {
  const classId = `${issuerId}.eypi_event_${sanitizeSlug(ctx.event.slug)}`
  const objectId = `${issuerId}.eypi_${ctx.attendee.id.replace(/-/g, '_')}`
  const attendeeName = `${ctx.attendee.firstName} ${ctx.attendee.lastName}`.trim()
  const clusterLabel = ctx.attendee.clusterValue?.trim() || 'General'
  const backFields = buildBackFields(ctx.customFields)

  const textModulesData = [
    {
      id: 'cluster',
      header: 'Tier',
      body: clusterLabel,
    },
    ...backFields.map((field, index) => ({
      id: sanitizeModuleId(field.label, index),
      header: field.label.slice(0, 200),
      body: field.value.slice(0, 2000),
    })),
  ]

  const eventTicketObject: Record<string, unknown> = {
    id: objectId,
    classId,
    state: 'ACTIVE',
    ticketHolderName: attendeeName,
    ticketNumber: ctx.attendee.qrToken,
    ticketType: {
      defaultValue: { language: 'en-US', value: clusterLabel },
    },
    barcode: {
      type: 'QR_CODE',
      value: ctx.attendee.qrToken,
      alternateText: ctx.attendee.qrToken,
    },
    hexBackgroundColor: '#FFFFFF',
    textModulesData,
    linksModuleData: {
      uris: [{
        uri: `https://eypi.cc/tix/${ctx.event.slug}`,
        description: 'View ticket online',
        id: 'ticket_link',
      }],
    },
  }

  const interval = buildManilaInterval(ctx)
  if (interval) {
    eventTicketObject.validTimeInterval = {
      start: { date: interval.start },
      end: { date: interval.end },
    }
  }

  return eventTicketObject
}

function assertGoogleConfig(env: Bindings): void {
  if (!env.GOOGLE_WALLET_ISSUER_ID
    || !env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL
    || !env.GOOGLE_WALLET_SERVICE_ACCOUNT_PRIVATE_KEY) {
    throw new Error('Google Wallet credentials are not configured.')
  }
}

function normalizePrivateKey(pem: string): string {
  return pem.includes('\\n') ? pem.replace(/\\n/g, '\n') : pem
}

function classUrl(classId: string): string {
  return `${CLASS_COLLECTION}/${classId}`
}

/** PATCH must not send reviewStatus or an approved class is forced back under review. */
function classPatchBody(eventTicketClass: Record<string, unknown>): Record<string, unknown> {
  const next = { ...eventTicketClass }
  delete next.reviewStatus
  return next
}

async function googleAccessToken(email: string, privateKey: CryptoKey): Promise<string> {
  const assertion = await new SignJWT({ scope: WALLET_SCOPE })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(email)
    .setAudience(TOKEN_URL)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(privateKey)

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })
  const body = await response.json() as { access_token?: string }
  if (!response.ok || !body.access_token) {
    throw new Error('Google Wallet auth failed.')
  }
  return body.access_token
}

async function upsertEventTicketClass(
  accessToken: string,
  eventTicketClass: Record<string, unknown>,
): Promise<void> {
  const url = classUrl(String(eventTicketClass.id))
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  }
  const existing = await fetch(url, { headers: { Authorization: headers.Authorization } })
  if (existing.status === 404) {
    await existing.text()
    const inserted = await fetch(CLASS_COLLECTION, {
      method: 'POST',
      headers,
      body: JSON.stringify(eventTicketClass),
    })
    if (inserted.ok) return
    await inserted.text()
    if (inserted.status !== 409) throw new Error('Google Wallet class insert failed.')
  } else if (!existing.ok) {
    await existing.text()
    throw new Error('Google Wallet class lookup failed.')
  } else {
    await existing.text()
  }

  const patched = await fetch(url, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(classPatchBody(eventTicketClass)),
  })
  if (!patched.ok) {
    await patched.text()
    throw new Error('Google Wallet class update failed.')
  }
}

export async function buildGoogleWalletSaveUrl(
  ctx: PassContext,
  env: Bindings,
): Promise<string> {
  try {
    assertGoogleConfig(env)
    const issuerId = env.GOOGLE_WALLET_ISSUER_ID!
    const email = env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL!
    const privateKeyPem = normalizePrivateKey(env.GOOGLE_WALLET_SERVICE_ACCOUNT_PRIVATE_KEY!)

    const privateKey = await importPKCS8(privateKeyPem, 'RS256')
    const eventTicketClass = buildEventTicketClass(ctx, issuerId)
    const eventTicketObject = buildEventTicketObject(ctx, issuerId)
    const accessToken = await googleAccessToken(email, privateKey)
    await upsertEventTicketClass(accessToken, eventTicketClass)

    const jwt = await new SignJWT({
      typ: 'savetowallet',
      origins: ['eypi.cc'],
      payload: {
        eventTicketClasses: [eventTicketClass],
        eventTicketObjects: [eventTicketObject],
      },
    })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer(email)
      .setAudience('google')
      .setIssuedAt()
      .sign(privateKey)

    return `https://pay.google.com/gp/v/save/${jwt}`
  } catch (err) {
    console.error('buildGoogleWalletSaveUrl failed:', err instanceof Error ? err.message : err)
    throw err
  }
}
