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

/** The event day is over (Manila). Past tickets show no QR and cannot be cancelled. */
export function isPastEvent(ticket: TicketDto, now: number = Date.now()): boolean {
  return ticket.event.eventDate < manilaToday(now)
}
