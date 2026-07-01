import { SignJWT, importPKCS8 } from 'jose'
import type { Bindings } from '../db'
import { buildBackFields, type PassContext } from './context'

function sanitizeSlug(slug: string): string {
  return slug.replace(/[^a-z0-9]/g, '_')
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

function buildEventTicketClass(ctx: PassContext, issuerId: string) {
  const classId = `${issuerId}.eypi_event_${sanitizeSlug(ctx.event.slug)}`
  return {
    id: classId,
    issuerName: 'eypi.cc',
    reviewStatus: 'UNDER_REVIEW',
    eventName: {
      defaultValue: { language: 'en-US', value: ctx.event.name },
    },
    venue: {
      name: {
        defaultValue: { language: 'en-US', value: ctx.event.location || 'TBA' },
      },
    },
    dateTime: {
      start: ctx.event.eventDate
        ? `${ctx.event.eventDate}T${ctx.event.eventTime || '00:00'}:00`
        : undefined,
    },
    hexBackgroundColor: '#FFFFFF',
    logo: {
      sourceUri: {
        uri: 'https://eypi.cc/favicon.svg',
      },
    },
  }
}

function buildEventTicketObject(ctx: PassContext, issuerId: string) {
  const classId = `${issuerId}.eypi_event_${sanitizeSlug(ctx.event.slug)}`
  const objectId = `${issuerId}.eypi_${ctx.attendee.id}`
  const attendeeName = `${ctx.attendee.firstName} ${ctx.attendee.lastName}`.trim()
  const clusterLabel = ctx.attendee.clusterValue?.trim() || '—'
  const backFields = buildBackFields(ctx.customFields)

  const textModulesData = [
    {
      id: 'cluster',
      header: 'Tier',
      body: clusterLabel,
    },
    ...backFields.map((field, index) => ({
      id: `custom_${index}`,
      header: field.label,
      body: field.value,
    })),
  ]

  return {
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
      }],
    },
    validTimeInterval: {
      start: {
        date: ctx.event.eventDate || new Date().toISOString().slice(0, 10),
      },
    },
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

    const jwt = await new SignJWT({
      typ: 'savetowallet',
      origins: ['https://eypi.cc'],
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
