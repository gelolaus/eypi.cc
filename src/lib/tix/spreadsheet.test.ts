import JSZip from 'jszip'
import { beforeAll, describe, expect, it } from 'vitest'
import { acceptsSpreadsheetFile, parseAttendeeCsv, parseSpreadsheet } from './spreadsheet'

async function xlsxBuffer(sheetXml: string): Promise<ArrayBuffer> {
  const zip = new JSZip()
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`)
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`)
  zip.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Respondents" sheetId="1" r:id="rId1"/></sheets>
</workbook>`)
  zip.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`)
  zip.file('xl/worksheets/sheet1.xml', sheetXml)
  return zip.generateAsync({ type: 'arraybuffer' })
}

describe('parseAttendeeCsv', () => {
  it('a BOM CSV parses headers', () => {
    const text = '\uFEFFfirst_name,last_name,email\nAna,Santos,ana@x.com\n'

    expect(parseAttendeeCsv(text)).toEqual([
      { firstName: 'Ana', lastName: 'Santos', email: 'ana@x.com' },
    ])
  })

  it('quoted commas and newlines parse', () => {
    const text = 'first_name,last_name,email\n"Dela, Cruz","Santos\nJr",ana@x.com\n'

    expect(parseAttendeeCsv(text)).toEqual([
      { firstName: 'Dela, Cruz', lastName: 'Santos\nJr', email: 'ana@x.com' },
    ])
  })
})

describe('parseSpreadsheet', () => {
  // exceljs is imported lazily; load it once up front so no single test pays the cold start.
  beforeAll(async () => {
    await import('exceljs')
  })

  it('a blank header column keeps later columns aligned', async () => {
    const buffer = await xlsxBuffer(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1">
      <c r="A1" t="inlineStr"><is><t>email</t></is></c>
      <c r="C1" t="inlineStr"><is><t>first_name</t></is></c>
    </row>
    <row r="2">
      <c r="A2" t="inlineStr"><is><t>a@x.com</t></is></c>
      <c r="B2" t="inlineStr"><is><t>ignore</t></is></c>
      <c r="C2" t="inlineStr"><is><t>Ana</t></is></c>
    </row>
  </sheetData>
</worksheet>`)

    const table = await parseSpreadsheet(buffer)

    expect(table.rows[0]).toMatchObject({ email: 'a@x.com', first_name: 'Ana' })
    expect(table.rows[0]?.first_name).not.toBe('ignore')
  })

  it('.XLSX is accepted', () => {
    expect(acceptsSpreadsheetFile('respondents.XLSX')).toBe(true)
  })
})
