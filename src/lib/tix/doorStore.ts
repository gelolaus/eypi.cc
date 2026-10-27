/**
 * Offline store for door mode. One IndexedDB database per event holds the downloaded roster
 * (names and QR tokens) and the queue of check-ins that have not reached the server yet.
 * The roster is personal data: it lives only on the door device, is removed with the
 * "Clear offline data" button, and is wiped whenever the session resets (see doorCleanup.ts).
 *
 * State is mirrored in memory so a scan answers instantly; every change is also written to
 * IndexedDB straight away. `flush()` resolves once those writes have landed.
 */

import { DOOR_SLUGS_KEY } from '@/lib/tix/doorStoreKeys'

export type DoorAction = 'checked_in' | 'checked_out'
export type ScanOutcome = 'ok' | 'already' | 'unknown' | 'not_confirmed'

export interface RosterRow {
  id: string
  qrToken: string
  firstName: string
  lastName: string
  status: string
  checkedIn: boolean
}

export interface QueuedCheckIn {
  id: string
  attendeeId: string
  action: DoorAction
  at: string
}

export interface ScanReturn {
  result: ScanOutcome
  attendee?: { firstName: string; lastName: string }
}

export interface SyncResult {
  id: string
  ok: boolean
  code?: string
}

export interface DoorConflict {
  id: string
  attendeeId: string
  name: string
  code: string
  message: string
}

export interface DoorStore {
  loadRoster(rows: RosterRow[], generatedAt?: string): void
  hasRoster(): boolean
  generatedAt(): string | null
  scan(qrToken: string, now: Date): ScanReturn
  checkInAttendee(attendeeId: string, now: Date): ScanReturn
  search(query: string, limit?: number): RosterRow[]
  counts(): { confirmed: number; checkedIn: number }
  pending(): Promise<QueuedCheckIn[]>
  pendingCount(): number
  markSynced(ids: string[]): void
  applyServerResults(results: SyncResult[]): DoorConflict[]
  conflicts(): DoorConflict[]
  dismissConflicts(): void
  flush(): Promise<void>
  clear(): Promise<void>
  close(): void
}

export const DUPLICATE_SCAN_MS = 5000
export const DOOR_DB_PREFIX = 'eypi-door:'

export function conflictMessage(code: string): string {
  switch (code) {
    case 'already_checked_in': return 'Already checked in on another device'
    case 'not_checked_in': return 'Was not checked in on the server'
    case 'not_confirmed': return 'No longer confirmed for this event'
    default: return 'Not on the guest list'
  }
}

const ROSTER = 'roster'
const QUEUE = 'queue'
const META = 'meta'

function dbName(slug: string): string {
  return `${DOOR_DB_PREFIX}${slug}`
}

function wrap<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

function openDatabase(slug: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName(slug), 1)
    request.onupgradeneeded = () => {
      const db = request.result
      db.createObjectStore(ROSTER, { keyPath: 'id' })
      db.createObjectStore(QUEUE, { keyPath: 'id' })
      db.createObjectStore(META, { keyPath: 'key' })
    }
    request.onsuccess = () => {
      // A delete from another tab or the cleanup must not wait on this connection.
      request.result.onversionchange = () => request.result.close()
      resolve(request.result)
    }
    request.onerror = () => reject(request.error)
  })
}

function rememberSlug(slug: string): void {
  try {
    const list = new Set<string>(JSON.parse(localStorage.getItem(DOOR_SLUGS_KEY) ?? '[]') as string[])
    list.add(slug)
    localStorage.setItem(DOOR_SLUGS_KEY, JSON.stringify([...list]))
  } catch { /* the registry is only a fallback for browsers without indexedDB.databases() */ }
}

function forgetSlug(slug: string): void {
  try {
    const list = (JSON.parse(localStorage.getItem(DOOR_SLUGS_KEY) ?? '[]') as string[]).filter((s) => s !== slug)
    if (list.length) localStorage.setItem(DOOR_SLUGS_KEY, JSON.stringify(list))
    else localStorage.removeItem(DOOR_SLUGS_KEY)
  } catch { /* nothing to forget */ }
}

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(name)
    request.onsuccess = () => resolve()
    request.onerror = () => resolve()
    request.onblocked = () => resolve()
  })
}

