import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import LoginView from '@/views/LoginView.vue'

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
      name: 'forms',
      component: () => import('@/views/forms/FormsHomeView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/forms/concessionaire',
      name: 'forms-concessionaire',
      component: () => import('@/views/forms/generators/ConcessionaireView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/forms/visitors-pass',
      name: 'forms-visitors-pass',
      component: () => import('@/views/forms/generators/VisitorsPassView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/forms/letter-of-intent',
      name: 'forms-letter-of-intent',
      component: () => import('@/views/forms/generators/LetterOfIntentView.vue'),
      meta: { requiresAuth: true },
    },

    // ── DP Blast module (profile frames) ─────────────────────────────────────
    // Static /manage/dp-blast routes are declared BEFORE the dynamic /manage/:id
    // (ticketing) route so they always win the match.
    {
      path: '/manage/dp-blast',
      name: 'dp-campaigns',
      component: () => import('@/views/dp/DpCampaignsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/manage/dp-blast/new',
      name: 'dp-new',
      component: () => import('@/views/dp/DpNewCampaignView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/manage/dp-blast/:id/edit',
      name: 'dp-edit',
      component: () => import('@/views/dp/DpEditCampaignView.vue'),
      meta: { requiresAuth: true },
    },
    {
      // Public profile-frame editor — STRICTLY NO auth
      path: '/dp/:slug',
      name: 'dp-public',
      component: () => import('@/views/dp/DpPublicView.vue'),
    },

    // ── Ticketing module (management) ────────────────────────────────────────
    {
      path: '/events',
      name: 'events',
      component: () => import('@/views/tix/EventsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/events/new',
      name: 'event-new',
      component: () => import('@/views/tix/NewEventView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/events/:id/select',
      name: 'event-select',
      component: () => import('@/views/tix/AttendeeSelectionView.vue'),
      meta: { requiresAuth: true },
    },
    {
      // Internal event management (auth required)
      path: '/manage/:id',
      name: 'event-manage',
      component: () => import('@/views/tix/EventDetailView.vue'),
      meta: { requiresAuth: true },
    },
    {
      // Public attendee ticket lookup — STRICTLY NO auth
      path: '/event/:eventId',
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

router.beforeEach((to, _from, next) => {
  const isAuthenticated = !!localStorage.getItem('eypi_token')

  if (to.meta.requiresAuth && !isAuthenticated) {
    next({ name: 'login' })
  } else if (to.name === 'login' && isAuthenticated) {
    next({ name: 'dashboard' })
  } else {
    next()
  }
})

export default router
