<script setup lang="ts">
import { computed } from 'vue'
import LineChart from '@/components/charts/LineChart.vue'
import SparkLine from '@/components/charts/SparkLine.vue'
import StatTile from '@/components/charts/StatTile.vue'
import PanelState from '@/components/dashboard/PanelState.vue'
import { useActiveOrg } from '@/composables/useActiveOrg'
import { useDashboardRange } from '@/composables/useDashboardRange'
import { checkInRate } from '@/lib/dashboardModel'
import { fetchOrgInsights, orgInsightsKey } from '@/lib/queries'
import { useQuery } from '@/lib/queryCache'
import { orgSlugLabel } from '@/types/orgs'

const { activeOrg } = useActiveOrg()
const { range } = useDashboardRange()

const query = useQuery(
  () => (activeOrg.value ? orgInsightsKey(activeOrg.value.org_id, range.value) : ''),
  () => fetchOrgInsights(activeOrg.value!.org_id, range.value),
)

const panelStatus = computed<'loading' | 'error' | 'ready'>(() => {
  if (query.status.value === 'error') return 'error'
  if (query.status.value === 'ready' && query.data.value) return 'ready'
  return 'loading'
})

const insights = computed(() => query.data.value)
const rate = computed(() => {
  const d = insights.value
  if (!d) return null
  return checkInRate(d.tix.checkIns, d.tix.registrations)
})
const memberCount = computed(() => {
  const daily = insights.value?.members.daily ?? []
  return daily[daily.length - 1]?.count ?? 0
})
const memberValues = computed(() => (insights.value?.members.daily ?? []).map((d) => d.count))
const profileSeries = computed(() => [{
  label: 'Profile views',
  points: (insights.value?.profileViews.daily ?? []).map((d) => ({ x: d.day, y: d.n })),
}])
const fmt = (n: number) => n.toLocaleString('en-US')
</script>

<template>
  <section
    v-if="activeOrg"
    data-card="org-insights"
    class="space-y-4"
  >
    <div class="flex flex-wrap items-baseline justify-between gap-2">
      <h3 class="font-heading text-lg font-semibold tracking-tight">
        {{ activeOrg.org_name }}
        <span class="ml-2 font-mono text-sm font-normal text-muted-foreground">{{ orgSlugLabel(activeOrg) }}</span>
      </h3>
      <router-link
        :to="`/orgs/${encodeURIComponent(activeOrg.org_id)}/insights`"
        class="inline-flex min-h-11 items-center text-base font-medium text-primary underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        Full insights
      </router-link>
    </div>

    <PanelState
      :status="panelStatus"
      title="Org insights"
      @retry="query.refresh()"
    >
      <div
        v-if="insights"
        class="space-y-4"
      >
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatTile
            label="Profile views"
            :value="fmt(insights.profileViews.total)"
          />
          <StatTile
            label="Registrations"
            :value="fmt(insights.tix.registrations)"
          />
          <div class="space-y-1">
            <StatTile
              label="Check-ins"
              :value="fmt(insights.tix.checkIns)"
            />
            <p
              v-if="rate != null"
              class="px-1 text-sm text-muted-foreground"
            >
              {{ rate }}% checked in
            </p>
          </div>
          <StatTile
            label="Frames views"
            :value="fmt(insights.frames.views)"
          />
          <StatTile
            label="Frames downloads"
            :value="fmt(insights.frames.downloads)"
          />
          <StatTile
            label="Members"
            :value="fmt(memberCount)"
          />
        </div>
        <LineChart
          y-label="Profile views"
          :series="profileSeries"
        />
        <SparkLine
          :values="memberValues"
          label="Members over time"
        />
      </div>
    </PanelState>
  </section>
</template>