/** Removes one event's offline data without opening it. */
export async function deleteDoorStore(slug: string): Promise<void> {
  if (typeof indexedDB === 'undefined') return
  await deleteDatabase(dbName(slug))
  forgetSlug(slug)
}

async function hasQueuedItems(name: string): Promise<boolean> {
  try {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(name)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    try {
      if (!db.objectStoreNames.contains(QUEUE)) return false
      return (await wrap(db.transaction(QUEUE).objectStore(QUEUE).count())) > 0
    } finally {
      db.close()
    }
  } catch {
    return false
  }
}

/**
 * Removes every event's offline data (sign-out, account switch). With `keepUnsynced`, a store that still
 * holds check-ins the server has not seen survives, so a session that expired mid-event does not lose them;
 * the next person to sign in on this device wipes it for good.
 */
export async function deleteAllDoorStores(options: { keepUnsynced?: boolean } = {}): Promise<void> {
  if (typeof indexedDB === 'undefined') return
  const names = new Set<string>()
  try {
    for (const info of (await indexedDB.databases?.()) ?? []) {
      if (info.name?.startsWith(DOOR_DB_PREFIX)) names.add(info.name)
    }
  } catch { /* fall back to the registry */ }
  try {
    for (const slug of JSON.parse(localStorage.getItem(DOOR_SLUGS_KEY) ?? '[]') as string[]) names.add(dbName(slug))
  } catch { /* no registry */ }
  const kept: string[] = []
  await Promise.all([...names].map(async (name) => {
    if (options.keepUnsynced && await hasQueuedItems(name)) { kept.push(name.slice(DOOR_DB_PREFIX.length)); return }
    await deleteDatabase(name)
  }))
  try {
    if (kept.length) localStorage.setItem(DOOR_SLUGS_KEY, JSON.stringify(kept))
    else localStorage.removeItem(DOOR_SLUGS_KEY)
  } catch { /* nothing to update */ }
}

