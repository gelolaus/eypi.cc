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
          @click="pickPreset(option.days)"
        >
          {{ option.label }}
        </Button>
      </div>
      <div class="mb-3 flex flex-wrap items-end gap-3">
        <label class="flex flex-col gap-1 text-sm text-muted-foreground">
          From
          <input
            :value="fromDate"
            aria-label="From date"
            class="h-11 rounded-md border border-input bg-background px-3 text-base text-foreground"
            type="date"
            @input="onDateInput('from', $event)"
          >
        </label>
        <label class="flex flex-col gap-1 text-sm text-muted-foreground">
          To
          <input
            :value="toDate"
            aria-label="To date"
            class="h-11 rounded-md border border-input bg-background px-3 text-base text-foreground"
            type="date"
            @input="onDateInput('to', $event)"
          >
        </label>
        <label class="flex min-h-11 cursor-pointer items-center gap-2 text-base text-foreground">
          <input
            v-model="compare"
            aria-label="Compare to previous period"
            class="size-5"
            type="checkbox"
          >
          Compare to previous period
        </label>
      </div>
      <p
        v-if="rangeError"
        class="mb-3 text-base text-destructive"
        role="alert"
      >
        {{ rangeError }}
      </p>
      <p
        v-if="isLoading"
        class="text-base text-muted-foreground"
      >
        Loading analytics…
      </p>
      <template v-else-if="analytics">
        <p
          v-if="isEmpty"
          class="mb-6 text-base text-muted-foreground"
        >
          No clicks in this period yet
        </p>
        <Card
          v-if="peakLabel && !isEmpty"
          class="mb-6 border border-primary/30 bg-primary/10 px-4 py-4 font-mono text-base text-foreground"
        >
          <p>Busiest hour: {{ peakLabel }}</p>
        </Card>
        <div class="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          <div
            v-for="tile in tiles"
            :key="tile.label"
          >
            <StatTile
              :label="tile.label"
              :value="tile.value"
              :delta="tile.delta"
            />
            <p
              v-if="tile.isNew"
              class="mt-1 px-1 text-sm text-muted-foreground"
            >
              New
            </p>
          </div>
        </div>
        <template v-if="!isEmpty">
          <h3 class="mb-4 text-sm font-semibold text-muted-foreground">
            Clicks
          </h3>
          <div class="mb-8">
            <LineChart
              :series="timelineSeries"
              y-label="Clicks"
            />
          </div>
          <h3 class="mb-4 text-sm font-semibold text-muted-foreground">
            Clicks by hour of week (Manila time)
          </h3>
          <div class="mb-8">
            <HeatGrid
              :cells="analytics.heat"
              label="Clicks by day of week and hour, Manila time"
            />
          </div>
        </template>
        <div
          v-if="!isEmpty"
          class="grid grid-cols-1 gap-8 md:grid-cols-3"
        >
          <div
            v-for="section in sections"
            :key="section.key"
          >
            <h3 class="mb-3 text-sm font-semibold text-muted-foreground">
              {{ section.title }}
            </h3>
            <BarList
              v-if="section.items.length"
              :items="section.items"
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
          Download all clicks (CSV)
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
        v-else-if="!rangeError"
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
import HeatGrid from '@/components/charts/HeatGrid.vue'
import BarList from '@/components/charts/BarList.vue'
import LineChart from '@/components/charts/LineChart.vue'
import StatTile from '@/components/charts/StatTile.vue'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { api } from '@/lib/api'
import { useFocusTrap } from '@/composables/useFocusTrap'

type TopItem = { value: string; clicks: number }
type Totals = { clicks: number; avgDailyUniques: number; qrShare: number }
type TopDim = 'referrer' | 'app' | 'country' | 'device' | 'browser' | 'os'
type AnalyticsPayload = {
  totals: Totals
  previous?: { totals: Totals }
  timeline: { day: string; clicks: number; uniques: number }[]
  heat: number[]
  top: Record<'referrer' | 'app' | 'country' | 'device' | 'browser' | 'os', TopItem[]>
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
const MAX_DAYS = 400
const DAY_MS = 86_400_000
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const manilaDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' })
const todayManila = () => manilaDay.format(new Date())
const shiftDay = (day: string, delta: number) => new Date(Date.parse(day) + delta * DAY_MS).toISOString().slice(0, 10)
const range = ref<7 | 30 | 90 | 'custom'>(30)
const toDate = ref(todayManila())
const fromDate = ref(shiftDay(toDate.value, -29))
const compare = ref(false)
const isLoading = ref(false)
const analytics = ref<AnalyticsPayload | null>(null)
const downloadError = ref('')
const APP_LABELS: Record<string, string> = {
  messenger: 'Messenger', facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', x: 'X', line: 'LINE', discord: 'Discord',
}

const rangeError = computed(() => {
  const from = fromDate.value
  const to = toDate.value
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) return 'Enter a start and end date'
  if (from > to) return 'Start date must be on or before the end date'
  if (to > todayManila()) return 'End date cannot be in the future'
  if ((Date.parse(to) - Date.parse(from)) / DAY_MS + 1 > MAX_DAYS) return `Range can be at most ${MAX_DAYS} days`
  return ''
})

