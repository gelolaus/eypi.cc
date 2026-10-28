<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import SparkLine from '@/components/charts/SparkLine.vue'
import StatTile from '@/components/charts/StatTile.vue'
import AppPage from '@/components/layout/AppPage.vue'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ApiError, api } from '@/lib/api'

type Payload = {
  profileViews: { total: number; daily: { day: string; n: number }[] }
  frames: { campaigns: number; views: number; downloads: number }
  tix: { events: number; registrations: number; checkIns: number }
  members: { daily: { day: string; count: number }[] }
}

const route = useRoute()
const orgId = computed(() => String(route.params.slug ?? ''))

const ranges = [
  { days: 7, label: 'Last 7 days' },
  { days: 30, label: 'Last 30 days' },
  { days: 90, label: 'Last 90 days' },
]
const range = ref(30)
const data = ref<Payload | null>(null)
const loading = ref(true)
const error = ref('')
let requestId = 0

async function load() {
  const current = ++requestId
  loading.value = true
  error.value = ''
  try {
    const next = await api.get<Payload>(`/api/orgs/${encodeURIComponent(orgId.value)}/insights?days=${range.value}`)
    if (current === requestId) data.value = next
  } catch (e) {
    if (current === requestId) {
      error.value = e instanceof ApiError && e.status === 403
        ? 'Only members of this organization can see its insights.'
        : 'Could not load insights. Check your connection and try again.'
    }
  } finally {
    if (current === requestId) loading.value = false
  }
}

watch(() => [orgId.value, range.value], () => { if (orgId.value) void load() }, { immediate: true })

const number = new Intl.NumberFormat('en-PH')
const viewValues = computed(() => (data.value?.profileViews.daily ?? []).map((d) => d.n))
const memberValues = computed(() => (data.value?.members.daily ?? []).map((d) => d.count))
const memberCount = computed(() => memberValues.value[memberValues.value.length - 1] ?? 0)
</script>

<template>
  <AppPage
    title="Org insights"
    description="Totals across your organization. Personal links are never included."
  >
    <div
      role="group"
      aria-label="Date range"
      class="flex flex-wrap gap-2"
    >
      <Button
        v-for="option in ranges"
        :key="option.days"
        type="button"
        :variant="range === option.days ? 'secondary' : 'outline'"
        :aria-pressed="range === option.days"
        @click="range = option.days"
      >
        {{ option.label }}
      </Button>
    </div>

    <p
      v-if="loading && !data"
      role="status"
      class="text-sm text-muted-foreground"
    >
      Loading insights
    </p>

    <Card
      v-else-if="error"
      class="gap-3 rounded-3xl p-6 text-center"
    >
      <p
        role="alert"
        class="text-base text-destructive"
      >
        {{ error }}
      </p>
      <div>
        <Button
          type="button"
          variant="outline"
          @click="load"
        >
          Try again
        </Button>
      </div>
    </Card>

    <template v-else-if="data">
      <div class="grid gap-3 sm:grid-cols-2">
        <Card class="gap-3 rounded-3xl p-5">
          <StatTile
            label="Profile views"
            :value="number.format(data.profileViews.total)"
          />
          <SparkLine
            :values="viewValues"
            label="Profile views per day"
          />
        </Card>
        <Card class="gap-3 rounded-3xl p-5">
          <StatTile
            label="Members"
            :value="number.format(memberCount)"
          />
          <SparkLine
            :values="memberValues"
            label="Members over time"
          />
        </Card>
      </div>

      <div>
        <h2 class="mb-3 text-sm font-semibold text-muted-foreground">
          Frames
        </h2>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatTile
            label="Campaigns"
            :value="number.format(data.frames.campaigns)"
          />
          <StatTile
            label="Frame views"
            :value="number.format(data.frames.views)"
          />
          <StatTile
            label="Downloads and shares"
            :value="number.format(data.frames.downloads)"
          />
        </div>
      </div>

      <div>
        <h2 class="mb-3 text-sm font-semibold text-muted-foreground">
          Tix
        </h2>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatTile
            label="Events"
            :value="number.format(data.tix.events)"
          />
          <StatTile
            label="Registrations"
            :value="number.format(data.tix.registrations)"
          />
          <StatTile
            label="Check-ins"
            :value="number.format(data.tix.checkIns)"
          />
        </div>
      </div>

      <p class="text-sm text-muted-foreground">
        Profile views and frames are counted in the selected period (Manila time). Events, registrations
        (excluding cancelled and declined) and check-ins are all-time totals.
      </p>

      <Button
        as-child
        variant="outline"
      >
        <router-link :to="`/orgs/${encodeURIComponent(orgId)}`">
          Open the public profile
        </router-link>
      </Button>
    </template>
  </AppPage>
</template>
