export type CaptionSegment =
  | { type: 'text'; text: string }
  | { type: 'field'; key: string; label: string; optional: boolean; raw: string }

export type CaptionField = { key: string; label: string; optional: boolean }

export const MAX_CAPTION_FIELDS = 10
const MAX_LABEL_LENGTH = 40

/** A placeholder is `{{label}}`: no braces or line breaks inside. Length is checked after trimming. */
const PLACEHOLDER = /\{\{([^{}\n]{1,60})\}\}/g

/** Splits a caption into plain text and `{{label}}` fields. Invalid brackets stay in the text. */
export function parseCaption(template: string): CaptionSegment[] {
  const segments: CaptionSegment[] = []
  let cursor = 0
  for (const match of template.matchAll(PLACEHOLDER)) {
    // A trailing `?` marks the field optional and is not part of its label.
    const written = match[1].trim()
    const optional = written.endsWith('?')
    const label = (optional ? written.slice(0, -1) : written).trim().replace(/\s+/g, ' ')
    if (!label || label.length > MAX_LABEL_LENGTH) continue
    const start = match.index ?? 0
    if (start > cursor) segments.push({ type: 'text', text: template.slice(cursor, start) })
    segments.push({ type: 'field', key: label.toLowerCase(), label, optional, raw: match[0] })
    cursor = start + match[0].length
  }
  if (cursor < template.length) segments.push({ type: 'text', text: template.slice(cursor) })
  return segments
}

/** Distinct fields in order of first appearance, labelled as first written. A field is optional only if every occurrence is. */
export function listFields(template: string): CaptionField[] {
  const seen = new Map<string, CaptionField>()
  for (const segment of parseCaption(template)) {
    if (segment.type !== 'field') continue
    const known = seen.get(segment.key)
    if (!known) seen.set(segment.key, { key: segment.key, label: segment.label, optional: segment.optional })
    else if (!segment.optional) known.optional = false
  }
  return [...seen.values()]
}

/** A field's answer, read from own properties only so a label like `{{constructor}}` never finds `Object`. */
export function answerFor(values: Record<string, string>, key: string): string {
  return Object.prototype.hasOwnProperty.call(values, key) ? values[key] ?? '' : ''
}

/** Required fields the visitor has not answered yet. */
export function missingRequired(template: string, values: Record<string, string>): CaptionField[] {
  return listFields(template).filter((field) => !field.optional && !answerFor(values, field.key).trim())
}

/**
 * The caption as plain text: answers replace their fields, an unanswered required field becomes `[Label]`,
 * and an unanswered optional field disappears along with the spaces before it.
 */
export function fillCaption(template: string, values: Record<string, string>): string {
  let out = ''
  let trimNext = false
  for (const segment of parseCaption(template)) {
    if (segment.type === 'text') {
      out += trimNext ? segment.text.replace(/^[ \t]+/, '') : segment.text
      trimNext = false
      continue
    }
    const answer = answerFor(values, segment.key).trim()
    if (answer) out += answer
    else if (!segment.optional) out += `[${segment.label}]`
    else {
      out = out.replace(/[ \t]+$/, '')
      // Nothing left on this line to follow, so the next text should not start with an indent.
      trimNext = out === '' || out.endsWith('\n')
      continue
    }
    trimNext = false
  }
  return out
}

export function captionFieldError(template: string): string | null {
  return listFields(template).length > MAX_CAPTION_FIELDS
    ? `A caption can have at most ${MAX_CAPTION_FIELDS} fields.`
    : null
}