function pickPreset(days: 7 | 30 | 90) {
  range.value = days
  toDate.value = todayManila()
  fromDate.value = shiftDay(toDate.value, -(days - 1))
}

function onDateInput(which: 'from' | 'to', event: Event) {
  const value = (event.target as HTMLInputElement).value
  if (which === 'from') fromDate.value = value
  else toDate.value = value
  range.value = 'custom'
}

const isEmpty = computed(() => (analytics.value?.totals.clicks ?? 0) === 0)
const ranges = [
  { days: 7 as const, label: 'Last 7 days' },
  { days: 30 as const, label: 'Last 30 days' },
  { days: 90 as const, label: 'Last 90 days' },
]

const peakLabel = computed(() => {
  const heat = analytics.value?.heat ?? []
  const peak = Math.max(0, ...heat)
  if (peak === 0) return ''
  const hour = heat.indexOf(peak) % 24
  const period = hour >= 12 ? 'PM' : 'AM'
  const hour12 = hour % 12 === 0 ? 12 : hour % 12
  return `${hour12}:00 ${period}`
})

const split = (t: Totals) => {
  const qr = Math.round(t.qrShare * t.clicks)
  return { clicks: t.clicks, uniques: t.avgDailyUniques, qr, direct: t.clicks - qr }
}
const pct = (cur: number, prev: number) => (prev > 0 ? ((cur - prev) / prev) * 100 : null)
const tiles = computed(() => {
  const data = analytics.value
  if (!data) return []
  const cur = split(data.totals)
  const prev = compare.value && data.previous ? split(data.previous.totals) : null
  const make = (label: string, key: 'clicks' | 'uniques' | 'qr' | 'direct') => ({
    label,
    value: String(cur[key]),
    delta: prev ? pct(cur[key], prev[key]) : null,
    isNew: prev != null && prev[key] === 0 && cur[key] > 0,
  })
  return [make('Total', 'clicks'), make('Avg daily uniques', 'uniques'), make('QR scans', 'qr'), make('Direct', 'direct')]
})

const timelineSeries = computed(() => [{
  label: 'Clicks',
  points: (analytics.value?.timeline ?? []).map((point) => ({ x: point.day, y: point.clicks })),
}])
const topItems = (dim: TopDim) =>
  (analytics.value?.top[dim] ?? []).slice(0, 5).map((i) => ({
    label: dim === 'app' ? (APP_LABELS[i.value] ?? i.value) : i.value,
    value: i.clicks,
  }))
const sectionDefs: { key: TopDim; title: string }[] = [
  { key: 'os', title: 'Top operating systems' },
  { key: 'country', title: 'Top countries' },
  { key: 'referrer', title: 'Top referrers' },
  { key: 'app', title: 'Source apps' },
  { key: 'device', title: 'Devices' },
  { key: 'browser', title: 'Browsers' },
]
const sections = computed(() => sectionDefs.map((d) => ({ ...d, items: topItems(d.key) })))

let request = 0

async function load() {
  if (!props.isOpen || props.linkId == null) {
    analytics.value = null
    return
  }
  if (rangeError.value) {
    // Drop any response still in flight and the data it would sit beside the error.
    request++
    isLoading.value = false
    analytics.value = null
    return
  }
  const id = ++request
  isLoading.value = true
  downloadError.value = ''
  try {
    const data = await api.get<AnalyticsPayload>(`/api/links/${props.linkId}/analytics?from=${fromDate.value}&to=${toDate.value}${compare.value ? '&compare=1' : ''}`)
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
  pickPreset(30)
  void nextTick(() => trap.activate())
}, { immediate: true })

watch(() => [props.isOpen, props.linkId, fromDate.value, toDate.value, compare.value] as const, () => { void load() }, { immediate: true })
</script>
