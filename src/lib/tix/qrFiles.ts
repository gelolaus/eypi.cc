import { TIX_QR_RENDER_OPTIONS } from '@/utils/tix-qr'

export interface AttendeeQrIdentity {
  id: string
  firstName: string
  lastName: string
  qrToken?: string
}

function namePart(value: string): string {
  const cleaned = value.trim().replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '')
  return cleaned || 'guest'
}

export function attendeeQrFileName(attendee: Pick<AttendeeQrIdentity, 'id' | 'firstName' | 'lastName'>): string {
  const last = namePart(attendee.lastName)
  const first = namePart(attendee.firstName)
  const id8 = attendee.id.slice(0, 8)
  return `${last}_${first}_${id8}.png`
}

export function attendeeQrZipNames(attendees: Pick<AttendeeQrIdentity, 'id' | 'firstName' | 'lastName'>[]): string[] {
  const taken = new Set<string>()
  return attendees.map((attendee) => {
    const base = attendeeQrFileName(attendee)
    if (!taken.has(base)) {
      taken.add(base)
      return base
    }
    const stem = base.slice(0, -'.png'.length)
    let suffix = 2
    let next = `${stem}_${suffix}.png`
    while (taken.has(next)) {
      suffix += 1
      next = `${stem}_${suffix}.png`
    }
    taken.add(next)
    return next
  })
}

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

export async function downloadAttendeeQr(attendee: AttendeeQrIdentity & { qrToken: string }) {
  const { default: QRCodeStyling } = await import('qr-code-styling')
  const qr = new QRCodeStyling({
    width: 400,
    height: 400,
    type: 'canvas',
    data: attendee.qrToken,
    ...TIX_QR_RENDER_OPTIONS,
  })
  const blob = await qr.getRawData('png')
  if (!blob) return
  triggerDownload(blob as Blob, attendeeQrFileName(attendee))
}

export async function downloadAttendeeQrZip(slug: string, attendees: Array<AttendeeQrIdentity & { qrToken: string }>) {
  const { default: QRCodeStyling } = await import('qr-code-styling')
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()
  const names = attendeeQrZipNames(attendees)
  for (let index = 0; index < attendees.length; index += 1) {
    const attendee = attendees[index]
    const qr = new QRCodeStyling({
      width: 400,
      height: 400,
      type: 'canvas',
      data: attendee.qrToken,
      ...TIX_QR_RENDER_OPTIONS,
    })
    const blob = await qr.getRawData('png')
    if (blob) zip.file(names[index], blob)
  }
  const content = await zip.generateAsync({ type: 'blob' })
  triggerDownload(content, `${slug}-tickets.zip`)
}
