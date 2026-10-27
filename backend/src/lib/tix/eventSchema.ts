import { z } from 'zod'

export const DESCRIPTION_MAX = 4000
export const QUESTIONS_MAX = 5
export const OPTIONS_MAX = 20
export const OPTION_LENGTH_MAX = 100
export const LABEL_MAX = 200

const FORBIDDEN_IDS = new Set(['__proto__', 'constructor', 'prototype'])

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-11-01.')
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().startsWith(v), 'Use a real date.')
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a time like 09:00.')

/** An ISO instant (offset optional, naive means UTC). Stored as `YYYY-MM-DD HH:MM:SS` UTC. */
const instant = z.string().max(40).transform((value, ctx) => {
  const trimmed = value.trim()
  const normalized = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T')
  const withZone = /(?:Z|[+-]\d{2}:\d{2})$/.test(normalized) ? normalized : `${normalized}Z`
  const parsed = new Date(withZone)
  if (!/^\d{4}-\d{2}-\d{2}/.test(trimmed) || Number.isNaN(parsed.getTime())) {
    ctx.addIssue({ code: 'custom', message: 'Use a date and time.' })
    return z.NEVER
  }
  return parsed.toISOString().slice(0, 19).replace('T', ' ')
})

export const questionSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/, 'Use letters, numbers, dashes or underscores.')
    .refine((id) => !FORBIDDEN_IDS.has(id), 'That id is reserved.'),
  label: z.string().trim().min(1, 'Enter a label.').max(LABEL_MAX),
  type: z.enum(['text', 'choice', 'checkbox']),
  options: z.array(z.string().trim().min(1).max(OPTION_LENGTH_MAX)).max(OPTIONS_MAX).optional(),
  required: z.boolean().optional(),
}).superRefine((q, ctx) => {
  const needsOptions = q.type === 'choice' || q.type === 'checkbox'
  if (needsOptions && (!q.options || q.options.length < 1)) {
    ctx.addIssue({ code: 'custom', path: ['options'], message: 'Add at least one option.' })
  }
  if (needsOptions && q.options && new Set(q.options).size !== q.options.length) {
    ctx.addIssue({ code: 'custom', path: ['options'], message: 'Options must be different.' })
  }
}).transform((q) => ({
  id: q.id,
  label: q.label,
  type: q.type,
  ...(q.type === 'text' ? {} : { options: q.options ?? [] }),
  required: q.required === true,
}))

export const questionsSchema = z.array(questionSchema).max(QUESTIONS_MAX, `Use at most ${QUESTIONS_MAX} questions.`)
  .refine((list) => new Set(list.map((q) => q.id)).size === list.length, 'Question ids must be unique.')

const shape = {
  name: z.string().trim().min(1, 'Enter a name.').max(200),
  slug: z.string().regex(/^[a-z0-9]+$/, 'Use lowercase letters and numbers only.').max(60),
  date,
  time: clock,
  endTime: clock.nullable(),
  location: z.string().trim().min(1, 'Enter a location.').max(300),
  description: z.string().max(DESCRIPTION_MAX, `Keep the description under ${DESCRIPTION_MAX} characters.`).nullable(),
  admissionMode: z.enum(['fcfs', 'lottery', 'approval', 'import']),
  visibility: z.enum(['public', 'unlisted']),
  capacity: z.number().int().min(1).max(1_000_000).nullable(),
  waitlistEnabled: z.boolean(),
  registrationOpensAt: instant.nullable(),
  registrationClosesAt: instant.nullable(),
  questions: questionsSchema,
}

export const eventCreateSchema = z.object({
  name: shape.name,
  slug: shape.slug,
  date: shape.date,
  time: shape.time,
  location: shape.location,
  endTime: shape.endTime.optional(),
  description: shape.description.optional(),
  admissionMode: shape.admissionMode.optional(),
  visibility: shape.visibility.optional(),
  capacity: shape.capacity.optional(),
  // Pre-Tix-rework callers send maxAttendees.
  maxAttendees: shape.capacity.optional(),
  waitlistEnabled: shape.waitlistEnabled.optional(),
  registrationOpensAt: shape.registrationOpensAt.optional(),
  registrationClosesAt: shape.registrationClosesAt.optional(),
  questions: shape.questions.optional(),
})

export const eventPatchSchema = z.object({
  name: shape.name.optional(),
  date: shape.date.optional(),
  time: shape.time.optional(),
  location: shape.location.optional(),
  endTime: shape.endTime.optional(),
  description: shape.description.optional(),
  admissionMode: shape.admissionMode.optional(),
  visibility: shape.visibility.optional(),
  capacity: shape.capacity.optional(),
  maxAttendees: shape.capacity.optional(),
  waitlistEnabled: shape.waitlistEnabled.optional(),
  registrationOpensAt: shape.registrationOpensAt.optional(),
  registrationClosesAt: shape.registrationClosesAt.optional(),
  questions: shape.questions.optional(),
  passFields: z.unknown().optional(),
})

/** One message per top-level field, keyed by the request field name. */
export function zodFields(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'body')
    if (!(key in fields)) fields[key] = issue.message
  }
  return fields
}
