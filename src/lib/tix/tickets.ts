/** Mirrors backend/src/lib/tix/registration.ts TicketDto (the API response shape). */
export type TicketStatus = 'pending' | 'entered' | 'waitlisted' | 'confirmed' | 'declined' | 'cancelled'

export type TicketDto = {
  id: string
  status: TicketStatus
  qrToken: string | null
  waitlistPosition: number | null
  answers: Record<string, unknown>
  event: {
    slug: string
    name: string
    eventDate: string
    eventTime: string
    endTime: string | null
    location: string
    coverUrl: string | null
    coverMeta: unknown
  }
}

/** Today in Asia/Manila as YYYY-MM-DD. */
export function manilaToday(now: number = Date.now()): string {
  return new Date(now + 8 * 3600_000).toISOString().slice(0, 10)
}

/**
 * The event is over: from 06:00 Manila the day after it, so a late-night event still counts as
 * upcoming at 01:00. Past tickets show no QR and cannot be cancelled. The server uses the same
 * cutoff (`date('now', '+2 hours')` in GET /api/tickets).
 */
export function isPastEvent(ticket: TicketDto, now: number = Date.now()): boolean {
  return ticket.event.eventDate < manilaToday(now - 6 * 3600_000)
}
