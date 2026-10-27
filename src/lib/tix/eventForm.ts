/** Event builder form: validation mirrors backend/src/lib/tix/eventSchema.ts. Times are Manila (UTC+8). */
export const DESCRIPTION_MAX = 4000
export const QUESTIONS_MAX = 5
export const OPTIONS_MAX = 20
export const OPTION_LENGTH_MAX = 100
export const LABEL_MAX = 200
export const SLUG_MAX = 60
export const CAPACITY_MAX = 1_000_000

export type AdmissionMode = 'fcfs' | 'lottery' | 'approval' | 'import'
export type Visibility = 'public' | 'unlisted'
export type EventStatus = 'draft' | 'published' | 'closed' | 'cancelled'
export type QuestionType = 'text' | 'choice' | 'checkbox'

export interface QuestionDraft {
  id: string
  label: string
  type: QuestionType
  options: string[]
  required: boolean
}

export interface EventForm {
  name: string
  slug: string
  date: string
  time: string
  endTime: string
  location: string
  description: string
  admissionMode: AdmissionMode
  visibility: Visibility
  /** Empty means no limit. */
  capacity: string
  waitlistEnabled: boolean
  /** `YYYY-MM-DDTHH:mm`, Manila time. Empty means not set. */
  opensAt: string
  closesAt: string
  questions: QuestionDraft[]
}

/** The org view of an event (GET /api/events/:slug). */
export interface ManagedEvent {
  slug: string
  name: string
  eventDate: string
  eventTime: string
  endTime: string | null
  location: string
  description: string | null
  admissionMode: AdmissionMode
  visibility: Visibility
  capacity: number | null
  waitlistEnabled: boolean
  registrationOpensAt: string | null
  registrationClosesAt: string | null
  questions: { id: string; label: string; type: QuestionType; options?: string[]; required?: boolean }[]
  status?: EventStatus
  coverUrl?: string | null
  coverMeta?: unknown
}

export function blankForm(): EventForm {
  return {
    name: '', slug: '', date: '', time: '', endTime: '', location: '', description: '',
    admissionMode: 'fcfs', visibility: 'unlisted', capacity: '', waitlistEnabled: false,
    opensAt: '', closesAt: '', questions: [],
  }
}

export function slugFromName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, SLUG_MAX)
}

let counter = 0
export function newQuestion(): QuestionDraft {
  counter += 1
  return { id: `q${Date.now().toString(36)}${counter}`, label: '', type: 'text', options: [], required: false }
}

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000

export function manilaLocalToIso(local: string): string | null {
  return local ? `${local}:00+08:00` : null
}

/** A stored UTC instant (`YYYY-MM-DD HH:MM:SS`) as a Manila `datetime-local` value. */
export function storedUtcToManilaLocal(stored: string | null | undefined): string {
  if (!stored) return ''
  const iso = stored.includes('T') ? stored : stored.replace(' ', 'T')
  const ms = Date.parse(/(?:Z|[+-]\d{2}:\d{2})$/.test(iso) ? iso : `${iso}Z`)
  if (Number.isNaN(ms)) return ''
  return new Date(ms + MANILA_OFFSET_MS).toISOString().slice(0, 16)
}

export function formFromEvent(e: ManagedEvent): EventForm {
  return {
    name: e.name,
    slug: e.slug,
    date: e.eventDate,
    time: e.eventTime,
    endTime: e.endTime ?? '',
    location: e.location,
    description: e.description ?? '',
    admissionMode: e.admissionMode,
    visibility: e.visibility,
    capacity: e.capacity == null ? '' : String(e.capacity),
    waitlistEnabled: e.waitlistEnabled,
    opensAt: storedUtcToManilaLocal(e.registrationOpensAt),
    closesAt: storedUtcToManilaLocal(e.registrationClosesAt),
    questions: e.questions.map((q) => ({
      id: q.id, label: q.label, type: q.type, options: [...(q.options ?? [])], required: q.required === true,
    })),
  }
}