export async function openDoorStore(slug: string): Promise<DoorStore> {
  const db = await openDatabase(slug)
  rememberSlug(slug)

  const rows = new Map<string, RosterRow>()
  const byToken = new Map<string, string>()
  let queue: QueuedCheckIn[] = []
  let conflictList: DoorConflict[] = []
  let loadedAt: string | null = null
  let chain: Promise<unknown> = Promise.resolve()
  const recent = new Map<string, { at: number; out: ScanReturn }>()

  const [storedRows, storedQueue, storedMeta] = await Promise.all([
    wrap(db.transaction(ROSTER).objectStore(ROSTER).getAll() as IDBRequest<RosterRow[]>),
    wrap(db.transaction(QUEUE).objectStore(QUEUE).getAll() as IDBRequest<QueuedCheckIn[]>),
    wrap(db.transaction(META).objectStore(META).getAll() as IDBRequest<{ key: string; value: unknown }[]>),
  ])
  for (const row of storedRows) { rows.set(row.id, row); byToken.set(row.qrToken, row.id) }
  queue = storedQueue.sort((a, b) => a.at.localeCompare(b.at))
  for (const meta of storedMeta) {
    if (meta.key === 'generatedAt') loadedAt = meta.value as string
    if (meta.key === 'conflicts') conflictList = meta.value as DoorConflict[]
  }

  function persist(work: (tx: IDBTransaction) => void, stores: string[]): void {
    chain = chain.then(() => {
      const tx = db.transaction(stores, 'readwrite')
      work(tx)
      return done(tx)
    }).catch(() => { /* a failed write keeps the in-memory state; the next write retries nothing */ })
  }

  function saveMeta(): void {
    persist((tx) => {
      tx.objectStore(META).put({ key: 'conflicts', value: conflictList })
      tx.objectStore(META).put({ key: 'generatedAt', value: loadedAt })
    }, [META])
  }

  function checkInRow(row: RosterRow, now: Date): ScanReturn {
    const attendee = { firstName: row.firstName, lastName: row.lastName }
    if (row.status !== 'confirmed') return { result: 'not_confirmed', attendee }
    if (row.checkedIn) return { result: 'already', attendee }
    row.checkedIn = true
    const item: QueuedCheckIn = { id: crypto.randomUUID(), attendeeId: row.id, action: 'checked_in', at: now.toISOString() }
    queue.push(item)
    persist((tx) => {
      tx.objectStore(ROSTER).put({ ...row })
      tx.objectStore(QUEUE).put(item)
    }, [ROSTER, QUEUE])
    return { result: 'ok', attendee }
  }

  function removeFromQueue(ids: string[]): void {
    const gone = new Set(ids)
    queue = queue.filter((item) => !gone.has(item.id))
    persist((tx) => { for (const id of gone) tx.objectStore(QUEUE).delete(id) }, [QUEUE])
  }

  return {
    loadRoster(next, generatedAt) {
      rows.clear()
      byToken.clear()
      const waiting = new Set(queue.filter((q) => q.action === 'checked_in').map((q) => q.attendeeId))
      for (const row of next) {
        // A check-in made here that the server has not seen yet still counts.
        const merged = { ...row, checkedIn: row.checkedIn || waiting.has(row.id) }
        rows.set(merged.id, merged)
        byToken.set(merged.qrToken, merged.id)
      }
      loadedAt = generatedAt ?? new Date().toISOString()
      const snapshot = [...rows.values()].map((r) => ({ ...r }))
      persist((tx) => {
        const store = tx.objectStore(ROSTER)
        store.clear()
        for (const row of snapshot) store.put(row)
        tx.objectStore(META).put({ key: 'generatedAt', value: loadedAt })
      }, [ROSTER, META])
    },
    hasRoster: () => rows.size > 0,
    generatedAt: () => loadedAt,

    scan(qrToken, now) {
      const token = qrToken.trim()
      const seen = recent.get(token)
      if (seen && now.getTime() - seen.at < DUPLICATE_SCAN_MS) return seen.out
      const id = byToken.get(token)
      const row = id ? rows.get(id) : undefined
      const out: ScanReturn = row ? checkInRow(row, now) : { result: 'unknown' }
      recent.set(token, { at: now.getTime(), out })
      return out
    },
    checkInAttendee(attendeeId, now) {
      const row = rows.get(attendeeId)
      return row ? checkInRow(row, now) : { result: 'unknown' }
    },
    search(query, limit = 8) {
      const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
      if (!words.length) return []
      const hits: RosterRow[] = []
      for (const row of rows.values()) {
        const name = `${row.firstName} ${row.lastName}`.toLowerCase()
        if (words.every((w) => name.includes(w))) hits.push({ ...row })
        if (hits.length >= limit) break
      }
      return hits
    },
    counts() {
      let checkedIn = 0
      for (const row of rows.values()) if (row.checkedIn) checkedIn += 1
      return { confirmed: rows.size, checkedIn }
    },

    async pending() {
      await chain
      return queue.map((item) => ({ ...item }))
    },
    pendingCount: () => queue.length,
    markSynced(ids) {
      removeFromQueue(ids)
    },
    applyServerResults(results) {
      const added: DoorConflict[] = []
      for (const result of results) {
        const item = queue.find((q) => q.id === result.id)
        if (!item) continue
        if (result.ok) continue
        const row = rows.get(item.attendeeId)
        const code = result.code ?? 'unknown'
        added.push({
          id: item.id,
          attendeeId: item.attendeeId,
          name: row ? `${row.firstName} ${row.lastName}`.trim() : 'Unknown guest',
          code,
          message: conflictMessage(code),
        })
        // On the server they are in already; for anything else this device was wrong.
        if (row && code !== 'already_checked_in') {
          row.checkedIn = false
          persist((tx) => { tx.objectStore(ROSTER).put({ ...row }) }, [ROSTER])
        }
      }
      removeFromQueue(results.filter((r) => queue.some((q) => q.id === r.id)).map((r) => r.id))
      if (added.length) {
        conflictList = [...conflictList, ...added]
        saveMeta()
      }
      return added
    },
    conflicts: () => conflictList.map((c) => ({ ...c })),
    dismissConflicts() {
      conflictList = []
      saveMeta()
    },

    async flush() {
      await chain
    },
    async clear() {
      rows.clear(); byToken.clear(); queue = []; conflictList = []; loadedAt = null; recent.clear()
      await chain
      db.close()
      await deleteDoorStore(slug)
    },
    close() {
      db.close()
    },
  }
}
