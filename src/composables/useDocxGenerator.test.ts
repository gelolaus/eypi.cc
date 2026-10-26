// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchFormTemplate, parseNameCsv, uniqueFilenameStems } from './useDocxGenerator'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('parseNameCsv', () => {
  it('detects a header and reads comma-separated names', () => {
    const text = 'Name,Section\n"Dela, Cruz",BSCS\nMaria Santos,BSIT\n'

    expect(parseNameCsv(text)).toEqual(['Dela, Cruz', 'Maria Santos'])
  })

  it('detects a header and reads semicolon-separated names', () => {
    const text = 'Name;Section\nJuan Dela Cruz;BSCS\nMaria Santos;BSIT\n'

    expect(parseNameCsv(text)).toEqual(['Juan Dela Cruz', 'Maria Santos'])
  })

  it('keeps the first row when it is not a header', () => {
    const text = 'Juan Dela Cruz;BSCS\nMaria Santos;BSIT\n'

    expect(parseNameCsv(text)).toEqual(['Juan Dela Cruz', 'Maria Santos'])
  })
})

describe('uniqueFilenameStems', () => {
  it('turns Juan/Dela Cruz into Juan_Dela_Cruz', () => {
    expect(uniqueFilenameStems(['Juan/Dela Cruz'])).toEqual(['Juan_Dela_Cruz'])
  })

  it('suffixes a duplicate stem with -2', () => {
    expect(uniqueFilenameStems(['Juan/Dela Cruz', 'Juan/Dela Cruz'])).toEqual([
      'Juan_Dela_Cruz',
      'Juan_Dela_Cruz-2',
    ])
  })
})

describe('fetchFormTemplate', () => {
  it('reports template_missing when the template is not in storage', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      error: {
        code: 'template_missing',
        message: "This form's template is missing. Tell the eypi.cc admin.",
      },
    }), { status: 404, headers: { 'Content-Type': 'application/json' } })))

    await expect(fetchFormTemplate('waiver_form.docx')).rejects.toMatchObject({
      code: 'template_missing',
      message: "This form's template is missing. Tell the eypi.cc admin.",
    })
  })
})
