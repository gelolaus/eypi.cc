<template>
  <div
    v-if="isOpen"
    class="fixed inset-0"
    style="z-index: 99990"
  >
    <button
      aria-label="Close panel"
      class="absolute inset-0 bg-black/60 outline-none backdrop-blur-sm focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50"
      type="button"
      @click="emit('close')"
    />
    <!-- eslint-disable-next-line vuejs-accessibility/no-static-element-interactions -- dialog handles focus and Escape -->
    <div
      ref="panel"
      aria-labelledby="analytics-panel-title"
      aria-modal="true"
      class="absolute inset-x-0 bottom-0 flex max-h-[92dvh] w-full flex-col overflow-y-auto rounded-t-3xl border-t border-border bg-popover p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-popover-foreground shadow-2xl outline-none sm:inset-x-auto sm:inset-y-0 sm:right-0 sm:h-full sm:max-h-none sm:max-w-2xl sm:rounded-none sm:border-l sm:border-t-0 sm:p-8"
      role="dialog"
      tabindex="-1"
      @keydown.esc.stop="emit('close')"
    >
      <Button
        aria-label="Close"
        class="absolute right-2 top-2 sm:right-5 sm:top-5"
        size="icon"
        variant="ghost"
        type="button"
        @click="emit('close')"
      >
        <X />
      </Button>
      <h2
        id="analytics-panel-title"
        class="mb-2 pr-14 text-2xl font-semibold tracking-tight text-foreground"
      >
        Analytics
      </h2>
      <p class="mb-6 truncate font-mono text-base text-muted-foreground">
        {{ shortUrl }}
      </p>
      <div
        aria-label="Date range"
        class="mb-6 flex flex-wrap gap-2"
        role="group"
      >
        <Button
          v-for="option in ranges"
          :key="option.days"
          :variant="range === option.days ? 'secondary' : 'outline'"
          type="button"
          :aria-label="option.label"
          :aria-pressed="range === option.days"
          @click="range = option.days"
        >
          {{ option.label }}
        </Button>
      </div>
      <p
        v-if="isLoading"
        class="text-base text-muted-foreground"
      >
        Loading analytics…
      </p>
      <template v-else-if="analytics">
        <Card
          v-if="peakLabel"
          class="mb-6 border border-primary/30 bg-primary/10 px-4 py-4 font-mono text-base text-foreground"
        >
          <p>Busiest hour: {{ peakLabel }}</p>
        </Card>
        <div class="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatTile
            v-for="tile in tiles"
            :key="tile.label"
            :label="tile.label"
            :value="tile.value"
          />
        </div>
        <h3 class="mb-4 text-sm font-semibold text-muted-foreground">
          Clicks
        </h3>
        <div class="mb-8">
          <LineChart
            :series="timelineSeries"
            y-label="Clicks"
          />
        </div>
        <div class="grid grid-cols-1 gap-8 md:grid-cols-3">
          <div>
            <h3 class="mb-3 text-sm font-semibold text-muted-foreground">
              Top operating systems
            </h3>
            <BarList
              v-if="topOsItems.length"
              :items="topOsItems"
            />
            <p
              v-else
              class="font-mono text-base text-muted-foreground"
            >
              No data
            </p>
          </div>
          <div>
            <h3 class="mb-3 text-sm font-semibold text-muted-foreground">
              Top countries
            </h3>
            <BarList
              v-if="topCountryItems.length"
              :items="topCountryItems"
            />
            <p
              v-else
              class="font-mono text-base text-muted-foreground"
            >
              No data
            </p>
          </div>
          <div>
            <h3 class="mb-3 text-sm font-semibold text-muted-foreground">
              Top referrers
            </h3>
            <BarList
              v-if="topReferrerItems.length"
              :items="topReferrerItems"
            />
            <p
              v-else
              class="font-mono text-base text-muted-foreground"
            >
              No data
            </p>
          </div>
        </div>
        <Button
          class="mt-8"
          variant="outline"
          type="button"
          @click="downloadCsv"
        >
          Download CSV
        </Button>
        <p
          v-if="downloadError"
          class="mt-2 text-base text-destructive"
          role="alert"
        >
          {{ downloadError }}
        </p>
      </template>
      <p
        v-else
        class="text-base text-muted-foreground"
        role="alert"
      >
        Analytics are unavailable for this link.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { X } from 'lucide-vue-next'
