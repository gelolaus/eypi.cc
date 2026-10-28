// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it, vi } from 'vitest'
import DashboardView from './DashboardView.vue'

import dashboard from './DashboardView.vue?raw'
import links from './links/LinksView.vue?raw'
import linkList from '@/components/links/LinkList.vue?raw'
import orgCatalog from './orgs/OrgCatalogView.vue?raw'
import orgModify from './orgs/OrgModifyView.vue?raw'
import orgProfile from './orgs/OrgProfileView.vue?raw'
import events from './tix/EventsView.vue?raw'
import myTickets from './tix/MyTicketsView.vue?raw'
import guestTicket from './tix/GuestTicketView.vue?raw'
import dpCampaigns from './dp/DpCampaignsView.vue?raw'
import dpEdit from './dp/DpEditCampaignView.vue?raw'
import adminUsers from './admin/AdminUsersView.vue?raw'
import adminLinks from './admin/AdminLinksView.vue?raw'
import adminAudit from './admin/AdminAuditView.vue?raw'
import adminSpeed from './admin/AdminSpeedView.vue?raw'

vi.mock('@/composables/useActiveOrg', () => ({
  useActiveOrg: () => ({ orgs: ref([]), activeOrg: ref(null), fetchOrgs: vi.fn(), selectOrg: vi.fn() }),
}))

const views = {
  dashboard, links, linkList, orgCatalog, orgModify, orgProfile, events, myTickets, guestTicket,
  dpCampaigns, dpEdit, adminUsers, adminLinks, adminAudit, adminSpeed,
}

describe('page-load skeletons', () => {
  it.each(Object.entries(views))('%s uses shared skeletons, no hand-rolled blocks or spinners', (_name, src) => {
    expect(src).not.toMatch(/animate-pulse/)
    expect(src).not.toMatch(/animate-spin/)
    expect(src).toMatch(/components\/(skeletons|ui\/Skeleton|PageSkeleton)/)
  })

  it('admin list views no longer show a bare Loading line', () => {
    expect(adminSpeed).not.toMatch(/>\s*Loading…\s*</)
  })

  it('the dashboard reserves the stat grid while link totals load', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: DashboardView }] })
    const wrapper = mount(DashboardView, { global: { plugins: [router] } })
    const busy = wrapper.get('[data-card="links"] [aria-busy="true"]')
    expect(busy.findAll('[data-skeleton-tile]').length).toBe(2)
    expect((busy.get('[data-skeleton-tile]').element as HTMLElement).style.height).toMatch(/^\d+px$/)
    vi.unstubAllGlobals()
  })
})

describe('per-view skeleton heights match the loaded markup', () => {
  it.each([
    ['adminUsers', adminUsers, 210, 53],
    ['adminLinks', adminLinks, 206, 77],
    ['adminAudit', adminAudit, 226, 77],
    ['linkList', linkList, 212, 100],
  ])('%s reserves %ipx (md %ipx) rows', (_n, src, h, md) => {
    expect(src).toContain(`:row-height="${h}"`)
    expect(src).toContain(`:md-row-height="${md}"`)
  })

  it('admin speed tiles include the status and sparkline line (90 + 36)', () => {
    expect(adminSpeed).toContain(':h="126"')
  })

  it('org profile uses its own skeleton and the campaign editor centres its title', () => {
    expect(orgProfile).toContain('<OrgProfileSkeleton')
    expect(dpEdit).toContain('align="center"')
  })
})
