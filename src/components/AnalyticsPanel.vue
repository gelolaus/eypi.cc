<template>
  <Teleport to="body">
  <!-- Backdrop -->
  <Transition name="fade">
    <div
      v-if="isOpen"
      class="fixed inset-0 bg-slate-900/20 dark:bg-slate-900/80 backdrop-blur-sm"
      style="z-index: 99990"
      aria-hidden="true"
      @click="$emit('close')"
    />
  </Transition>

  <!-- Slide-over Panel -->
  <Transition name="slide-right">
    <div
      v-if="isOpen"
      role="dialog"
      aria-labelledby="analytics-panel-title"
      aria-modal="true"
      class="fixed top-0 right-0 flex h-full max-h-screen w-[95vw] flex-col overflow-y-auto border-l border-g-border bg-g-surface p-8 shadow-2xl md:max-w-2xl"
      style="z-index: 99991"
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="absolute right-4 top-4 !min-h-[44px] !min-w-[44px] !rounded-full !px-0 text-2xl leading-none"
        aria-label="Close"
        @click="$emit('close')"
      >
        &times;
      </Button>

      <h2 id="analytics-panel-title" class="mb-2 font-display text-2xl font-semibold text-g-text">
        Analytics
      </h2>
      <p class="mb-8 truncate text-sm text-g-muted">
        {{ shortUrl }}
      </p>

      <!-- Loading State -->
      <template v-if="isLoading">
        <div class="space-y-6">
          <div class="h-48 animate-pulse rounded-xl bg-g-bg" />
          <div class="grid grid-cols-1 gap-8 md:grid-cols-3">
            <div class="h-32 animate-pulse rounded-lg bg-g-bg" />
            <div class="h-32 animate-pulse rounded-lg bg-g-bg" />
            <div class="h-32 animate-pulse rounded-lg bg-g-bg" />
          </div>
        </div>
      </template>

      <!-- Content -->
      <template v-else-if="analyticsData">
        <!-- Peak Engagement Quick Insight -->
        <div
          v-if="formattedPeak"
          class="mb-6 rounded-xl border border-g-primary/30 bg-g-primary/10 p-4"
        >
          <p class="text-sm text-g-text">
            <strong>Busiest time:</strong> <strong>{{ formattedPeak.day }}</strong> at <strong>{{ formattedPeak.time }}</strong>.
          </p>
        </div>

        <!-- Timeline Line Chart -->
        <div class="mb-8">
          <h4 class="mb-4 text-xs font-bold uppercase tracking-widest text-g-muted">
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
            <h4 class="mb-3 text-xs font-bold uppercase tracking-widest text-g-muted">
              Top OS
            </h4>
            <ul v-if="displayOs.length" class="space-y-2">
              <li
                v-for="item in displayOs"
                :key="item.os"
                class="flex flex-col gap-1"
              >
                <div class="flex items-baseline justify-between gap-2 font-mono text-base">
                  <span class="min-w-0 break-words text-g-text">{{ item.os || 'Unknown' }}</span>
                  <span class="shrink-0 text-g-muted">{{ item.count }} clicks</span>
                </div>
                <div class="h-1.5 w-full overflow-hidden rounded-full bg-g-bg">
                  <div
                    class="h-full rounded-full bg-[#DEAC4B] transition-all duration-300"
                    :style="{ width: `${item.percent}%` }"
                  />
                </div>
              </li>
            </ul>
            <p v-else class="text-sm text-g-muted">No data</p>
          </div>

          <!-- Top Country -->
          <div>
            <h4 class="mb-3 text-xs font-bold uppercase tracking-widest text-g-muted">
              Top Country
            </h4>
            <ul v-if="displayCountry.length" class="space-y-2">
              <li
                v-for="item in displayCountry"
                :key="item.country"
                class="flex flex-col gap-1"
              >
                <div class="flex items-baseline justify-between gap-2 font-mono text-base">
                  <span class="min-w-0 break-words text-g-text">{{ item.country || 'Unknown' }}</span>
                  <span class="shrink-0 text-g-muted">{{ item.count }} clicks</span>
                </div>
                <div class="h-1.5 w-full overflow-hidden rounded-full bg-g-bg">
                  <div
                    class="h-full rounded-full bg-[#DEAC4B] transition-all duration-300"
                    :style="{ width: `${item.percent}%` }"
                  />
                </div>
              </li>
            </ul>
            <p v-else class="text-sm text-g-muted">No data</p>
          </div>

          <!-- Top Referrers -->
          <div>
            <h4 class="mb-3 text-xs font-bold uppercase tracking-widest text-g-muted">
              Top Referrers
            </h4>
            <ul v-if="displayReferrer.length" class="space-y-2">
              <li
                v-for="item in displayReferrer"
                :key="item.referrer"
                class="flex flex-col gap-1"
              >
                <div class="flex items-baseline justify-between gap-2 font-mono text-base">
                  <span class="min-w-0 break-words text-g-text">{{ item.display }}</span>
                  <span class="shrink-0 text-g-muted">{{ item.count }} clicks</span>
                </div>
                <div class="h-1.5 w-full overflow-hidden rounded-full bg-g-bg">
                  <div
                    class="h-full rounded-full bg-[#DEAC4B] transition-all duration-300"
                    :style="{ width: `${item.percent}%` }"
                  />
                </div>
              </li>
            </ul>
            <p v-else class="text-sm text-g-muted">No data</p>
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
import { useDarkMode } from '@/composables/useDarkMode'
import { API_BASE_URL } from '@/config/api'
import Button from '@/components/ui/Button.vue'

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

