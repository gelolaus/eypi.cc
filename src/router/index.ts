import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import LoginView from '@/views/LoginView.vue'
import { useOrgMembership } from '@/composables/useOrgMembership'
import { useSession } from '@/stores/session'
import { reloadOnceForChunkError } from '@/lib/chunkReload'
import { loadAppShell } from '@/components/layout/loadAppShell'
import { routeNeedsSession, routeSkipsConsent } from './guards'

const { checkOrgMembership } = useOrgMembership()
const session = useSession()

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior(_to, _from, savedPosition) {
    if (savedPosition) return savedPosition
    const reduce = typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    return { top: 0, behavior: reduce ? 'auto' : 'smooth' }
  },
  routes: [
    { path: '/', name: 'home', component: HomeView, meta: { layout: 'public', title: 'Home' } },
    { path: '/login', name: 'login', component: LoginView, meta: { layout: 'public', title: 'Sign in' } },

    // ── Suite hub ────────────────────────────────────────────────────────────
    {
      path: '/dashboard',
      name: 'dashboard',
      component: () => import('@/views/DashboardView.vue'),
      meta: { requiresAuth: true, title: 'Dashboard' },
    },
    {
      path: '/invites',
      name: 'invites',
      component: () => import('@/views/InvitesView.vue'),
      meta: { requiresAuth: true, title: 'Invites' },
    },

    // ── Links module ─────────────────────────────────────────────────────────
    {
      path: '/links',
      name: 'links',
      component: () => import('@/views/links/LinksView.vue'),
      meta: { requiresAuth: true, title: 'Links' },
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
          meta: { title: 'Forms' },
        },
        {
          path: 'concessionaire',
          name: 'forms-concessionaire',
          component: () => import('@/views/forms/generators/ConcessionaireView.vue'),
          meta: { title: 'Concessionaire form' },
        },
        {
          path: 'visitors-pass',
          name: 'forms-visitors-pass',
          component: () => import('@/views/forms/generators/VisitorsPassView.vue'),
          meta: { title: 'Visitors pass' },
        },
        {
          path: 'letter-of-intent',
          name: 'forms-letter-of-intent',
          component: () => import('@/views/forms/generators/LetterOfIntentView.vue'),
          meta: { title: 'Letter of intent' },
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
          meta: { title: 'Frames' },
        },
        {
          path: 'new',
          name: 'dp-new',
          component: () => import('@/views/dp/DpNewCampaignView.vue'),
          meta: { title: 'New frame' },
        },
        {
          path: ':slug/edit',
          name: 'dp-edit',
          component: () => import('@/views/dp/DpEditCampaignView.vue'),
          meta: { title: 'Edit frame' },
        },
      ],
    },
    {
      // Public profile-frame editor — STRICTLY NO auth
      path: '/frames/:slug',
      name: 'dp-public',
      component: () => import('@/views/dp/DpPublicView.vue'),
      meta: { layout: 'public', title: 'Frame' },
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
          meta: { title: 'Tix' },
        },
        {
          path: 'new',
          name: 'event-new',
          component: () => import('@/views/tix/NewEventView.vue'),
          meta: { title: 'New event' },
        },
        {
          path: ':id/select',
          name: 'event-select',
          component: () => import('@/views/tix/AttendeeSelectionView.vue'),
          meta: { title: 'Attendee selection' },
        },
        {
          path: ':id',
          name: 'event-manage',
          component: () => import('@/views/tix/EventDetailView.vue'),
          meta: { title: 'Event' },
        },
      ],
    },
    {
      // Public attendee ticket lookup — STRICTLY NO auth
      path: '/tix/:eventId',
      name: 'ticket-lookup',
      component: () => import('@/views/tix/TicketLookupView.vue'),
      meta: { layout: 'public', title: 'Ticket lookup' },
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
          meta: { title: 'Org settings' },
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
          meta: { title: 'Org settings' },
        },
      ],
    },

    // ── Public org catalog ─────────────────────────────────────────────────────
    {
      path: '/orgs',
      name: 'org-catalog',
      component: () => import('@/views/orgs/OrgCatalogView.vue'),
      meta: { title: 'Orgs' },
    },
    {
      path: '/orgs/:slug',
      name: 'org-profile',
      component: () => import('@/views/orgs/OrgProfileView.vue'),
      meta: { title: 'Organization' },
    },

    // ── Account & legal ──────────────────────────────────────────────────────
    {
      path: '/account',
      name: 'account',
      component: () => import('@/views/AccountView.vue'),
      meta: { requiresAuth: true, title: 'Account' },
    },
    {
      path: '/settings',
      redirect: { name: 'account' },
    },
    {
      path: '/settings/security',
      redirect: { name: 'account' },
    },
    // Old admin org-management URLs keep working; the pages now live in /admin.
    {
      path: '/settings/organizations',
      redirect: { name: 'orgs-modify-index' },
    },
    {
      path: '/settings/orgs',
      redirect: { name: 'orgs-modify-index' },
    },
    {
      path: '/settings/orgs/:orgId',
      redirect: (to) => ({ name: 'orgs-modify', params: { slug: to.params.orgId as string } }),
    },
    {
      path: '/settings/org-management',
      redirect: { name: 'admin-orgs' },
    },
    {
      path: '/settings/org-management/new',
      redirect: { name: 'admin-orgs-new' },
    },
    {
      path: '/settings/org-management/:orgId',
      redirect: (to) => ({ name: 'admin-orgs-edit', params: { orgId: to.params.orgId as string } }),
    },

    // ── Admin panel ──────────────────────────────────────────────────────────
    {
      path: '/admin',
      component: () => import('@/views/admin/AdminLayout.vue'),
      meta: { requiresAuth: true, requiresAdmin: true },
      children: [
        {
          path: '',
          redirect: { name: 'admin-overview' },
        },
        {
          path: 'overview',
          name: 'admin-overview',
          component: () => import('@/views/admin/AdminOverviewView.vue'),
          meta: { title: 'Overview' },
        },
        {
          path: 'users',
          name: 'admin-users',
          component: () => import('@/views/admin/AdminUsersView.vue'),
          meta: { title: 'Users' },
        },
        {
          path: 'links',
          name: 'admin-links',
          component: () => import('@/views/admin/AdminLinksView.vue'),
          meta: { title: 'Links' },
        },
        {
          path: 'reports',
          name: 'admin-reports',
          component: () => import('@/views/admin/AdminReportsView.vue'),
          meta: { title: 'Reports' },
        },
        {
          path: 'speed',
          name: 'admin-speed',
          component: () => import('@/views/admin/AdminSpeedView.vue'),
          meta: { title: 'Speed' },
        },
        {
          path: 'audit',
          name: 'admin-audit',
          component: () => import('@/views/admin/AdminAuditView.vue'),
          meta: { title: 'Audit log' },
        },
        {
          path: 'orgs',
          name: 'admin-orgs',
          component: () => import('@/views/settings/OrgManagementView.vue'),
          meta: { title: 'Org management' },
        },
        {
          path: 'orgs/new',
          name: 'admin-orgs-new',
          component: () => import('@/views/settings/OrgManagementEditView.vue'),
          meta: { title: 'New organization' },
        },
        {
          path: 'orgs/:orgId',
          name: 'admin-orgs-edit',
          component: () => import('@/views/settings/OrgManagementEditView.vue'),
          meta: { title: 'Edit organization' },
        },
      ],
    },
    {
      path: '/privacy',
      name: 'privacy',
      component: () => import('@/views/LegalView.vue'),
      meta: { layout: 'public', title: 'Privacy' },
    },
    {
      path: '/terms',
      name: 'terms',
      component: () => import('@/views/LegalView.vue'),
      meta: { layout: 'public', title: 'Terms' },
    },
    {
      path: '/acceptable-use',
      name: 'acceptable-use',
      component: () => import('@/views/LegalView.vue'),
      meta: { layout: 'public', title: 'Acceptable use' },
    },
    {
      path: '/consent',
      name: 'consent',
      component: () => import('@/views/ConsentView.vue'),
      meta: { requiresAuth: true, title: 'Consent' },
    },
    {
      path: '/contact',
      name: 'contact',
      component: () => import('@/views/ContactView.vue'),
      meta: { layout: 'public', title: 'Contact' },
    },
    {
      path: '/unlock/:slug',
      name: 'unlock',
      component: () => import('@/views/UnlockView.vue'),
      meta: { layout: 'public', title: 'Unlock' },
    },
    {
      path: '/expired',
      name: 'expired',
      component: () => import('@/views/ExpiredView.vue'),
      meta: { layout: 'public', title: 'Expired' },
    },
    {
      path: '/report',
      name: 'report',
      component: () => import('@/views/ReportView.vue'),
      meta: { layout: 'public', title: 'Report' },
    },

    // ── Link shortener redirect — MUST stay second-to-last ───────────────────
    {
      path: '/:slug',
      name: 'redirect',
      component: () => import('@/views/RedirectView.vue'),
      meta: { layout: 'public', title: 'Redirect' },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/views/NotFoundView.vue'),
      meta: { layout: 'public', title: 'Page not found' },
    },
  ],
})