/** Waitlist, registration window and questions only apply when people register themselves. */
export const takesSelfRegistration = (mode: AdmissionMode) => mode !== 'import'
export const allowsWaitlist = (mode: AdmissionMode) => mode === 'fcfs' || mode === 'lottery'

function parseCapacity(raw: string): number | null | 'invalid' {
  const trimmed = String(raw ?? '').trim()
  if (!trimmed) return null
  if (!/^\d+$/.test(trimmed)) return 'invalid'
  const n = Number(trimmed)
  return n >= 1 && n <= CAPACITY_MAX ? n : 'invalid'
}

/** One message per question that has a problem, or '' when all are fine. */
export function questionProblems(questions: QuestionDraft[]): string[] {
  return questions.map((q, i) => {
    const n = i + 1
    if (!q.label.trim()) return `Question ${n}: enter a label.`
    if (q.label.trim().length > LABEL_MAX) return `Question ${n}: keep the label under ${LABEL_MAX} characters.`
    if (q.type === 'text') return ''
    const options = q.options.map((o) => o.trim()).filter(Boolean)
    if (options.length < 1) return `Question ${n}: add at least one option.`
    if (options.length > OPTIONS_MAX) return `Question ${n}: use at most ${OPTIONS_MAX} options.`
    if (options.some((o) => o.length > OPTION_LENGTH_MAX)) return `Question ${n}: keep each option under ${OPTION_LENGTH_MAX} characters.`
    if (new Set(options).size !== options.length) return `Question ${n}: options must be different.`
    return ''
  })
}

export function validateForm(form: EventForm): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!form.name.trim()) errors.name = 'Enter a name.'
  else if (form.name.trim().length > 200) errors.name = 'Keep the name under 200 characters.'
  if (!/^[a-z0-9]+$/.test(form.slug)) errors.slug = 'Use lowercase letters and numbers only.'
  else if (form.slug.length > SLUG_MAX) errors.slug = `Keep the link under ${SLUG_MAX} characters.`
  if (!form.date) errors.date = 'Pick a date.'
  if (!form.time) errors.time = 'Pick a start time.'
  if (!form.location.trim()) errors.location = 'Enter a location.'
  else if (form.location.trim().length > 300) errors.location = 'Keep the location under 300 characters.'
  if (form.description.length > DESCRIPTION_MAX) errors.description = `Keep the description under ${DESCRIPTION_MAX} characters.`
  if (parseCapacity(form.capacity) === 'invalid') errors.capacity = `Use a whole number from 1 to ${CAPACITY_MAX.toLocaleString('en-US')}, or leave it empty for no limit.`

  if (takesSelfRegistration(form.admissionMode)) {
    if (form.opensAt && form.closesAt && Date.parse(form.closesAt) <= Date.parse(form.opensAt)) {
      errors.closesAt = 'Registration must close after it opens.'
    }
    if (form.questions.length > QUESTIONS_MAX) errors.questions = `Use at most ${QUESTIONS_MAX} questions.`
    else {
      const first = questionProblems(form.questions).find(Boolean)
      if (first) errors.questions = first
    }
  }
  return errors
}

export function toPayload(form: EventForm) {
  const self = takesSelfRegistration(form.admissionMode)
  const capacity = parseCapacity(form.capacity)
  return {
    name: form.name.trim(),
    slug: form.slug,
    date: form.date,
    time: form.time,
    endTime: form.endTime || null,
    location: form.location.trim(),
    description: form.description.trim() ? form.description.trim() : null,
    admissionMode: form.admissionMode,
    visibility: form.visibility,
    capacity: capacity === 'invalid' ? null : capacity,
    waitlistEnabled: self && allowsWaitlist(form.admissionMode) && form.waitlistEnabled,
    registrationOpensAt: self ? manilaLocalToIso(form.opensAt) : null,
    registrationClosesAt: self ? manilaLocalToIso(form.closesAt) : null,
    questions: self
      ? form.questions.map((q) => ({
        id: q.id,
        label: q.label.trim(),
        type: q.type,
        ...(q.type === 'text' ? {} : { options: q.options.map((o) => o.trim()).filter(Boolean) }),
        required: q.required,
      }))
      : [],
  }
}
