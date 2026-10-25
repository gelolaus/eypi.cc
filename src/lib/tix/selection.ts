export interface SelectionRow {
  id: string
  rawData: Record<string, string>
}

export interface SelectionMapping {
  emailCol: string
  clusterCol?: string | null
}

export interface SelectionCluster {
  value: string
  maxCount: number | null
  filters: Record<string, string[]>
}

export interface SelectAttendeesOptions {
  mapping: SelectionMapping
  clusters: SelectionCluster[]
  globalFilters: Record<string, string[]>
  guaranteed: string[]
  seed: string
  /** Cap used only when there are no clusters. Null selects every eligible row. */
  maxAttendees?: number | null
}

export interface SelectionResult {
  selected: SelectionRow[]
  byCluster: Record<string, number>
}

function emailKey(row: SelectionRow, emailCol: string): string {
  return (row.rawData[emailCol] ?? '').trim().toLowerCase()
}

function passesFilters(row: SelectionRow, filters: Record<string, string[]>): boolean {
  for (const [col, vals] of Object.entries(filters)) {
    if (vals.length > 0 && !vals.includes(row.rawData[col] ?? '')) return false
  }
  return true
}

function hashSeed(seed: string): number {
  let hash = 2166136261
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6D2B79F5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle<T>(items: readonly T[], seed: string): T[] {
  const rng = mulberry32(hashSeed(seed))
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const current = copy[i]
    copy[i] = copy[j] as T
    copy[j] = current as T
  }
  return copy
}

/** One row per lowercased email. A guaranteed duplicate replaces an earlier one. */
function dedupeByEmail(rows: readonly SelectionRow[], emailCol: string, guaranteed: ReadonlySet<string>): SelectionRow[] {
  const byEmail = new Map<string, SelectionRow>()
  const blank: SelectionRow[] = []
  const seenBlank = new Set<string>()
  for (const row of rows) {
    const email = emailKey(row, emailCol)
    if (!email) {
      if (seenBlank.has(row.id)) continue
      seenBlank.add(row.id)
      blank.push(row)
      continue
    }
    const existing = byEmail.get(email)
    if (!existing) {
      byEmail.set(email, row)
      continue
    }
    if (guaranteed.has(row.id) && !guaranteed.has(existing.id)) byEmail.set(email, row)
  }
  return [...byEmail.values(), ...blank]
}

function takeWithinQuota(
  guaranteedRows: readonly SelectionRow[],
  pool: readonly SelectionRow[],
  quota: number | null,
  seed: string,
): SelectionRow[] {
  const capped = quota == null ? [...guaranteedRows] : guaranteedRows.slice(0, Math.max(0, quota))
  const kept = new Set(capped.map((row) => row.id))
  const rafflePool = pool.filter((row) => !kept.has(row.id))
  const slots = quota == null ? rafflePool.length : Math.max(0, quota - capped.length)
  const winners = slots >= rafflePool.length ? [...rafflePool] : shuffle(rafflePool, seed).slice(0, slots)
  return [...capped, ...winners]
}

export function selectAttendees(rows: readonly SelectionRow[], opts: SelectAttendeesOptions): SelectionResult {
  const guaranteed = new Set(opts.guaranteed)
  const deduped = dedupeByEmail(rows, opts.mapping.emailCol, guaranteed)
  const byCluster: Record<string, number> = {}

  if (opts.clusters.length) {
    const clusterCol = opts.mapping.clusterCol
    const selected: SelectionRow[] = []
    const used = new Set<string>()
    for (const cluster of opts.clusters) {
      const inCluster = clusterCol
        ? deduped.filter((row) => (row.rawData[clusterCol] ?? '') === cluster.value)
        : deduped
      const guaranteedRows = inCluster.filter((row) => guaranteed.has(row.id))
      const pool = inCluster.filter((row) => !guaranteed.has(row.id) && passesFilters(row, cluster.filters ?? {}))
      const picked = takeWithinQuota(
        guaranteedRows,
        pool,
        cluster.maxCount ?? 0,
        `${opts.seed}\0${cluster.value}`,
      )
      const fresh = picked.filter((row) => !used.has(row.id))
      for (const row of fresh) used.add(row.id)
      selected.push(...fresh)
      byCluster[cluster.value] = fresh.length
    }
    return { selected, byCluster }
  }

  const guaranteedRows = deduped.filter((row) => guaranteed.has(row.id))
  const pool = deduped.filter((row) => !guaranteed.has(row.id) && passesFilters(row, opts.globalFilters ?? {}))
  const cap = opts.maxAttendees === undefined ? null : opts.maxAttendees
  return {
    selected: takeWithinQuota(guaranteedRows, pool, cap, opts.seed),
    byCluster,
  }
}
