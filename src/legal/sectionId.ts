function slug(heading: string): string {
  const base = heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return base || 's-'
}

/** Unique, URL-safe ids for a list of section headings, in order. */
export function sectionIds(headings: string[]): string[] {
  const seen = new Map<string, number>()
  return headings.map((heading) => {
    const base = slug(heading)
    const count = (seen.get(base) ?? 0) + 1
    seen.set(base, count)
    return count === 1 ? base : `${base}-${count}`
  })
}
