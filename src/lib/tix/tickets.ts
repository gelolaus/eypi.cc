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