// A public page renders before /api/me answers. Once the session resolves,
// a signed-in user who still owes consent is sent to /consent from wherever
// they are, with the page they were on as returnTo.
function redirectToConsent(): void {
  const current = router.currentRoute.value
  if (!session.user.value || session.needsConsent.value.length === 0) return
  if (routeSkipsConsent(current)) return
  void router.replace({ name: 'consent', query: { returnTo: current.fullPath } })
}

router.beforeEach(async (to, _from, next) => {
  // Start the app shell chunk now so it does not waterfall behind the first render.
  if (to.meta.layout !== 'public') void loadAppShell().catch(() => {})
  if (routeNeedsSession(to)) {
    // This navigation decides consent itself; a queued background redirect
    // would supersede it and lose the target as returnTo.
    session.offReady(redirectToConsent)
    await session.load()
  } else if (session.status.value !== 'ready') {
    void session.load()
    session.onReady(redirectToConsent)
    next()
    return
  }
  const signedIn = session.user.value

  if (to.name === 'login' && signedIn) {
    next({ name: 'dashboard' })
    return
  }

  if (to.meta.requiresAuth && !signedIn) {
    next({ name: 'login', query: { returnTo: to.fullPath } })
    return
  }

  const skipsConsent = routeSkipsConsent(to)
  if (signedIn && session.needsConsent.value.length > 0 && !skipsConsent) {
    next({ name: 'consent', query: { returnTo: to.fullPath } })
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

  const requiresAdmin = to.matched.some((record) => record.meta.requiresAdmin)
  if (requiresAdmin) {
    if (!signedIn) {
      next({ name: 'login', query: { returnTo: to.fullPath } })
      return
    }
    if (signedIn.role !== 'admin') {
      next({ name: 'account', replace: true })
      return
    }
  }

  next()
})

router.afterEach((to) => {
  const titled = [...to.matched].reverse().find((record) => typeof record.meta.title === 'string')
  const page = typeof titled?.meta.title === 'string' ? titled.meta.title : 'Page'
  const title = `${page} · Eypi`
  document.title = title

  let region = document.getElementById('route-announcer')
  if (!region && document.body) {
    region = document.createElement('div')
    region.id = 'route-announcer'
    region.className = 'sr-only'
    region.setAttribute('role', 'status')
    region.setAttribute('aria-live', 'polite')
    region.setAttribute('aria-atomic', 'true')
    document.body.appendChild(region)
  }
  if (region) region.textContent = title
})

router.onError((error, to) => {
  reloadOnceForChunkError(error, to.fullPath)
})

export default router
