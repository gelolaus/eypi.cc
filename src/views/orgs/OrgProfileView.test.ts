// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import OrgProfileView from './OrgProfileView.vue'
import { sendModuleBeacon } from '@/lib/beacon'

vi.mock('@/lib/beacon', () => ({ sendModuleBeacon: vi.fn() }))

const route = reactive<{ params: { slug: string }; query: Record<string, string> }>({
  params: { slug: 'jpcs' },
  query: {},
})
vi.mock('vue-router', () => ({
  useRoute: () => route,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))

const org = {
  slug: 'jpcs',
  name: 'JPCS',
  tagline: null,
  orgType: null,
  aboutMarkdown: null,
  bannerUrl: null,
  logoUrl: null,
  socialLinks: {},
  isPublicCatalog: true,
}

function respond(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const mounted: ReturnType<typeof mount>[] = []

async function mountView() {
  const wrapper = mount(OrgProfileView, { global: { stubs: { RouterLink: true } } })
  mounted.push(wrapper)
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  route.params.slug = 'jpcs'
  route.query = {}
  sessionStorage.clear()
  vi.mocked(sendModuleBeacon).mockReset()
  vi.stubGlobal('fetch', vi.fn(async () => respond(200, { org, events: { upcoming: [], past: [] } })))
})

afterEach(() => {
  // an earlier view would otherwise react to the next test's route changes
  for (const wrapper of mounted.splice(0)) wrapper.unmount()
  vi.unstubAllGlobals()
})

describe('OrgProfileView view beacon', () => {
  it('fires one view beacon per page load', async () => {
    await mountView()
    expect(vi.mocked(sendModuleBeacon).mock.calls).toEqual([['org', 'jpcs', 'view']])
  })

  it('does not fire in preview mode', async () => {
    route.query = { preview: '1' }
    sessionStorage.setItem('eypi_org_preview_jpcs', JSON.stringify(org))
    await mountView()
    expect(sendModuleBeacon).not.toHaveBeenCalled()
  })

  it('does not fire when the organization is not found', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respond(404, { error: 'Organization not found.' })))
    const wrapper = await mountView()
    expect(sendModuleBeacon).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Organization not found.')
  })
})
