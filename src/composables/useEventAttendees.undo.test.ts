// @vitest-environment happy-dom
import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useEventAttendees, type AttendeeRow } from '@/composables/useEventAttendees'
import { useToast } from '@/composables/useToast'

const row = (id: string): AttendeeRow => ({
  id, first_name: id, last_name: 'X', email: `${id}@x.test`, status: 'not_checked_in',
  actioned_at: null, cluster_value: null, qr_token: id,
})

let posts: Array<{ path: string; org: string | null; body: string }>

beforeEach(() => {
  localStorage.setItem('active_org_id', 'org-1')
  posts = []
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === 'POST') {
      posts.push({ path: new URL(String(input), 'http://x').pathname, org: new Headers(init.headers).get('X-Active-Org-Id'), body: String(init.body) })
      return new Response(JSON.stringify({ message: 'ok' }), { status: 200 })
    }
    return new Response(JSON.stringify({ attendees: [row('a'), row('b')] }), { status: 200 })
  }))
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
})

afterEach(() => {
  window.dispatchEvent(new Event('pagehide'))
  useToast().toasts.value = []
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('removeAttendee undo', () => {
  it('marks the row removed, sends once after 5 s to the original org', async () => {
    const a = useEventAttendees('summit')
    a.attendees.value = [row('a'), row('b')]
    a.removeAttendee('a')
    expect(a.attendees.value[0].status).toBe('removed')
    localStorage.setItem('active_org_id', 'org-2')
    await vi.advanceTimersByTimeAsync(5_000)
    expect(posts).toEqual([{ path: '/api/events/summit/remove', org: 'org-1', body: JSON.stringify({ attendeeId: 'a' }) }])
  })

  it('reverts by id even when a refetch replaced the row objects, and undoing one leaves the other', async () => {
    const a = useEventAttendees('summit')
    a.attendees.value = [row('a'), row('b')]
    a.removeAttendee('a')
    a.removeAttendee('b')
    a.attendees.value = [{ ...row('a'), status: 'removed' }, { ...row('b'), status: 'removed' }]
    useToast().toasts.value.find((t) => t.message === 'Attendee removed.')!.action!.onClick()
    await flushPromises()
    expect(a.attendees.value.map((r) => r.status)).toEqual(['not_checked_in', 'removed'])
  })
})
