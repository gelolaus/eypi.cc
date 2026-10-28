<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import BarList from '@/components/charts/BarList.vue'
import LineChart from '@/components/charts/LineChart.vue'
import StatTile from '@/components/charts/StatTile.vue'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { api } from '@/lib/api'

type Payload = {
  funnel: { view: number; photo_added: number; downloadOrShare: number }
  conversion: number
  perFrame: { frameId: string; label: string; downloads: number }[]
  daily: { day: string; views: number; downloads: number }[]
}

const props = defineProps<{ campaignId: string; publicPath: string }>()

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
    const next = await api.get<Payload>(`/api/dp/${props.campaignId}/insights?days=${range.value}`)
    if (current === requestId) data.value = next
  } catch {
    if (current === requestId) error.value = 'Could not load insights. Check your connection and try again.'
  } finally {
    if (current === requestId) loading.value = false
  }
}

watch(() => [props.campaignId, range.value], () => { if (props.campaignId) void load() }, { immediate: true })

const number = new Intl.NumberFormat('en-PH')
const percent = computed(() => `${Math.round((data.value?.conversion ?? 0) * 1000) / 10}%`)
const funnelItems = computed(() => [
  { label: 'Page views', value: data.value?.funnel.view ?? 0 },
  { label: 'Photo added', value: data.value?.funnel.photo_added ?? 0 },
  { label: 'Downloaded or shared', value: data.value?.funnel.downloadOrShare ?? 0 },
])
const frameItems = computed(() => (data.value?.perFrame ?? []).map((f) => ({ label: f.label, value: f.downloads })))
const trend = computed(() => [
  { label: 'Views', points: (data.value?.daily ?? []).map((d) => ({ x: d.day.slice(5), y: d.views })) },
  { label: 'Downloads', points: (data.value?.daily ?? []).map((d) => ({ x: d.day.slice(5), y: d.downloads })) },
])
const isEmpty = computed(() => (data.value?.funnel.view ?? 0) === 0 && (data.value?.funnel.downloadOrShare ?? 0) === 0)
</script>

<template>
  <section
    class="space-y-6"
    aria-label="Frames insights"
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

    <Card
      v-else-if="data && isEmpty"
      class="items-center gap-4 rounded-3xl p-8 text-center"
    >
      <p class="text-base text-muted-foreground">
        No visits in this period yet. Share the campaign page to start collecting numbers.
      </p>
      <Button as-child>
        <router-link :to="publicPath">
          Open the campaign page
        </router-link>
      </Button>
    </Card>

    <template v-else-if="data">
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="Page views"
          :value="number.format(data.funnel.view)"
        />
        <StatTile
          label="Photo added"
          :value="number.format(data.funnel.photo_added)"
        />
        <StatTile
          label="Downloaded or shared"
          :value="number.format(data.funnel.downloadOrShare)"
        />
        <StatTile
          label="Conversion"
          :value="percent"
        />
      </div>

      <div>
        <h3 class="mb-3 text-sm font-semibold text-muted-foreground">
          Funnel
        </h3>
        <BarList :items="funnelItems" />
      </div>

      <div>
        <h3 class="mb-3 text-sm font-semibold text-muted-foreground">
          Views and downloads per day (Manila time)
        </h3>
        <LineChart
          :series="trend"
          y-label="Events"
        />
      </div>

      <div v-if="frameItems.length">
        <h3 class="mb-3 text-sm font-semibold text-muted-foreground">
          Downloads per frame
        </h3>
        <BarList :items="frameItems" />
      </div>
    </template>
  </section>
</template>
