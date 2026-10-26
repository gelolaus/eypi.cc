<template>
  <div
    v-if="isOpen"
    class="fixed inset-0"
    style="z-index: 99990"
  >
    <button
      aria-label="Close panel"
      class="absolute inset-0 bg-slate-900/20 backdrop-blur-sm dark:bg-slate-900/80"
      type="button"
      @click="emit('close')"
    />
    <!-- eslint-disable-next-line vuejs-accessibility/no-static-element-interactions -- dialog handles focus and Escape -->
    <div
      ref="panel"
      aria-labelledby="analytics-panel-title"
      aria-modal="true"
      class="absolute right-0 top-0 flex h-full max-h-screen w-[95vw] flex-col overflow-y-auto border-l border-gray-200 bg-white/95 p-8 shadow-2xl dark:border-slate-700/50 dark:bg-slate-900/95 md:max-w-2xl"
      role="dialog"
      tabindex="-1"
      @keydown.esc.stop="emit('close')"
    >
      <button
        aria-label="Close"
        class="absolute right-6 top-6 text-2xl text-slate-600 hover:text-slate-900 dark:text-slate-400"
        type="button"
        @click="emit('close')"
      >
        &times;
      </button>
      <h2
        id="analytics-panel-title"
        class="text-section-title mb-2 text-slate-900 dark:text-slate-100"
      >
        Analytics
      </h2>
      <p class="text-data mb-6 truncate text-sm text-slate-600 dark:text-slate-400">
        {{ shortUrl }}
      </p>
      <div
        aria-label="Date range"
        class="mb-6 flex flex-wrap gap-2"
        role="group"
      >
        <button
          v-for="option in ranges"
          :key="option.days"
          class="rounded-full border border-g-border px-3 py-1.5 text-sm"
          type="button"
          :aria-label="option.label"
          :aria-pressed="range === option.days"
          @click="range = option.days"
        >
          {{ option.label }}
        </button>
      </div>
      <p
        v-if="isLoading"
        class="text-sm text-g-muted"
      >
        Loading analytics…
      </p>
      <template v-else-if="analytics">
        <p
          v-if="peakLabel"
          class="mica-card mb-6 rounded-xl border border-eypi-gold/30 bg-eypi-gold/10 p-4 font-mono text-sm text-slate-900 dark:text-slate-200"
        >
          Busiest hour: {{ peakLabel }}
        </p>
        <dl class="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          <div>
            <dt class="text-xs text-g-muted">
              Total
            </dt>
            <dd class="font-mono text-2xl text-g-text">
              {{ analytics.total }}
            </dd>
          </div>
          <div>
            <dt class="text-xs text-g-muted">
              Unique visitors
            </dt>
            <dd class="font-mono text-2xl text-g-text">
              {{ analytics.unique }}
            </dd>
          </div>
          <div>
            <dt class="text-xs text-g-muted">
              QR scans
            </dt>
            <dd class="font-mono text-2xl text-g-text">
              {{ analytics.qr }}
            </dd>
          </div>
          <div>
            <dt class="text-xs text-g-muted">
              Direct
            </dt>
            <dd class="font-mono text-2xl text-g-text">
              {{ analytics.direct }}
            </dd>
          </div>
        </dl>
        <h3 class="mb-4 font-mono text-xs font-bold text-slate-600 dark:text-slate-400">
          Clicks
        </h3>
        <div class="mb-8 h-48">
          <Line
            v-if="chartData"
            :data="chartData"
            :options="chartOptions"
          />
        </div>
        <div class="grid grid-cols-1 gap-8 md:grid-cols-3">
          <div>
            <h3 class="mb-3 font-mono text-xs font-bold text-slate-600 dark:text-slate-400">
              Top operating systems
            </h3>
            <ul
              v-if="analytics.topOs.length"
              class="space-y-2"
            >
              <li
                v-for="item in analytics.topOs"
                :key="item.os"
                class="flex justify-between gap-2 font-mono text-sm text-slate-900 dark:text-slate-300"
              >
                <span class="min-w-0 break-words">{{ item.os }}</span>
                <span class="shrink-0 text-slate-600 dark:text-slate-400">{{ item.count }}</span>
              </li>
            </ul>
            <p
              v-else
              class="font-mono text-sm text-slate-500"
            >
              No data
            </p>
          </div>
          <div>
            <h3 class="mb-3 font-mono text-xs font-bold text-slate-600 dark:text-slate-400">
              Top countries
            </h3>
            <ul
              v-if="analytics.topCountries.length"
              class="space-y-2"
            >
              <li
                v-for="item in analytics.topCountries"
                :key="item.country"
                class="flex justify-between gap-2 font-mono text-sm text-slate-900 dark:text-slate-300"
              >
                <span class="min-w-0 break-words">{{ item.country }}</span>
                <span class="shrink-0 text-slate-600 dark:text-slate-400">{{ item.count }}</span>
              </li>
            </ul>
            <p
              v-else
              class="font-mono text-sm text-slate-500"
            >
              No data
            </p>
          </div>
          <div>
            <h3 class="mb-3 font-mono text-xs font-bold text-slate-600 dark:text-slate-400">
              Top referrers
            </h3>
            <ul
              v-if="analytics.topReferrers.length"
              class="space-y-2"
            >
              <li
                v-for="item in analytics.topReferrers"
                :key="item.referrer"
                class="flex justify-between gap-2 font-mono text-sm text-slate-900 dark:text-slate-300"
              >
                <span class="min-w-0 break-words">{{ item.referrer }}</span>
                <span class="shrink-0 text-slate-600 dark:text-slate-400">{{ item.count }}</span>
              </li>
            </ul>
            <p
              v-else
              class="font-mono text-sm text-slate-500"
            >
              No data
            </p>
          </div>
        </div>
        <button
          class="mt-8 rounded-lg border-2 border-g-primary px-4 py-2 text-sm font-semibold text-g-primary dark:border-slate-400 dark:text-slate-200"
          type="button"
          @click="downloadCsv"
        >
          Download CSV
        </button>
        <p
          v-if="downloadError"
          class="mt-2 text-sm text-red-500"
          role="alert"
        >
          {{ downloadError }}
        </p>
      </template>
      <p
        v-else
        class="text-sm text-g-muted"
        role="alert"
      >
        Analytics are unavailable for this link.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js'
import { Line } from 'vue-chartjs'
import { api } from '@/lib/api'
import { useDarkMode } from '@/composables/useDarkMode'
import { useFocusTrap } from '@/composables/useFocusTrap'

ChartJS.register(Title, Tooltip, Legend, LineElement, PointElement, CategoryScale, LinearScale, Filler)

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

const { isDark } = useDarkMode()
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

const chartData = computed(() => {
  const timeline = analytics.value?.timeline
  if (!timeline) return null
  return {
    labels: timeline.map((point) => point.day),
    datasets: [{
      label: 'Clicks',
      data: timeline.map((point) => point.clicks),
      borderColor: '#c9a84c',
      backgroundColor: 'rgba(201, 168, 76, 0.2)',
      fill: true,
      tension: 0.3,
    }],
  }
})

const chartOptions = computed(() => {
  const textColor = isDark.value ? '#cbd5e1' : '#64748b'
  const gridColor = isDark.value ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { maxTicksLimit: 8, color: textColor } },
      y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor } },
    },
  }
})

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
