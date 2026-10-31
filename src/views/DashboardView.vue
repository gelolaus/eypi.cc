<template>
  <AppPage
    :title="userName ? `Hi, ${userName}.` : 'Hi.'"
    description="Pick up where you left off."
  >
    <Card
      v-if="pendingInviteCount > 0"
      class="border border-primary/40 bg-primary/10 px-5 py-4 text-base text-foreground"
      role="status"
    >
      <p>
        {{ inviteBanner }}
        <router-link
          to="/invites"
          class="inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Review invites
        </router-link>
      </p>
    </Card>

    <section
      class="space-y-6"
      aria-labelledby="rams-heading"
    >
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2
          id="rams-heading"
          class="font-heading text-xl font-semibold tracking-tight"
        >
          Rams
        </h2>
        <PeriodPicker
          :model-value="range"
          @update:model-value="setRange"
        />
      </div>

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <LinkKpis
          :trends="trends"
          :status="trendsStatus"
          @retry="trendsQuery.refresh()"
        />
        <ClicksTrend
          :trends="trends"
          :status="trendsStatus"
          @retry="trendsQuery.refresh()"
        />
        <TopLinks
          :trends="trends"
          :status="trendsStatus"
          @retry="trendsQuery.refresh()"
        />
        <AudiencePanels
          :trends="trends"
          :status="trendsStatus"
          @retry="trendsQuery.refresh()"
        />
        <BestHours
          :trends="trends"
          :status="trendsStatus"
          @retry="trendsQuery.refresh()"
        />
        <UpcomingTickets
          :tickets="tickets"
          :status="ticketsStatus"
          @retry="ticketsQuery.refresh()"
        />
      </div>

      <AcrossApc
        :stats="stats"
        :status="statsStatus"
      />

      <FeatureCards
        :admin="isAdmin"
        :org="hasOrgMembership"
        group="rams"
      />
    </section>

    <section
      v-if="activeOrg"
      class="mt-8 space-y-6"
      aria-labelledby="orgs-heading"
    >
      <h2
        id="orgs-heading"
        class="font-heading text-xl font-semibold tracking-tight"
      >
        Orgs
      </h2>
      <OrgInsightsSection />
      <FeatureCards
        :admin="isAdmin"
        :org="true"
        group="orgs"
      />
    </section>
  </AppPage>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import AcrossApc from '@/components/dashboard/AcrossApc.vue'
import AudiencePanels from '@/components/dashboard/AudiencePanels.vue'
import BestHours from '@/components/dashboard/BestHours.vue'
import ClicksTrend from '@/components/dashboard/ClicksTrend.vue'
import FeatureCards from '@/components/dashboard/FeatureCards.vue'
import LinkKpis from '@/components/dashboard/LinkKpis.vue'
import OrgInsightsSection from '@/components/dashboard/OrgInsightsSection.vue'
import PeriodPicker from '@/components/dashboard/PeriodPicker.vue'
import TopLinks from '@/components/dashboard/TopLinks.vue'
import UpcomingTickets from '@/components/dashboard/UpcomingTickets.vue'
import AppPage from '@/components/layout/AppPage.vue'
import { Card } from '@/components/ui/card'
import { useActiveOrg } from '@/composables/useActiveOrg'
import { useDashboardRange } from '@/composables/useDashboardRange'
import {
  PLATFORM_STATS_KEY,
  UPCOMING_TICKETS_KEY,
  fetchPlatformStats,
  fetchTrends,
  fetchUpcomingTickets,
  trendsKey,
  type PlatformStats,
  type TicketSummary,
  type UserTrends,
} from '@/lib/queries'
import { useQuery } from '@/lib/queryCache'
import { useSession } from '@/stores/session'

const { activeOrg } = useActiveOrg()
const { range, setRange } = useDashboardRange()
const session = useSession()

const userName = computed(() => session.user.value?.name ?? '')
const isAdmin = computed(() => session.user.value?.role === 'admin')
const pendingInviteCount = computed(() => session.pendingInviteCount.value)
const inviteBanner = computed(() => {
  const count = pendingInviteCount.value
  const noun = count === 1 ? 'invite' : 'invites'
  return `You have ${count} pending org ${noun}.`
})
const hasOrgMembership = computed(() => !!activeOrg.value)

const trendsQuery = useQuery(
  () => trendsKey(range.value),
  () => fetchTrends(range.value),
)
const ticketsQuery = useQuery(UPCOMING_TICKETS_KEY, fetchUpcomingTickets)
const statsQuery = useQuery(PLATFORM_STATS_KEY, fetchPlatformStats)

function panelStatus(
  status: 'idle' | 'loading' | 'ready' | 'error',
  data: unknown,
): 'loading' | 'error' | 'ready' {
  if (status === 'error') return 'error'
  if (status === 'ready' && data != null) return 'ready'
  return 'loading'
}

const trends = computed<UserTrends | null>(() => trendsQuery.data.value ?? null)
const trendsStatus = computed(() => panelStatus(trendsQuery.status.value, trendsQuery.data.value))

const tickets = computed<TicketSummary[] | null>(() => {
  const data = ticketsQuery.data.value
  return data ? data.tickets : ticketsQuery.status.value === 'ready' ? [] : null
})
const ticketsStatus = computed(() => panelStatus(ticketsQuery.status.value, ticketsQuery.data.value))

const stats = computed<PlatformStats | null>(() => statsQuery.data.value ?? null)
const statsStatus = computed(() => panelStatus(statsQuery.status.value, statsQuery.data.value))
</script>