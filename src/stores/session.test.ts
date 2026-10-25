// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { useSession } from '@/stores/session'

beforeEach(() => {
  localStorage.clear()
  useSession().reset()
})

describe('useSession', () => {
  it('dedupes concurrent load() calls', async () => {
    const session = useSession()

    const first = session.load()
    const second = session.load()

    expect(second).toBe(first)
    expect(session.status.value).toBe('loading')

    await first
    await second

    expect(session.status.value).toBe('ready')
  })

  it('reset clears the signed-in user and the stored token', () => {
    localStorage.setItem('eypi_token', 'tok-1')
    const session = useSession()
    session.user.value = {
      id: 'user-1',
      email: 'user@student.apc.edu.ph',
      name: 'User',
      role: 'user',
    }
    session.status.value = 'ready'

    session.reset()

    expect(session.user.value).toBeNull()
    expect(session.status.value).toBe('idle')
    expect(localStorage.getItem('eypi_token')).toBeNull()
  })
})
