import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import LoginView from '@/views/LoginView.vue'
import { useOrgMembership } from '@/composables/useOrgMembership'
import { SUPER_ADMIN_EMAIL } from '@/config/admin'

const { checkOrgMembership } = useOrgMembership()

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior() {
    return { top: 0, behavior: 'smooth' }
  },
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/login', name: 'login', component: LoginView },

    // ── Suite hub ────────────────────────────────────────────────────────────
    {
      path: '/dashboard',
      name: 'dashboard',
      component: () => import('@/views/DashboardView.vue'),
      meta: { requiresAuth: true },
    },

    // ── Links module ─────────────────────────────────────────────────────────
    {
      path: '/links',
      name: 'links',
      component: () => import('@/views/links/LinksView.vue'),
      meta: { requiresAuth: true },
    },

    // ── Forms module ─────────────────────────────────────────────────────────
    {
      path: '/forms',
      component: () => import('@/views/forms/FormsLayout.vue'),
      meta: { requiresAuth: true, requiresOrg: true },
      children: [
        {
          path: '',
          name: 'forms',
          component: () => import('@/views/forms/FormsHomeView.vue'),
        },
        {
          path: 'concessionaire',
          name: 'forms-concessionaire',
          component: () => import('@/views/forms/generators/ConcessionaireView.vue'),
        },
        {
          path: 'visitors-pass',
          name: 'forms-visitors-pass',
          component: () => import('@/views/forms/generators/VisitorsPassView.vue'),
        },
        {
          path: 'letter-of-intent',
          name: 'forms-letter-of-intent',
          component: () => import('@/views/forms/generators/LetterOfIntentView.vue'),
        },
      ],
    },

    // ── Frames module (profile frames) ───────────────────────────────────────
    // Admin under /manage/frames; public at /frames/:slug.
    {
      path: '/manage/frames',
      component: () => import('@/views/dp/FramesManageLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'dp-campaigns',
          component: () => import('@/views/dp/DpCampaignsView.vue'),
        },
        {
          path: 'new',
          name: 'dp-new',
          component: () => import('@/views/dp/DpNewCampaignView.vue'),
        },
        {
          path: ':slug/edit',
          name: 'dp-edit',
          component: () => import('@/views/dp/DpEditCampaignView.vue'),
        },
      ],
    },
    {
      // Public profile-frame editor — STRICTLY NO auth
      path: '/frames/:slug',
      name: 'dp-public',
      component: () => import('@/views/dp/DpPublicView.vue'),
    },

    // ── Tix module (ticketing) ───────────────────────────────────────────────
    // Admin under /manage/tix (static segments declared before the dynamic
    // /manage/tix/:id so they always win the match); public at /tix/:slug.
    {
      path: '/manage/tix',
      component: () => import('@/views/tix/TixManageLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'events',
          component: () => import('@/views/tix/EventsView.vue'),
        },
        {
          path: 'new',
          name: 'event-new',
          component: () => import('@/views/tix/NewEventView.vue'),
        },
        {
          path: ':id/select',
          name: 'event-select',
          component: () => import('@/views/tix/AttendeeSelectionView.vue'),
        },
        {
          path: ':id',
          name: 'event-manage',
          component: () => import('@/views/tix/EventDetailView.vue'),
        },
      ],
    },
    {
      // Public attendee ticket lookup — STRICTLY NO auth
      path: '/tix/:eventId',
      name: 'ticket-lookup',
      component: () => import('@/views/tix/TicketLookupView.vue'),
    },

    // ── Orgs module (coordinator org settings) ─────────────────────────────
    // Static /orgs/modify/* must be declared before public /orgs/:slug.
    {
      path: '/orgs/modify',
      component: () => import('@/views/orgs/OrgsManageLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'orgs-modify-index',
          redirect: () => {
            const activeOrgId = localStorage.getItem('active_org_id')
            if (activeOrgId) {
              return { name: 'orgs-modify', params: { slug: activeOrgId } }
            }
            return { name: 'orgs-modify', params: { slug: '__none' } }
          },
        },
        {
          path: ':slug',
          name: 'orgs-modify',
          component: () => import('@/views/orgs/OrgModifyView.vue'),
        },
      ],
    },

    // ── Public org catalog ─────────────────────────────────────────────────────
    {
      path: '/orgs',
      name: 'org-catalog',
      component: () => import('@/views/orgs/OrgCatalogView.vue'),
    },
    {
      path: '/orgs/:slug',
      name: 'org-profile',
      component: () => import('@/views/orgs/OrgProfileView.vue'),
    },

    // ── Account & legal ──────────────────────────────────────────────────────
    {
      path: '/settings',
      component: () => import('@/views/settings/SettingsLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          redirect: { name: 'settings-security' },
        },
        {
          path: 'security',
          name: 'settings-security',
          component: () => import('@/views/SettingsView.vue'),
        },
        {
          path: 'organizations',
          redirect: () => ({ name: 'orgs-modify-index' }),
        },
        {
          path: 'orgs',
          redirect: () => ({ name: 'orgs-modify-index' }),
        },
        {
          path: 'orgs/:orgId',
          redirect: (to) => ({
            name: 'orgs-modify',
            params: { slug: to.params.orgId as string },
          }),
        },
        {
          path: 'org-management',
          name: 'settings-org-management',
          component: () => import('@/views/settings/OrgManagementView.vue'),
          meta: { requiresSuperAdmin: true },
        },
        {
          path: 'org-management/new',
          name: 'settings-org-management-new',
          component: () => import('@/views/settings/OrgManagementEditView.vue'),
          meta: { requiresSuperAdmin: true },
        },
        {
          path: 'org-management/:orgId',
          name: 'settings-org-management-edit',
          component: () => import('@/views/settings/OrgManagementEditView.vue'),
          meta: { requiresSuperAdmin: true },
        },
      ],
    },
    {
      path: '/privacy',
      name: 'privacy',
      component: () => import('@/views/PrivacyView.vue'),
    },
    {
      path: '/terms',
      name: 'terms',
      component: () => import('@/views/TermsView.vue'),
    },
    {
      path: '/contact',
      name: 'contact',
      component: () => import('@/views/ContactView.vue'),
    },
    {
      path: '/reset-password',
      name: 'reset-password',
      component: () => import('@/views/ResetPasswordView.vue'),
    },
    {
      path: '/verify',
      name: 'verify',
      component: () => import('@/views/VerifyView.vue'),
    },

    // ── Link shortener redirect — MUST stay second-to-last ───────────────────
    {
      path: '/:slug',
      name: 'redirect',
      component: () => import('@/views/RedirectView.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/views/NotFoundView.vue'),
    },
  ],
})

router.beforeEach(async (to, _from, next) => {
  const isAuthenticated = !!localStorage.getItem('eypi_token')

  if (to.meta.requiresAuth && !isAuthenticated) {
    next({ name: 'login' })
    return
  }

  if (to.name === 'login' && isAuthenticated) {
    next({ name: 'dashboard' })
    return
  }

  const requiresOrg = to.matched.some((record) => record.meta.requiresOrg)

  if (requiresOrg) {
    const hasOrg = await checkOrgMembership()
    if (!hasOrg) {
      if (to.name === 'forms') {
        next()
        return
      }
      next({ name: 'forms', replace: true })
      return
    }
  }

  const requiresSuperAdmin = to.matched.some((record) => record.meta.requiresSuperAdmin)
  if (requiresSuperAdmin) {
    try {
      const token = localStorage.getItem('eypi_token')
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1] ?? ''))
        if (payload.email !== SUPER_ADMIN_EMAIL) {
          next({ name: 'settings-security', replace: true })
          return
        }
      } else {
        next({ name: 'login' })
        return
      }
    } catch {
      next({ name: 'settings-security', replace: true })
      return
    }
  }

  next()
})

export default router
