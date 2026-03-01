<template>
  <Teleport to="body">
  <!-- Backdrop -->
  <Transition name="fade">
    <div
      v-if="isOpen"
      class="fixed inset-0 bg-slate-900/80 backdrop-blur-sm"
      style="z-index: 99990"
      aria-hidden="true"
      @click="$emit('close')"
    />
  </Transition>

  <!-- Slide-over Panel -->
  <Transition name="slide-right">
    <div
      v-if="isOpen"
      class="fixed top-0 right-0 flex h-full max-h-screen w-[95vw] md:max-w-2xl flex-col overflow-y-auto bg-slate-900/95 backdrop-blur-xl border-l border-slate-700/50 p-8 shadow-2xl"
      style="z-index: 99991"
    >
      <button
        type="button"
        class="absolute right-6 top-6 font-mono text-2xl text-slate-400 transition-colors hover:text-slate-200"
        aria-label="Close"
        @click="$emit('close')"
      >
        &times;
      </button>

      <h2 class="mb-2 font-mono text-2xl font-black uppercase tracking-widest text-slate-200">
        Analytics
      </h2>
      <p class="mb-8 font-mono text-sm text-slate-400 truncate">
        {{ shortUrl }}
      </p>

      <!-- Loading State -->
      <template v-if="isLoading">
        <div class="space-y-6">
          <div class="h-48 rounded-xl bg-slate-800/60 animate-pulse" />
          <div class="grid grid-cols-1 gap-8 md:grid-cols-3">
            <div class="h-32 rounded-lg bg-slate-800/60 animate-pulse" />
            <div class="h-32 rounded-lg bg-slate-800/60 animate-pulse" />
            <div class="h-32 rounded-lg bg-slate-800/60 animate-pulse" />
          </div>
        </div>
      </template>

      <!-- Content -->
      <template v-else-if="analyticsData">
        <!-- Peak Engagement Quick Insight -->
        <div
          v-if="formattedPeak"
          class="mica-card mb-6 rounded-xl border border-eypi-gold/30 bg-eypi-gold/10 p-4"
        >
          <p class="font-mono text-sm text-slate-200">
            <span class="text-eypi-gold">&#128293;</span>
            <strong>Peak Engagement:</strong> Most clicks happen on <strong>{{ formattedPeak.day }}</strong> at <strong>{{ formattedPeak.time }}</strong>.
          </p>
        </div>

        <!-- Timeline Line Chart -->
        <div class="mb-8">
          <h4 class="mb-4 font-mono text-xs font-bold text-slate-400 uppercase tracking-widest">
            Clicks (Last 30 Days)
          </h4>
          <div class="h-48">
            <Line
              v-if="chartData"
              :data="chartData"
              :options="chartOptions"
            />
          </div>
        </div>

        <!-- Secondary Data Grid -->
        <div class="grid grid-cols-1 gap-8 md:grid-cols-3">
          <!-- Top OS -->
          <div>
            <h4 class="mb-3 font-mono text-xs font-bold text-slate-400 uppercase tracking-widest">
              Top OS
            </h4>
            <ul v-if="displayOs.length" class="space-y-2">
              <li
                v-for="item in displayOs"
                :key="item.os"
                class="flex flex-col gap-1"
              >
                <div class="flex justify-between items-baseline gap-2 font-mono text-base">
                  <span class="text-slate-300 min-w-0 break-words">{{ item.os || 'Unknown' }}</span>
                  <span class="text-slate-400 shrink-0">{{ item.count }} clicks</span>
                </div>
                <div class="h-1.5 w-full overflow-hidden rounded-full bg-slate-700/50">
                  <div
                    class="h-full rounded-full bg-[#c9a84c] transition-all duration-300"
                    :style="{ width: `${item.percent}%` }"
                  />
                </div>
              </li>
            </ul>
            <p v-else class="font-mono text-sm text-slate-500">No data</p>
          </div>

          <!-- Top Country -->
          <div>
            <h4 class="mb-3 font-mono text-xs font-bold text-slate-400 uppercase tracking-widest">
              Top Country
            </h4>
            <ul v-if="displayCountry.length" class="space-y-2">
              <li
                v-for="item in displayCountry"
                :key="item.country"
                class="flex flex-col gap-1"
              >
                <div class="flex justify-between items-baseline gap-2 font-mono text-base">
                  <span class="text-slate-300 min-w-0 break-words">{{ item.country || 'Unknown' }}</span>
                  <span class="text-slate-400 shrink-0">{{ item.count }} clicks</span>
                </div>
                <div class="h-1.5 w-full overflow-hidden rounded-full bg-slate-700/50">
                  <div
                    class="h-full rounded-full bg-[#c9a84c] transition-all duration-300"
                    :style="{ width: `${item.percent}%` }"
                  />
                </div>
              </li>
            </ul>
            <p v-else class="font-mono text-sm text-slate-500">No data</p>
          </div>

          <!-- Top Referrers -->
          <div>
            <h4 class="mb-3 font-mono text-xs font-bold text-slate-400 uppercase tracking-widest">
              Top Referrers
            </h4>
            <ul v-if="displayReferrer.length" class="space-y-2">
              <li
                v-for="item in displayReferrer"
                :key="item.referrer"
                class="flex flex-col gap-1"
              >
                <div class="flex justify-between items-baseline gap-2 font-mono text-base">
                  <span class="text-slate-300 min-w-0 break-words">{{ item.display }}</span>
                  <span class="text-slate-400 shrink-0">{{ item.count }} clicks</span>
                </div>
                <div class="h-1.5 w-full overflow-hidden rounded-full bg-slate-700/50">
                  <div
                    class="h-full rounded-full bg-[#c9a84c] transition-all duration-300"
                    :style="{ width: `${item.percent}%` }"
                  />
                </div>
              </li>
            </ul>
            <p v-else class="font-mono text-sm text-slate-500">No data</p>
          </div>
        </div>
      </template>
    </div>
  </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Filler,
} from 'chart.js'
import { Line } from 'vue-chartjs'

