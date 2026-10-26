// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import InviteCard from '@/components/orgs/InviteCard.vue'
import OrgManagementEditView from '@/views/settings/OrgManagementEditView.vue'
import OrgManagementView from '@/views/settings/OrgManagementView.vue'
import ReportView from '@/views/ReportView.vue'
import SettingsView from '@/views/SettingsView.vue'

import orgCatalog from './orgs/OrgCatalogView.vue?raw'
import orgModify from './orgs/OrgModifyView.vue?raw'
import orgProfile from './orgs/OrgProfileView.vue?raw'
import orgsLayout from './orgs/OrgsManageLayout.vue?raw'
import orgMgmt from './settings/OrgManagementView.vue?raw'
import orgMgmtEdit from './settings/OrgManagementEditView.vue?raw'
import account from './AccountView.vue?raw'
import invites from './InvitesView.vue?raw'
import settings from './SettingsView.vue?raw'
import report from './ReportView.vue?raw'
import inviteCard from '@/components/orgs/InviteCard.vue?raw'

const sources = {
  orgCatalog, orgModify, orgProfile, orgsLayout, orgMgmt, orgMgmtEdit, account, invites, settings, report, inviteCard,
}

const route = { query: { slug: 'promo' } as Record<string, string>, params: { orgId: 'jpcs' }, name: 'admin-orgs-new' as string }
vi.mock('vue-router', async (orig) => ({
  ...(await orig<typeof import('vue-router')>()),
  useRoute: () => route,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))

const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/:p(.*)*', name: 'admin-orgs-edit', component: { template: '<div />' } }],
})

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ orgs: [{ org_id: 'jpcs', org_name: 'JPCS', owner_email: 'a@b.c', is_public_catalog: 1, created_at: '' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } })))
})

describe('orgs, settings, account, invites restyle', () => {
  it.each(Object.entries(sources))('%s has no legacy classes, scoped @apply or hard-coded colours', (_n, src) => {
    expect(src).not.toMatch(/(?<![a-z])g-(text|muted|border|accent|primary|surface|bg)|mica|gold|tap-scale|apc-|btn-(primary|secondary|danger|gold|lg)|\bcontrol\b|field-input|dark:(bg|text|border)-(slate|gray|white)|\bslate-\d|\bgray-\d|\bred-\d|bg-white|text-white|#[0-9a-fA-F]{3,8}\b|\breveal\b|\bdelay-|text-data|text-card-title|text-section-title|@apply|@reference|<style/)
  })

  it('report: labelled Input/Textarea with aria-invalid and a full-width lg Button', async () => {
    const w = mount(ReportView, { global: { plugins: [router] } })
    expect(w.findAll('[data-slot="card"]')).toHaveLength(1)
    const label = w.get('label[data-slot="label"][for="report-details"]')
    expect(label.text()).toBe('Details')
    expect(w.get('textarea[data-slot="textarea"]').attributes('id')).toBe('report-details')
    expect(w.find('label[for="report-reason"]').exists()).toBe(true)
    const submit = w.get('button[type="submit"]')
    expect(submit.attributes('data-size')).toBe('lg')
    expect(submit.classes()).toContain('w-full')
    await w.get('form').trigger('submit')
    expect(w.get('#report-reason').attributes('aria-invalid')).toBe('true')
  })

  it('org admin edit: every field has a visible Label and the form buttons are primitives', async () => {
    const w = mount(OrgManagementEditView, { global: { plugins: [router] } })
    await flushPromises()
    for (const id of ['org-slug', 'org-name', 'owner-email']) {
      expect(w.find(`label[data-slot="label"][for="${id}"]`).exists()).toBe(true)
      expect(w.get(`input#${id}`).attributes('data-slot')).toBe('input')
    }
    expect(w.get('button[type="submit"]').attributes('data-slot')).toBe('button')
    expect(w.findAll('[data-slot="card"]')).toHaveLength(1)
  })

  it('org admin list: rows are cards with a Button edit link', async () => {
    const w = mount(OrgManagementView, { global: { plugins: [router] } })
    await flushPromises()
    const row = w.get('[data-org-row]')
    expect(row.classes()).toContain('rounded-2xl')
    expect(row.get('a').attributes('data-slot')).toBe('button')
  })

  it('invite card: Card with Button actions at least 44px high', () => {
    const w = mount(InviteCard, {
      props: { invite: { orgId: 'jpcs', orgName: 'JPCS', logoUrl: null, invitedByName: 'Ada', invitedAt: new Date().toISOString() } },
      global: { plugins: [router] },
    })
    expect(w.find('[data-slot="card"]').exists()).toBe(true)
    const buttons = w.findAll('button[data-slot="button"]')
    expect(buttons.map((b) => b.text())).toEqual(['Decline', 'Accept'])
    for (const b of buttons) expect(b.attributes('data-size') ?? 'default').not.toBe('xs')
  })

  it('settings view is a Card section', () => {
    const w = mount(SettingsView, { global: { plugins: [router] } })
    expect(w.find('[data-slot="card"]').exists()).toBe(true)
  })
})
