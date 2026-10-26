const FORMULA_PREFIX = /^[=+\-@]/

function cell(value: string): string {
  const guarded = FORMULA_PREFIX.test(value) ? `'${value}` : value
  if (/[",\r\n]/.test(guarded)) {
    return `"${guarded.replace(/"/g, '""')}"`
  }
  return guarded
}

/** RFC 4180 CSV. Cells that start with `=`, `+`, `-`, or `@` are prefixed with `'`. */
export function toCsv(rows: string[][]): string {
  if (rows.length === 0) return ''
  return `${rows.map((row) => row.map(cell).join(',')).join('\r\n')}\r\n`
}
