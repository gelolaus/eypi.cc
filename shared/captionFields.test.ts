import { describe, expect, it } from 'vitest'
import { answerFor, captionFieldError, fillCaption, listFields, missingRequired, parseCaption } from './captionFields'

describe('parseCaption', () => {
  it('parses text and fields in order', () => {
    expect(parseCaption('Hi, I am {{Name}} of {{Committee Name}}!')).toEqual([
      { type: 'text', text: 'Hi, I am ' },
      { type: 'field', key: 'name', label: 'Name', optional: false, raw: '{{Name}}' },
      { type: 'text', text: ' of ' },
      { type: 'field', key: 'committee name', label: 'Committee Name', optional: false, raw: '{{Committee Name}}' },
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
    expect(listFields('{{Name}} and {{ name }}')).toEqual([{ key: 'name', label: 'Name', optional: false }])
  })
})

describe('optional fields', () => {
  it('reads a trailing ? as optional and keeps it out of the label and key', () => {
    expect(parseCaption('{{Nickname?}}')).toEqual([
      { type: 'field', key: 'nickname', label: 'Nickname', optional: true, raw: '{{Nickname?}}' },
    ])
    expect(parseCaption('{{ Nick name ? }}')[0]).toMatchObject({ label: 'Nick name', key: 'nick name', optional: true })
  })

  it('treats a ? anywhere else as part of the label', () => {
    expect(parseCaption('{{What? now}}')[0]).toMatchObject({ label: 'What? now', optional: false })
    expect(parseCaption("{{What's up?}}")[0]).toMatchObject({ label: "What's up", optional: true })
  })

  it('does not treat a lone ? as a field', () => {
    expect(parseCaption('{{?}} {{ ? }}')).toEqual([{ type: 'text', text: '{{?}} {{ ? }}' }])
  })

  it('makes a label required when any occurrence is required', () => {
    expect(listFields('{{Name?}} {{name}}')).toEqual([{ key: 'name', label: 'Name', optional: false }])
    expect(listFields('{{Name}} {{name?}}')).toEqual([{ key: 'name', label: 'Name', optional: false }])
    expect(listFields('{{Name?}} {{name?}}')).toEqual([{ key: 'name', label: 'Name', optional: true }])
  })

  it('lists the required fields still empty', () => {
    const template = '{{Name}} {{Group}} {{Nickname?}} {{Team}}'
    expect(missingRequired(template, { name: 'Ana', team: '   ' }).map((f) => f.label)).toEqual(['Group', 'Team'])
    expect(missingRequired('{{Nickname?}}', {})).toEqual([])
  })

  it('drops an empty optional field with one space before it', () => {
    expect(fillCaption('I am {{Name}} {{Nickname?}} from APC', { name: 'Ana' })).toBe('I am Ana from APC')
    expect(fillCaption('Hi {{Nickname?}}, bye', {})).toBe('Hi, bye')
    expect(fillCaption('Hi {{Name}} {{Nickname?}}', { name: 'Ana' })).toBe('Hi Ana')
  })

  it('drops an optional field at the start of the caption or a line without leaving indents', () => {
    expect(fillCaption('{{Nickname?}} hello', {})).toBe('hello')
    expect(fillCaption('line one\n{{Nickname?}} line two', {})).toBe('line one\nline two')
  })

  it('fills an optional field that was answered and still marks a missing required one', () => {
    expect(fillCaption('{{Name}} {{Nickname?}}', { name: 'Ana', nickname: 'A' })).toBe('Ana A')
    expect(fillCaption('{{Name}} {{Nickname?}}', {})).toBe('[Name]')
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
