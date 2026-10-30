export type CaptionSegment =
  | { type: 'text'; text: string }
  | { type: 'field'; key: string; label: string; raw: string }

export type CaptionField = { key: string; label: string }

export const MAX_CAPTION_FIELDS = 10
const MAX_LABEL_LENGTH = 40

/** A placeholder is `{{label}}`: no braces or line breaks inside. Length is checked after trimming. */
const PLACEHOLDER = /\{\{([^{}\n]{1,60})\}\}/g

/** Splits a caption into plain text and `{{label}}` fields. Invalid brackets stay in the text. */
export function parseCaption(template: string): CaptionSegment[] {
  const segments: CaptionSegment[] = []
  let cursor = 0
  for (const match of template.matchAll(PLACEHOLDER)) {
    const label = match[1].trim().replace(/\s+/g, ' ')
    if (!label || label.length > MAX_LABEL_LENGTH) continue
    const start = match.index ?? 0
    if (start > cursor) segments.push({ type: 'text', text: template.slice(cursor, start) })
    segments.push({ type: 'field', key: label.toLowerCase(), label, raw: match[0] })
    cursor = start + match[0].length
  }
  if (cursor < template.length) segments.push({ type: 'text', text: template.slice(cursor) })
  return segments
}

/** Distinct fields in order of first appearance, labelled as first written. */
export function listFields(template: string): CaptionField[] {
  const seen = new Map<string, CaptionField>()
  for (const segment of parseCaption(template)) {
    if (segment.type === 'field' && !seen.has(segment.key)) seen.set(segment.key, { key: segment.key, label: segment.label })
  }
  return [...seen.values()]
}

/** A field's answer, read from own properties only so a label like `{{constructor}}` never finds `Object`. */
export function answerFor(values: Record<string, string>, key: string): string {
  return Object.prototype.hasOwnProperty.call(values, key) ? values[key] ?? '' : ''
}

/** The caption as plain text: answers replace their fields, unanswered fields become `[Label]`. */
export function fillCaption(template: string, values: Record<string, string>): string {
  return parseCaption(template)
    .map((segment) => {
      if (segment.type === 'text') return segment.text
      const answer = answerFor(values, segment.key).trim()
      return answer || `[${segment.label}]`
    })
    .join('')
}

export function captionFieldError(template: string): string | null {
  return listFields(template).length > MAX_CAPTION_FIELDS
    ? `A caption can have at most ${MAX_CAPTION_FIELDS} fields.`
    : null
}
