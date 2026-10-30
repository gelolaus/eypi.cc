<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import BarList from '@/components/charts/BarList.vue'
import LineChart from '@/components/charts/LineChart.vue'
import StatTile from '@/components/charts/StatTile.vue'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { api } from '@/lib/api'

type Payload = {
  funnel: { visitors: number; photo_added: number; download: number; share: number }
  conversion: number
  totals: { downloadsAndCopies: number }
  perFrame: { frameId: string; label: string; downloads: number }[]
  daily: { day: string; visitors: number; downloads: number; copies: number }[]
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
  { label: 'Visitors', value: data.value?.funnel.visitors ?? 0 },
  { label: 'Photo added', value: data.value?.funnel.photo_added ?? 0 },
  { label: 'Downloaded', value: data.value?.funnel.download ?? 0 },
  { label: 'Copied caption', value: data.value?.funnel.share ?? 0 },
])
const frameItems = computed(() => (data.value?.perFrame ?? []).map((f) => ({ label: f.label, value: f.downloads })))
const trend = computed(() => [
  { label: 'Visitors', points: (data.value?.daily ?? []).map((d) => ({ x: d.day.slice(5), y: d.visitors })) },
  { label: 'Downloads', points: (data.value?.daily ?? []).map((d) => ({ x: d.day.slice(5), y: d.downloads })) },
  { label: 'Copies', points: (data.value?.daily ?? []).map((d) => ({ x: d.day.slice(5), y: d.copies })) },
])
const isEmpty = computed(() => (data.value?.funnel.visitors ?? 0) === 0 && (data.value?.funnel.download ?? 0) === 0)
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
          label="Visitors"
          :value="number.format(data.funnel.visitors)"
        />
        <StatTile
          label="Photo added"
          :value="number.format(data.funnel.photo_added)"
        />
        <StatTile
          label="Downloaded"
          :value="number.format(data.funnel.download)"
        />
        <StatTile
          label="Conversion"
          :value="percent"
        />
      </div>
      <p
        data-insights-note
        class="text-sm text-muted-foreground"
      >
        Counted per visitor per day, so someone who returns on another day counts again. The Frames list counts every download and copy: {{ number.format(data.totals.downloadsAndCopies) }}.
      </p>

      <div>
        <h3 class="mb-3 text-sm font-semibold text-muted-foreground">
          Funnel
        </h3>
        <BarList :items="funnelItems" />
      </div>

      <div>
        <h3 class="mb-3 text-sm font-semibold text-muted-foreground">
          Visitors, downloads and copies per day (Manila time)
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
