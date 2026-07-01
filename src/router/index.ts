import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import LoginView from '@/views/LoginView.vue'
import { useOrgMembership } from '@/composables/useOrgMembership'

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
      name: 'dp-campaigns',
      component: () => import('@/views/dp/DpCampaignsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/manage/frames/new',
      name: 'dp-new',
      component: () => import('@/views/dp/DpNewCampaignView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/manage/frames/:slug/edit',
      name: 'dp-edit',
      component: () => import('@/views/dp/DpEditCampaignView.vue'),
      meta: { requiresAuth: true },
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
      name: 'events',
      component: () => import('@/views/tix/EventsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/manage/tix/new',
      name: 'event-new',
      component: () => import('@/views/tix/NewEventView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/manage/tix/:id/select',
      name: 'event-select',
      component: () => import('@/views/tix/AttendeeSelectionView.vue'),
      meta: { requiresAuth: true },
    },
    {
      // Internal event management (auth required)
      path: '/manage/tix/:id',
      name: 'event-manage',
      component: () => import('@/views/tix/EventDetailView.vue'),
      meta: { requiresAuth: true },
    },
    {
      // Public attendee ticket lookup — STRICTLY NO auth
      path: '/tix/:eventId',
      name: 'ticket-lookup',
      component: () => import('@/views/tix/TicketLookupView.vue'),
    },

    // ── Account & legal ──────────────────────────────────────────────────────
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/SettingsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/orgs',
      name: 'organizations',
      component: () => import('@/views/OrganizationsView.vue'),
      meta: { requiresAuth: true },
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

  next()
})

export default router