import BarList from '@/components/charts/BarList.vue'
import LineChart from '@/components/charts/LineChart.vue'
import StatTile from '@/components/charts/StatTile.vue'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { api } from '@/lib/api'
import { useFocusTrap } from '@/composables/useFocusTrap'

type AnalyticsPayload = {
  total: number
  unique: number
  qr: number
  direct: number
  timeline: { day: string; clicks: number }[]
  topReferrers: { referrer: string; count: number }[]
  topCountries: { country: string; count: number }[]
  topOs: { os: string; count: number }[]
  peakHour: number | null
}

const props = defineProps<{
  linkId: string | number | null
  isOpen: boolean
  shortUrl: string
}>()

const emit = defineEmits<{
  close: []
}>()

const panel = ref<HTMLElement | null>(null)
const trap = useFocusTrap(panel)
const range = ref<7 | 30 | 90>(30)
const isLoading = ref(false)
const analytics = ref<AnalyticsPayload | null>(null)
const downloadError = ref('')
const ranges = [
  { days: 7 as const, label: 'Last 7 days' },
  { days: 30 as const, label: 'Last 30 days' },
  { days: 90 as const, label: 'Last 90 days' },
]

const peakLabel = computed(() => {
  const hour = analytics.value?.peakHour
  if (typeof hour !== 'number' || !Number.isFinite(hour)) return ''
  const period = hour >= 12 ? 'PM' : 'AM'
  const hour12 = hour % 12 === 0 ? 12 : hour % 12
  return `${hour12}:00 ${period}`
})

const tiles = computed(() => {
  const data = analytics.value
  if (!data) return []
  return [
    { label: 'Total', value: String(data.total) },
    { label: 'Unique visitors', value: String(data.unique) },
    { label: 'QR scans', value: String(data.qr) },
    { label: 'Direct', value: String(data.direct) },
  ]
})

const timelineSeries = computed(() => [{
  label: 'Clicks',
  points: (analytics.value?.timeline ?? []).map((point) => ({ x: point.day, y: point.clicks })),
}])
const topOsItems = computed(() => (analytics.value?.topOs ?? []).map((i) => ({ label: i.os, value: i.count })))
const topCountryItems = computed(() => (analytics.value?.topCountries ?? []).map((i) => ({ label: i.country, value: i.count })))
const topReferrerItems = computed(() => (analytics.value?.topReferrers ?? []).map((i) => ({ label: i.referrer, value: i.count })))

let request = 0

async function load() {
  if (!props.isOpen || props.linkId == null) {
    analytics.value = null
    return
  }
  const id = ++request
  isLoading.value = true
  downloadError.value = ''
  try {
    const data = await api.get<AnalyticsPayload>(`/api/links/${props.linkId}/analytics?range=${range.value}`)
    if (id === request) analytics.value = data
  } catch {
    if (id === request) analytics.value = null
  } finally {
    if (id === request) isLoading.value = false
  }
}

async function downloadCsv() {
  if (props.linkId == null) return
  downloadError.value = ''
  try {
    const res = await api.raw(`/api/links/${props.linkId}/analytics.csv`)
    if (!res.ok) {
      downloadError.value = 'Could not download analytics.'
      return
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'analytics.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  } catch {
    downloadError.value = 'Could not download analytics.'
  }
}

watch(() => props.isOpen, (open) => {
  if (!open) {
    trap.release()
    return
  }
  void nextTick(() => trap.activate())
}, { immediate: true })

watch(() => [props.isOpen, props.linkId, range.value] as const, () => { void load() }, { immediate: true })
</script>
