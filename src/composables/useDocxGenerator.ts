import {
  LETTER_ENTRY_SUFFIX,
  MAX_WALK_IN_COUNT,
  TEMPLATE_MISSING_CODE,
  TEMPLATE_MISSING_MESSAGE,
} from '@shared/formsCatalog'
import { api } from '@/lib/api'
import Docxtemplater from 'docxtemplater'
import { saveAs } from 'file-saver'
import Papa from 'papaparse'
import PizZip from 'pizzip'
import { ref } from 'vue'

const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const TEMPLATE_TAG_MESSAGE = "This form's template has a broken tag. Tell the eypi.cc admin."

const HEADER_CELLS = new Set([
  'name',
  'names',
  'student',
  'students',
  'studentname',
  'fullname',
  'visitor',
  'visitors',
  'visitorname',
])

export class DocxGeneratorError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'DocxGeneratorError'
    this.code = code
  }
}

function headerKey(value: string): string {
  return value.replace(/^\uFEFF/, '').trim().toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function parseNameCsv(text: string): string[] {
  const parsed = Papa.parse<string[]>(text.replace(/^\uFEFF/, ''), {
    skipEmptyLines: true,
  })
  const names = parsed.data
    .map((row) => (Array.isArray(row) ? String(row[0] ?? '').trim() : ''))
    .filter((name) => name.length > 0)
  if (names.length === 0) return []
  if (HEADER_CELLS.has(headerKey(names[0] ?? ''))) return names.slice(1)
  return names
}

export function sanitizeFilenameStem(name: string): string {
  return name
    .trim()
    .replace(/[\\/]+/g, ' ')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export function uniqueFilenameStems(names: string[]): string[] {
  const seen = new Map<string, number>()
  return names.map((name) => {
    const base = sanitizeFilenameStem(name) || 'document'
    const count = seen.get(base) ?? 0
    seen.set(base, count + 1)
    return count === 0 ? base : `${base}-${count + 1}`
  })
}

export function concessionaireZipName(company: string): string {
  const stem = sanitizeFilenameStem(company)
  return stem ? `${stem}_Documents.zip` : 'Concessionaire_Documents.zip'
}

export function letterEntryName(stem: string): string {
  return `${stem}${LETTER_ENTRY_SUFFIX}`
}

export function requiredError(value: string, label: string): string | null {
  if (value.trim()) return null
  return `${label} is required.`
}

export function walkInCountError(value: unknown): string | null {
  if (value == null || value === '') return null
  const count = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(count) || !Number.isInteger(count) || count < 0) {
    return 'Enter a whole number of walk-in slots.'
  }
  if (count > MAX_WALK_IN_COUNT) {
    return `Walk-in slots cannot be more than ${MAX_WALK_IN_COUNT}.`
  }
  return null
}

const templateCache = new Map<string, { etag: string; bytes: ArrayBuffer }>()

export async function fetchFormTemplate(filename: string): Promise<ArrayBuffer> {
  const cached = templateCache.get(filename)
  const headers = new Headers()
  if (cached) headers.set('If-None-Match', cached.etag)
  const res = await api.raw(`/api/forms/templates/${encodeURIComponent(filename)}`, { headers })
  if (res.status === 304 && cached) return cached.bytes.slice(0)
  if (!res.ok) {
    let code = 'http_error'
    let message = 'Something went wrong.'
    try {
      const data = await res.json() as { error?: { code?: unknown; message?: unknown } }
      if (typeof data.error?.code === 'string') code = data.error.code
      if (typeof data.error?.message === 'string') message = data.error.message
    } catch {
      // Non-JSON bodies keep the generic code and message.
    }
    if (code === TEMPLATE_MISSING_CODE && message === 'Something went wrong.') {
      message = TEMPLATE_MISSING_MESSAGE
    }
    throw new DocxGeneratorError(code, message)
  }
  const bytes = await res.arrayBuffer()
  const etag = res.headers.get('ETag')
  const stored = bytes.slice(0)
  if (etag) templateCache.set(filename, { etag, bytes: stored })
  return stored.slice(0)
}

export function renderDocx(template: ArrayBuffer, data: Record<string, unknown>): Uint8Array {
  try {
    const zip = new PizZip(template.slice(0))
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    })
    doc.render(data)
    return doc.getZip().generate({ type: 'uint8array' }) as Uint8Array
  } catch (err) {
    if (err instanceof DocxGeneratorError) throw err
    throw new DocxGeneratorError('template_tag', TEMPLATE_TAG_MESSAGE)
  }
}

export function docxBlob(bytes: Uint8Array): Blob {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return new Blob([copy], { type: DOCX_TYPE })
}

export function zipBlob(entries: { name: string; data: Uint8Array }[]): Blob {
  const zip = new PizZip()
  for (const entry of entries) zip.file(entry.name, entry.data)
  return zip.generate({ type: 'blob' }) as Blob
}

export function saveBlob(blob: Blob, filename: string): void {
  saveAs(blob, filename)
}

export function generatorErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof DocxGeneratorError) return err.message
  return fallback
}

export function useDocxGenerator() {
  const isGenerating = ref(false)

  async function run(task: () => Promise<void>): Promise<void> {
    isGenerating.value = true
    try {
      await task()
    } finally {
      isGenerating.value = false
    }
  }

  return { isGenerating, run }
}