ChartJS.register(
  Title,
  Tooltip,
  Legend,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Filler
)
ChartJS.defaults.color = '#cbd5e1'

const props = defineProps<{
  linkId: string | number | null
  isOpen: boolean
  shortUrl: string
}>()

defineEmits<{
  close: []
}>()

const isLoading = ref(false)
const analyticsData = ref<{
  os: { os: string; count: number }[]
  country: { country: string; count: number }[]
  referrer: { referrer: string; count: number }[]
  timeline: { date: string; count: number }[]
  peakEngagement?: { peakDay: string; peakHour: string; count: number } | null
} | null>(null)

const API_BASE = 'https://api.eypi.cc'

/** Generate last 30 days as YYYY-MM-DD strings */
function getLast30Dates(): string[] {
  const dates: string[] = []
  const now = new Date()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    dates.push(d.toISOString().slice(0, 10))
  }
  return dates
}

/** Zero-fill timeline: map API response onto last 30 days, missing dates get 0 */
function zeroFillTimeline(
  raw: { date: string; count: number }[]
): { date: string; count: number }[] {
  const map = new Map(raw.map((r) => [r.date, r.count]))
  return getLast30Dates().map((date) => ({
    date,
    count: map.get(date) ?? 0,
  }))
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** Format peakEngagement for display: day name + 12-hour time */
function formatPeakEngagement(peak: { peakDay: string; peakHour: string; count: number } | null): { day: string; time: string } | null {
  if (!peak) return null
  const dayIdx = parseInt(peak.peakDay, 10)
  const day = DAY_NAMES[dayIdx] ?? 'Unknown'
  const hour = parseInt(peak.peakHour, 10)
  const isPM = hour >= 12
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  const time = `${hour12}:00 ${isPM ? 'PM' : 'AM'}`
  return { day, time }
}

/** Clean referrer: strip protocol, www, path -> root domain only. Empty/null -> (Direct) */
function cleanReferrer(ref: string | null | undefined): string {
  if (ref == null || ref === '') return '(Direct)'
  try {
    let s = ref.trim()
    s = s.replace(/^https?:\/\//i, '')
    s = s.replace(/^www\./i, '')
    const slash = s.indexOf('/')
    if (slash !== -1) s = s.slice(0, slash)
    const q = s.indexOf('?')
    if (q !== -1) s = s.slice(0, q)
    return s || '(Direct)'
  } catch {
    return '(Direct)'
  }
}

const chartData = computed(() => {
  const data = analyticsData.value
  if (!data) return null
  const filled = zeroFillTimeline(data.timeline ?? [])
  return {
    labels: filled.map((t) => t.date),
    datasets: [
      {
        label: 'Clicks',
        data: filled.map((t) => t.count),
        borderColor: '#c9a84c',
        backgroundColor: 'rgba(201, 168, 76, 0.2)',
        fill: true,
        tension: 0.3,
      },
    ],
  }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: 'rgba(15, 23, 42, 0.95)',
      titleColor: '#cbd5e1',
      bodyColor: '#cbd5e1',
      borderColor: 'rgba(148, 163, 184, 0.3)',
      borderWidth: 1,
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { maxTicksLimit: 8, color: '#cbd5e1' },
    },
    y: {
      grid: { color: 'rgba(255,255,255,0.05)' },
      ticks: { color: '#cbd5e1' },
      beginAtZero: true,
    },
  },
}

const displayOs = computed(() => {
  const data = analyticsData.value?.os ?? []
  const max = Math.max(...data.map((d) => d.count), 1)
  return data
    .slice(0, 5)
    .map((d) => ({ ...d, percent: (d.count / max) * 100 }))
})

const displayCountry = computed(() => {
  const data = analyticsData.value?.country ?? []
  const max = Math.max(...data.map((d) => d.count), 1)
  return data
    .slice(0, 5)
    .map((d) => ({ ...d, percent: (d.count / max) * 100 }))
})

const formattedPeak = computed(() =>
  formatPeakEngagement(analyticsData.value?.peakEngagement ?? null)
)

const displayReferrer = computed(() => {
  const data = analyticsData.value?.referrer ?? []
  const max = Math.max(...data.map((d) => d.count), 1)
  return data.slice(0, 5).map((d) => ({
    ...d,
    display: cleanReferrer(d.referrer),
    percent: (d.count / max) * 100,
  }))
})

watch(
  () => [props.isOpen, props.linkId] as const,
  async ([open, linkId]) => {
    if (!open || linkId == null) {
      analyticsData.value = null
      return
    }
    isLoading.value = true
    analyticsData.value = null
    const token = localStorage.getItem('eypi_token')
    if (!token) {
      isLoading.value = false
      return
    }
    try {
      const res = await fetch(`${API_BASE}/api/links/${linkId}/analytics`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.status === 401) {
        isLoading.value = false
        return
      }
      const data = await res.json()
      analyticsData.value = data
    } catch {
      analyticsData.value = null
    } finally {
      isLoading.value = false
    }
  },
  { immediate: true }
)
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-right-enter-active,
.slide-right-leave-active {
  transition: transform 0.4s cubic-bezier(0.2, 1, 0.3, 1);
}
.slide-right-enter-from,
.slide-right-leave-to {
  transform: translateX(100%);
}
</style>
