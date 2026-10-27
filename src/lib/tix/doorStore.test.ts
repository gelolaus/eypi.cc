// @vitest-environment happy-dom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { deleteAllDoorStores, openDoorStore, type RosterRow } from './doorStore'

const ana: RosterRow = { id: 'a1', qrToken: 'tok-ana', firstName: 'Ana', lastName: 'Reyes', status: 'confirmed', checkedIn: false }
const ben: RosterRow = { id: 'b2', qrToken: 'tok-ben', firstName: 'Ben', lastName: 'Cruz', status: 'confirmed', checkedIn: true }
const t0 = new Date('2026-11-01T10:00:00Z')
const after = (s: number) => new Date(t0.getTime() + s * 1000)

beforeEach(async () => {
  await deleteAllDoorStores()
})

describe('doorStore', () => {
  it('answers unknown for a token that is not on the roster', async () => {
    const store = await openDoorStore('launch')
    store.loadRoster([ana])
    expect(store.scan('nope', t0)).toEqual({ result: 'unknown' })
    expect(await store.pending()).toEqual([])
  })

  it('checks in, queues one item and reports already for people checked in earlier', async () => {
    const store = await openDoorStore('launch')
    store.loadRoster([ana, ben])
    expect(store.scan('tok-ana', t0)).toEqual({ result: 'ok', attendee: { firstName: 'Ana', lastName: 'Reyes' } })
    expect(store.scan('tok-ben', t0).result).toBe('already')
    const queued = await store.pending()
    expect(queued).toHaveLength(1)
    expect(queued[0]).toMatchObject({ attendeeId: 'a1', action: 'checked_in', at: t0.toISOString() })
    expect(queued[0].id).toMatch(/^[0-9a-f-]{36}$/)
    expect(store.counts()).toEqual({ confirmed: 2, checkedIn: 2 })
  })

  it('ignores the same token scanned again within 5 seconds', async () => {
    const store = await openDoorStore('launch')
    store.loadRoster([ana])
    const first = store.scan('tok-ana', t0)
    expect(store.scan('tok-ana', after(3))).toEqual(first)
    expect(await store.pending()).toHaveLength(1)
    expect(store.scan('tok-ana', after(6)).result).toBe('already')
    expect(await store.pending()).toHaveLength(1)
  })

  it('does not check in someone who is not confirmed', async () => {
    const store = await openDoorStore('launch')
    store.loadRoster([{ ...ana, status: 'cancelled' }])
    expect(store.scan('tok-ana', t0).result).toBe('not_confirmed')
    expect(await store.pending()).toEqual([])
  })

  it('keeps the queue and roster across reopening', async () => {
    const first = await openDoorStore('launch')
    first.loadRoster([ana])
    first.scan('tok-ana', t0)
    await first.flush()
    first.close()
    const again = await openDoorStore('launch')
    expect(again.hasRoster()).toBe(true)
    expect(await again.pending()).toHaveLength(1)
    expect(again.scan('tok-ana', after(10)).result).toBe('already')
  })

  it('keeps events apart', async () => {
    const one = await openDoorStore('one')
    one.loadRoster([ana])
    one.scan('tok-ana', t0)
    await one.flush()
    const two = await openDoorStore('two')
    expect(two.hasRoster()).toBe(false)
    expect(await two.pending()).toEqual([])
  })

  it('keeps local check-ins when a fresh roster arrives before they sync', async () => {
    const store = await openDoorStore('launch')
    store.loadRoster([ana])
    store.scan('tok-ana', t0)
    store.loadRoster([ana])
    expect(store.scan('tok-ana', after(10)).result).toBe('already')
  })

  it('markSynced removes items and ok results are synced silently', async () => {
    const store = await openDoorStore('launch')
    store.loadRoster([ana])
    store.scan('tok-ana', t0)
    const [item] = await store.pending()
    expect(store.applyServerResults([{ id: item.id, ok: true }])).toEqual([])
    expect(await store.pending()).toEqual([])
    store.markSynced([item.id])
    expect(store.conflicts()).toEqual([])
  })

  it('surfaces conflicts from the server and drops them from the queue', async () => {
    const store = await openDoorStore('launch')
    store.loadRoster([ana, { ...ben, id: 'c3', qrToken: 'tok-c', checkedIn: false }])
    store.scan('tok-ana', t0)
    store.scan('tok-c', t0)
    const items = await store.pending()
    const conflicts = store.applyServerResults([
      { id: items[0].id, ok: false, code: 'already_checked_in' },
      { id: items[1].id, ok: false, code: 'not_confirmed' },
    ])
    expect(conflicts.map((c) => c.message)).toEqual([
      'Already checked in on another device',
      'No longer confirmed for this event',
    ])
    expect(await store.pending()).toEqual([])
    expect(store.counts().checkedIn).toBe(1)
    store.dismissConflicts()
    expect(store.conflicts()).toEqual([])
  })

  it('searches by name and checks in by id', async () => {
    const store = await openDoorStore('launch')
    store.loadRoster([ana, ben])
    expect(store.search('rey').map((r) => r.id)).toEqual(['a1'])
    expect(store.search('')).toEqual([])
    expect(store.checkInAttendee('a1', t0).result).toBe('ok')
    expect(store.checkInAttendee('zzz', t0).result).toBe('unknown')
  })

  it('clear removes the database', async () => {
    const store = await openDoorStore('launch')
    store.loadRoster([ana])
    await store.clear()
    const fresh = await openDoorStore('launch')
    expect(fresh.hasRoster()).toBe(false)
  })

  it('deleteAllDoorStores can spare stores with unsynced check-ins', async () => {
    const a = await openDoorStore('one')
    a.loadRoster([ana]); a.scan('tok-ana', t0); await a.flush(); a.close()
    const b = await openDoorStore('two')
    b.loadRoster([ana]); await b.flush(); b.close()
    await deleteAllDoorStores({ keepUnsynced: true })
    expect((await openDoorStore('one')).hasRoster()).toBe(true)
    expect((await openDoorStore('two')).hasRoster()).toBe(false)
    await deleteAllDoorStores()
    expect((await openDoorStore('one')).hasRoster()).toBe(false)
  })
})
