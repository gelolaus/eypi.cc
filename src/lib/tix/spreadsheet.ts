import Papa from 'papaparse'

export const MAX_SPREADSHEET_ROWS = 5000

export interface ParsedAttendee {
  firstName: string
  lastName: string
  email: string
}

const FIRST_HEADERS = new Set(['firstname', 'first'])
const LAST_HEADERS = new Set(['lastname', 'last'])
const EMAIL_HEADERS = new Set(['email', 'emailaddress'])

function normHeader(header: string): string {
  return header.replace(/^\uFEFF/, '').trim().toLowerCase().replace(/[\s_"]/g, '')
}

export function acceptsSpreadsheetFile(name: string): boolean {
  return name.toLowerCase().endsWith('.xlsx')
}

export function parseAttendeeCsv(text: string): ParsedAttendee[] {
  const cleaned = text.replace(/^\uFEFF/, '')
  const parsed = Papa.parse<Record<string, string>>(cleaned, {
    header: true,
    skipEmptyLines: true,
  })
  const fields = parsed.meta.fields ?? []
  if (fields.length === 0 || parsed.data.length === 0) {
    throw new Error('CSV must have a header row and at least one data row.')
  }

  const firstKey = fields.find((header) => FIRST_HEADERS.has(normHeader(header)))
  const lastKey = fields.find((header) => LAST_HEADERS.has(normHeader(header)))
  const emailKey = fields.find((header) => EMAIL_HEADERS.has(normHeader(header)))
  if (!firstKey || !lastKey || !emailKey) {
    throw new Error('CSV must have first_name, last_name, and email columns.')
  }

  return parsed.data
    .map((row) => ({
      firstName: (row[firstKey] ?? '').trim(),
      lastName: (row[lastKey] ?? '').trim(),
      email: (row[emailKey] ?? '').trim(),
    }))
    .filter((attendee) => attendee.email)
}

function cellText(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object') {
    const record = value as { text?: unknown; result?: unknown; richText?: { text?: string }[] }
    if (Array.isArray(record.richText)) return record.richText.map((part) => part.text ?? '').join('')
    if (typeof record.text === 'string') return record.text
    if ('result' in record) return cellText(record.result)
  }
  return ''
}

function uniqueHeader(name: string, used: Map<string, number>): string {
  const seen = used.get(name) ?? 0
  used.set(name, seen + 1)
  return seen === 0 ? name : `${name} (${seen + 1})`
}

async function openWorkbook(data: ArrayBuffer): Promise<import('exceljs').Workbook> {
  const exceljs = await import('exceljs')
  const workbook = new exceljs.Workbook()
  await workbook.xlsx.load(new Uint8Array(data) as unknown as import('exceljs').Buffer)
  return workbook
}

export async function parseSpreadsheet(data: ArrayBuffer): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  const workbook = await openWorkbook(data)
  const sheet = workbook.worksheets[0]
  if (!sheet || sheet.rowCount < 2) {
    throw new Error('File must have a header row and at least one data row.')
  }

  let maxColumn = 0
  sheet.eachRow((row) => {
    row.eachCell({ includeEmpty: false }, (_cell, col) => {
      if (col > maxColumn) maxColumn = col
    })
  })

  const headerRow = sheet.getRow(1)
  const used = new Map<string, number>()
  const columns: { index: number; name: string }[] = []
  for (let col = 1; col <= maxColumn; col++) {
    const name = cellText(headerRow.getCell(col).value).trim()
    if (!name) continue
    columns.push({ index: col, name: uniqueHeader(name, used) })
  }
  if (!columns.length) throw new Error('File must have a header row and at least one data row.')

  const rows: Record<string, string>[] = []
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    const record: Record<string, string> = {}
    let filled = false
    for (const column of columns) {
      const value = cellText(row.getCell(column.index).value).trim()
      record[column.name] = value
      if (value) filled = true
    }
    if (filled) rows.push(record)
  })

  return { headers: columns.map((column) => column.name), rows }
}
