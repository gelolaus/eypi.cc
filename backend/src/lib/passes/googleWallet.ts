import { SignJWT, importPKCS8 } from 'jose'
import type { Bindings } from '../db'
import { buildBackFields, type PassContext } from './context'

function sanitizeSlug(slug: string): string {
  return slug.replace(/[^a-z0-9]/g, '_')
}

function sanitizeModuleId(label: string, index: number): string {
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  return `field_${base || index}`
}

function buildEventDateTime(ctx: PassContext): { start: string } | undefined {
  if (!ctx.event.eventDate) return undefined
  const time = ctx.event.eventTime || '00:00'
  return { start: `${ctx.event.eventDate}T${time}:00` }
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

  const dateTime = buildEventDateTime(ctx)
  if (dateTime) eventTicketClass.dateTime = dateTime

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

  const dateTime = buildEventDateTime(ctx)
  if (dateTime) {
    eventTicketObject.validTimeInterval = {
      start: { date: dateTime.start },
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
