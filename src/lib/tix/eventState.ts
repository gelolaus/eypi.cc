export type AdmissionMode = 'fcfs' | 'lottery' | 'approval' | 'import'
export type TicketStatus = 'pending' | 'entered' | 'waitlisted' | 'confirmed' | 'declined' | 'cancelled'

export type EventQuestion = {
  id: string
  label: string
  type: 'text' | 'choice' | 'checkbox'
  options?: string[]
  required?: boolean
}

export type TicketEvent = {
  slug: string
  name: string
  eventDate: string
  eventTime: string
  endTime: string | null
  location: string
  coverUrl: string | null
  coverMeta: unknown
}

export type Ticket = {
  id: string
  status: TicketStatus
  qrToken: string | null
  waitlistPosition: number | null
  answers: Record<string, string | string[]>
  event: TicketEvent
}

export type PublicEvent = {
  slug: string
  name: string
  eventDate: string
  eventTime: string
  endTime: string | null
  location: string
  descriptionHtml: string
  coverUrl: string | null
  coverMeta: unknown
  admissionMode: AdmissionMode
  seatsLeft: number | null
  waitlistEnabled: boolean
  registrationOpensAt: string | null
  registrationClosesAt: string | null
  status: string
  questions: EventQuestion[]
  org: { slug: string; name: string }
}

export type PublicEventResponse = { event: PublicEvent; viewer: { ticket: Ticket | null } }

export type PrimaryLabel =
  | 'Register'
  | 'Join waitlist'
  | 'Enter lottery'
  | 'Request a spot'
  | 'Registration closed'
  | "You're in"
  | 'On the waitlist'
  | 'Entered'
  | 'Pending approval'

export type PrimaryAction = { label: PrimaryLabel; kind: 'register' | 'view-ticket' | 'none' }

/** Why self-registration is unavailable, or null while it is open with room (or a waitlist). */
export type RegistrationBlock = 'cancelled' | 'closed' | 'not_open_yet' | 'invite_only' | 'full'

function utc(value: string): number {
  const t = value.trim()
  const iso = t.includes('T') ? t : t.replace(' ', 'T')
  return new Date(/(?:Z|[+-]\d{2}:\d{2})$/.test(iso) ? iso : `${iso}Z`).getTime()
}

function eventStart(event: Pick<PublicEvent, 'eventDate' | 'eventTime'>): number {
  const time = /^\d{2}:\d{2}$/.test(event.eventTime) ? `${event.eventTime}:00` : event.eventTime
  return new Date(`${event.eventDate}T${time}+08:00`).getTime()
}

/** Mirrors the server's registrationOpen plus the FCFS capacity check; the server stays the authority. */
export function registrationBlock(event: PublicEvent, now: Date): RegistrationBlock | null {
  if (event.status === 'cancelled') return 'cancelled'
  if (event.status === 'closed') return 'closed'
  if (event.status !== 'published') return 'closed'
  if (event.admissionMode === 'import') return 'invite_only'
  const t = now.getTime()
  if (event.registrationOpensAt) {
    const opens = utc(event.registrationOpensAt)
    if (Number.isFinite(opens) && t < opens) return 'not_open_yet'
  }
  const closes = event.registrationClosesAt ? utc(event.registrationClosesAt) : eventStart(event)
  if (!Number.isFinite(closes) || t >= closes) return 'closed'
  if (event.admissionMode === 'fcfs' && event.seatsLeft === 0 && !event.waitlistEnabled) return 'full'
  return null
}

export function primaryAction(event: PublicEvent, viewerTicket: Ticket | null, now: Date): PrimaryAction {
  // A cancelled ticket does not block registering again; the server refuses if the organisers cancelled it.
  if (viewerTicket && viewerTicket.status !== 'cancelled') {
    switch (viewerTicket.status) {
      case 'confirmed': return { label: "You're in", kind: 'view-ticket' }
      case 'waitlisted': return { label: 'On the waitlist', kind: 'view-ticket' }
      case 'entered': return { label: 'Entered', kind: 'view-ticket' }
      case 'pending': return { label: 'Pending approval', kind: 'view-ticket' }
      default: return { label: 'Registration closed', kind: 'none' }
    }
  }
  if (registrationBlock(event, now)) return { label: 'Registration closed', kind: 'none' }
  switch (event.admissionMode) {
    case 'lottery': return { label: 'Enter lottery', kind: 'register' }
    case 'approval': return { label: 'Request a spot', kind: 'register' }
    case 'fcfs': return { label: event.seatsLeft === 0 ? 'Join waitlist' : 'Register', kind: 'register' }
    default: return { label: 'Registration closed', kind: 'none' }
  }
}
