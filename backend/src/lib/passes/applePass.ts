import forge from 'node-forge'
import { zipSync } from 'fflate'
import type { Bindings } from '../db'
import { buildBackFields, type PassContext } from './context'

const NAVY_RGB = 'rgb(52, 65, 143)'
const WHITE_RGB = 'rgb(255, 255, 255)'

const WALLET_IMAGE_FILES = [
  'icon.png',
  'icon@2x.png',
  'logo.png',
  'logo@2x.png',
  'logo@3x.png',
] as const

// Minimal 1×1 white PNG fallback when assets are unavailable.
const FALLBACK_PNG = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='),
  c => c.charCodeAt(0),
)

async function sha1Hex(data: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-1', data)
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

function buildPassJson(ctx: PassContext, env: Bindings): string {
  const attendeeName = `${ctx.attendee.firstName} ${ctx.attendee.lastName}`.trim()
  const clusterLabel = ctx.attendee.clusterValue?.trim() || '—'
  const backFields = buildBackFields(ctx.customFields).map((field, index) => ({
    key: `custom_${index}`,
    label: field.label,
    value: field.value,
  }))

  const pass = {
    formatVersion: 1,
    passTypeIdentifier: env.APPLE_PASS_TYPE_ID,
    teamIdentifier: env.APPLE_TEAM_ID,
    organizationName: 'eypi.cc',
    description: ctx.event.name,
    serialNumber: ctx.attendee.id,
    logoText: 'eypi.cc',
    backgroundColor: WHITE_RGB,
    foregroundColor: NAVY_RGB,
    labelColor: NAVY_RGB,
    eventTicket: {
      headerFields: [{
        key: 'event',
        label: 'EVENT',
        value: ctx.event.name,
      }],
      primaryFields: [{
        key: 'attendee',
        label: 'ATTENDEE',
        value: attendeeName,
      }],
      secondaryFields: [{
        key: 'cluster',
        label: 'TIER',
        value: clusterLabel,
      }],
      backFields,
    },
    barcodes: [{
      format: 'PKBarcodeFormatQR',
      message: ctx.attendee.qrToken,
      messageEncoding: 'iso-8859-1',
    }],
  }

  return JSON.stringify(pass)
}

function signManifest(
  manifestJson: string,
  certPem: string,
  keyPem: string,
  wwdrPem: string,
): Uint8Array {
  const p7 = forge.pkcs7.createSignedData()
  p7.content = forge.util.createBuffer(manifestJson, 'utf8')
  const cert = forge.pki.certificateFromPem(certPem)
  const wwdr = forge.pki.certificateFromPem(wwdrPem)
  const key = forge.pki.privateKeyFromPem(keyPem)
  p7.addCertificate(cert)
  p7.addCertificate(wwdr)
  p7.addSigner({
    key,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha1,
    authenticatedAttributes: [{
      type: forge.pki.oids.contentType,
      value: forge.pki.oids.data,
    }, {
      type: forge.pki.oids.messageDigest,
    }, {
      type: forge.pki.oids.signingTime,
      // node-forge accepts Date at runtime; @types/node-forge is overly strict
      value: new Date() as unknown as string,
    }],
  })
  p7.sign({ detached: true })
  const der = forge.asn1.toDer(p7.toAsn1()).getBytes()
  const bytes = new Uint8Array(der.length)
  for (let i = 0; i < der.length; i++) bytes[i] = der.charCodeAt(i)
  return bytes
}

async function loadWalletImages(assets: Fetcher): Promise<Record<string, Uint8Array>> {
  const images: Record<string, Uint8Array> = {}
  for (const filename of WALLET_IMAGE_FILES) {
    try {
      const res = await assets.fetch(`https://wallet.internal/wallet/${filename}`)
      if (res.ok) {
        images[filename] = new Uint8Array(await res.arrayBuffer())
      } else {
        images[filename] = FALLBACK_PNG
      }
    } catch {
      images[filename] = FALLBACK_PNG
    }
  }
  return images
}

function assertAppleConfig(env: Bindings): void {
  if (!env.APPLE_PASS_TYPE_ID || !env.APPLE_TEAM_ID
    || !env.APPLE_PASS_CERT_PEM || !env.APPLE_PASS_KEY_PEM || !env.APPLE_WWDR_CERT_PEM) {
    throw new Error('Apple Wallet credentials are not configured.')
  }
}

export async function buildApplePass(
  ctx: PassContext,
  env: Bindings,
): Promise<Uint8Array> {
  try {
    assertAppleConfig(env)
    const passJson = buildPassJson(ctx, env)
    const passBytes = new TextEncoder().encode(passJson)
    const images = await loadWalletImages(env.ASSETS)

    const files: Record<string, Uint8Array> = {
      'pass.json': passBytes,
      ...images,
    }

    const manifest: Record<string, string> = {}
    for (const [name, data] of Object.entries(files)) {
      manifest[name] = await sha1Hex(data)
    }
    const manifestJson = JSON.stringify(manifest)
    const manifestBytes = new TextEncoder().encode(manifestJson)

    const signature = signManifest(
      manifestJson,
      env.APPLE_PASS_CERT_PEM!,
      env.APPLE_PASS_KEY_PEM!,
      env.APPLE_WWDR_CERT_PEM!,
    )

    files['manifest.json'] = manifestBytes
    files['signature'] = signature

    return zipSync(files)
  } catch (err) {
    console.error('buildApplePass failed:', err instanceof Error ? err.message : err)
    throw err
  }
}
