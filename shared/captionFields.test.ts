import { describe, expect, it } from 'vitest'
import { answerFor, captionFieldError, fillCaption, listFields, parseCaption } from './captionFields'

describe('parseCaption', () => {
  it('parses text and fields in order', () => {
    expect(parseCaption('Hi, I am {{Name}} of {{Committee Name}}!')).toEqual([
      { type: 'text', text: 'Hi, I am ' },
      { type: 'field', key: 'name', label: 'Name', raw: '{{Name}}' },
      { type: 'text', text: ' of ' },
      { type: 'field', key: 'committee name', label: 'Committee Name', raw: '{{Committee Name}}' },
      { type: 'text', text: '!' },
    ])
  })

  it('trims labels and collapses spaces in the key', () => {
    const [field] = parseCaption('{{  Full   Name }}')
    expect(field).toMatchObject({ type: 'field', label: 'Full Name', key: 'full name' })
  })

  it('leaves invalid brackets as text', () => {
    const invalid = ['{{}}', '{{ }}', '{{open', 'close}}', '{{a{b}}', `{{${'x'.repeat(41)}}}`, '{{two\nlines}}']
    for (const input of invalid) expect(parseCaption(input), input).toEqual([{ type: 'text', text: input }])
  })

  it('returns no segments for an empty template', () => {
    expect(parseCaption('')).toEqual([])
  })
})

describe('listFields', () => {
  it('treats repeated labels as one field', () => {
    expect(listFields('{{Name}} and {{ name }}')).toEqual([{ key: 'name', label: 'Name' }])
  })
})

describe('fillCaption', () => {
  it('fills answers and marks missing ones', () => {
    expect(fillCaption('Hi {{Name}} of {{Group}}', { name: ' Ana ' })).toBe('Hi Ana of [Group]')
  })

  it('fills every occurrence of a key', () => {
    expect(fillCaption('{{Name}}/{{name}}', { name: 'Ana' })).toBe('Ana/Ana')
  })

  it('does not reparse an answer', () => {
    expect(fillCaption('{{Name}}', { name: '{{Other}}' })).toBe('{{Other}}')
  })

  it('returns an empty string for an empty template', () => {
    expect(fillCaption('', {})).toBe('')
  })
})

describe('inherited object properties', () => {
  it('are never read as answers', () => {
    expect(answerFor({}, 'constructor')).toBe('')
    expect(answerFor({}, '__proto__')).toBe('')
    expect(answerFor({ name: 'Ana' }, 'name')).toBe('Ana')
    expect(fillCaption('{{Constructor}} {{__proto__}} {{toString}}', {})).toBe('[Constructor] [__proto__] [toString]')
  })
})

describe('captionFieldError', () => {
  const fields = (n: number) => Array.from({ length: n }, (_, i) => `{{f${i + 1}}}`).join(' ')

  it('allows 10 distinct fields', () => {
    expect(captionFieldError(fields(10))).toBeNull()
  })

  it('rejects 11 distinct fields', () => {
    expect(captionFieldError(fields(11))).toBe('A caption can have at most 10 fields.')
  })

  it('counts distinct keys, not placeholders', () => {
    expect(captionFieldError(`${fields(10)} {{F1}}`)).toBeNull()
  })
})
