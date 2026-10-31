import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const mocks = vi.hoisted(() => ({
  clearOrgHint: vi.fn(),
  close: vi.fn(),
  logout: vi.fn(),
  push: vi.fn(),
  success: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mocks.push }),
}))

vi.mock('@/composables/useActiveOrg', () => ({
  clearOrgHint: mocks.clearOrgHint,
  useActiveOrg: () => ({
    orgs: ref([{ org_id: 'jpcs' }]),
    activeOrg: ref({ org_id: 'jpcs' }),
  }),
}))

vi.mock('@/composables/useNavDrawer', () => ({
  useNavDrawer: () => ({ close: mocks.close }),
}))

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ success: mocks.success }),
}))

vi.mock('@/stores/session', () => ({
  useSession: () => ({ logout: mocks.logout }),
}))

import { useSignOut } from './useSignOut'

describe('useSignOut', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset())
  })

  it('clears the stored org hint when signing out', async () => {
    await useSignOut()()

    expect(mocks.clearOrgHint).toHaveBeenCalledOnce()
  })
})