const { isDark } = useDarkMode()

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

const REFERRER_LABELS: Record<string, string> = {
  // Normalized names stored by backend (new data)
  'localhost': 'Localhost',
  'eypi': 'Eypi',
  'facebook': 'Facebook',
  'instagram': 'Instagram',
  'twitter / x': 'Twitter / X',
  'tiktok': 'TikTok',
  'youtube': 'YouTube',
  'reddit': 'Reddit',
  'linkedin': 'LinkedIn',
  'pinterest': 'Pinterest',
  'snapchat': 'Snapchat',
  'whatsapp': 'WhatsApp',
  'telegram': 'Telegram',
  'discord': 'Discord',
  'threads': 'Threads',
  'google': 'Google',
  'gmail': 'Gmail',
  'viber': 'Viber',
  'twitch': 'Twitch',
  'github': 'GitHub',
  'medium': 'Medium',
  'substack': 'Substack',
  'notion': 'Notion',
  'bereal': 'BeReal',
  // Legacy raw hostnames in old DB rows
  'localhost:5173': 'Localhost',
  'eypi.cc': 'Eypi',
  'facebook.com': 'Facebook',
  'm.facebook.com': 'Facebook',
  'l.facebook.com': 'Facebook',
  'lm.facebook.com': 'Facebook',
  'fb.me': 'Facebook',
  'fb.com': 'Facebook',
  'web.facebook.com': 'Facebook',
  'instagram.com': 'Instagram',
  'l.instagram.com': 'Instagram',
  'twitter.com': 'Twitter / X',
  'x.com': 'Twitter / X',
  't.co': 'Twitter / X',
  'tiktok.com': 'TikTok',
  'vm.tiktok.com': 'TikTok',
  'vt.tiktok.com': 'TikTok',
  'youtube.com': 'YouTube',
  'youtu.be': 'YouTube',
  'm.youtube.com': 'YouTube',
  'reddit.com': 'Reddit',
  'redd.it': 'Reddit',
  'old.reddit.com': 'Reddit',
  'linkedin.com': 'LinkedIn',
  'lnkd.in': 'LinkedIn',
  'pinterest.com': 'Pinterest',
  'pin.it': 'Pinterest',
  'pinterest.ph': 'Pinterest',
  'snapchat.com': 'Snapchat',
  't.snapchat.com': 'Snapchat',
  'whatsapp.com': 'WhatsApp',
  'wa.me': 'WhatsApp',
  'web.whatsapp.com': 'WhatsApp',
  'telegram.org': 'Telegram',
  't.me': 'Telegram',
  'web.telegram.org': 'Telegram',
  'discord.com': 'Discord',
  'discord.gg': 'Discord',
  'ptb.discord.com': 'Discord',
  'threads.net': 'Threads',
  'l.threads.net': 'Threads',
  'google.com': 'Google',
  'google.com.ph': 'Google',
  'google.co': 'Google',
  'mail.google.com': 'Gmail',
  'viber.com': 'Viber',
  'twitch.tv': 'Twitch',
  'github.com': 'GitHub',
  'medium.com': 'Medium',
  'substack.com': 'Substack',
  'notion.so': 'Notion',
  'notion.site': 'Notion',
  'bere.al': 'BeReal',
  'bereal.com': 'BeReal',
}

/** Map a stored referrer value to a human-readable label. Handles backend friendly
 *  names, legacy raw hostnames, and accidental full URLs stored in old DB rows. */
function cleanReferrer(ref: string | null | undefined): string {
  if (ref == null || ref === '' || ref === 'Direct') return '(Direct)'
  let key = ref.trim()
  // If an old DB row stored a full URL, extract just the hostname
  if (/^https?:\/\//i.test(key)) {
    try {
      key = new URL(key).hostname.toLowerCase().replace(/^www\./, '')
    } catch { /* fall through */ }
  }
  const lower = key.toLowerCase()
  if (REFERRER_LABELS[lower]) return REFERRER_LABELS[lower]
  // localhost with any port
  if (lower.startsWith('localhost')) return 'Localhost'
  // Strip www. for any unrecognized hostname and return as-is
  return key.replace(/^www\./i, '') || '(Direct)'
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
        borderColor: '#DEAC4B',
        backgroundColor: 'rgba(222, 172, 75, 0.2)',
        fill: true,
        tension: 0.3,
      },
    ],
  }
})

const chartOptions = computed(() => {
  const textColor = isDark.value ? '#cbd5e1' : '#64748b'
  const gridColor = isDark.value ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'
  const tooltipBg = isDark.value ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)'
  const tooltipText = isDark.value ? '#cbd5e1' : '#334155'
  const tooltipBorder = isDark.value ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.5)'
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: tooltipBg,
        titleColor: tooltipText,
        bodyColor: tooltipText,
        borderColor: tooltipBorder,
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { maxTicksLimit: 8, color: textColor },
      },
      y: {
        grid: { color: gridColor },
        ticks: { color: textColor },
        beginAtZero: true,
      },
    },
  }
})

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
      const res = await fetch(`${API_BASE_URL}/api/links/${linkId}/analytics`, {
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
