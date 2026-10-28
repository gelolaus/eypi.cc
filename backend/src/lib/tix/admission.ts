import { asUtc, manilaEventStart } from '../manilaTime'

export type AdmissionMode = 'fcfs' | 'lottery' | 'approval' | 'import'
export type AttendeeStatus = 'pending' | 'entered' | 'waitlisted' | 'confirmed' | 'declined' | 'cancelled'
export type Actor = 'attendee' | 'org' | 'system'

export type RegistrationWindowEvent = {
  status: string
  admission_mode: AdmissionMode
  registration_opens_at: string | null
  registration_closes_at: string | null
  event_date: string
  event_time: string
}

export type RegistrationOpenResult =
  | { ok: true }
  | { ok: false; code: 'not_published' | 'not_open_yet' | 'registration_closed' | 'invite_only' }

/**
 * Whether self-registration is allowed right now.
 * NULL opens = on publish; NULL closes = event start in Manila time (UTC+8).
 */
export function registrationOpen(event: RegistrationWindowEvent, now: Date): RegistrationOpenResult {
  if (event.status === 'closed' || event.status === 'cancelled') {
    return { ok: false, code: 'registration_closed' }
  }
  if (event.status !== 'published') return { ok: false, code: 'not_published' }
  if (event.admission_mode === 'import') return { ok: false, code: 'invite_only' }

  const t = now.getTime()
  if (event.registration_opens_at) {
    const opens = asUtc(event.registration_opens_at).getTime()
    if (Number.isFinite(opens) && t < opens) return { ok: false, code: 'not_open_yet' }
  }

  const closes = event.registration_closes_at
    ? asUtc(event.registration_closes_at)
    : manilaEventStart(event.event_date, event.event_time)
  // An unreadable close time must not leave registration open forever.
  if (!Number.isFinite(closes.getTime()) || t >= closes.getTime()) {
    return { ok: false, code: 'registration_closed' }
  }
  return { ok: true }
}

/** Status a new registration starts in, or `'full'` when an FCFS event has no seat and no waitlist. */
export function initialStatus(
  mode: AdmissionMode,
  seatFree: boolean,
  waitlistEnabled: boolean,
): AttendeeStatus | 'full' {
  switch (mode) {
    case 'fcfs':
      if (seatFree) return 'confirmed'
      return waitlistEnabled ? 'waitlisted' : 'full'
    case 'lottery':
      return 'entered'
    case 'approval':
      return 'pending'
    case 'import':
      return 'confirmed'
  }
}

const ARROWS: Record<AttendeeStatus, Partial<Record<AttendeeStatus, Actor[]>>> = {
  pending: { confirmed: ['org'], declined: ['org'], cancelled: ['attendee', 'org'] },
  entered: {
    confirmed: ['system'],
    waitlisted: ['system'],
    declined: ['system'],
    cancelled: ['attendee', 'org'],
  },
  waitlisted: { confirmed: ['system'], cancelled: ['attendee', 'org'] },
  confirmed: { cancelled: ['attendee', 'org'] },
  declined: {},
  cancelled: {},
}

/** Spec 5.2: attendees may only cancel; the org approves, declines or cancels; the system promotes and draws. */
export function canTransition(from: AttendeeStatus, to: AttendeeStatus, actor: Actor): boolean {
  return ARROWS[from]?.[to]?.includes(actor) ?? false
}
