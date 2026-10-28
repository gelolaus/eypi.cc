<template>
  <section aria-labelledby="speed-heading">
    <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2
        id="speed-heading"
        class="font-heading text-xl font-semibold tracking-tight"
      >
        Real-user speed
      </h2>
      <div
        class="flex gap-2"
        role="group"
        aria-label="Time range"
      >
        <Button
          v-for="d in [7, 28]"
          :key="d"
          size="sm"
          :variant="days === d ? 'secondary' : 'outline'"
          :aria-pressed="days === d"
          @click="setDays(d)"
        >
          {{ d }} days
        </Button>
      </div>
    </div>

    <p
      v-if="error"
      role="alert"
      class="text-sm text-destructive"
    >
      {{ error }}
    </p>
    <div
      v-else-if="loading && !data"
      role="status"
      aria-busy="true"
      class="grid grid-cols-2 gap-3 md:grid-cols-5"
    >
      <span class="sr-only">Loading speed data</span>
      <Skeleton
        v-for="n in 5"
        :key="n"
        :h="126"
        :radius="16"
      />
    </div>
    <p
      v-else-if="data && data.rows.length === 0"
      class="text-sm text-muted-foreground"
    >
      No speed data for this period yet.
    </p>

    <template v-if="data && data.rows.length > 0">
      <div class="grid grid-cols-2 gap-3 md:grid-cols-5">
        <div
          v-for="tile in tiles"
          :key="tile.metric"
          data-testid="speed-tile"
        >
          <StatTile
            :label="tile.metric"
            :value="tile.display"
          />
          <p class="mt-1 flex items-center gap-2 px-1 text-sm">
            <span class="font-medium">{{ tile.status }}</span>
            <SparkLine
              :values="tile.trend"
              :label="`${tile.metric} trend`"
            />
          </p>
        </div>
      </div>

      <h3 class="mb-2 mt-8 font-heading text-lg font-semibold">
        Slowest pages by LCP
      </h3>
      <BarList :items="slowest" />
    </template>
  </section>
</template>

<script setup lang="ts">
import Skeleton from '@/components/ui/Skeleton.vue'
import { computed, onMounted, ref } from 'vue'
import { Button } from '@/components/ui/button'
import BarList from '@/components/charts/BarList.vue'
import SparkLine from '@/components/charts/SparkLine.vue'
import StatTile from '@/components/charts/StatTile.vue'
import { api } from '@/lib/api'

interface SpeedRow { route: string; metric: string; device: string; p75: number; samples: number }
interface SpeedData {
  thresholds: Record<string, [number, number]>
  rows: SpeedRow[]
  trend: { metric: string; day: string; p75: number }[]
}

const METRICS = ['LCP', 'INP', 'CLS', 'FCP', 'TTFB']
const days = ref(7)
const data = ref<SpeedData | null>(null)
const loading = ref(false)
const error = ref('')

function format(metric: string, value: number): string {
  return metric === 'CLS' ? value.toFixed(2) : `${Math.round(value)} ms`
}

const tiles = computed(() => {
  const d = data.value
  if (!d) return []
  return METRICS.map((metric) => {
    const rows = d.rows.filter((r) => r.metric === metric)
    const total = rows.reduce((n, r) => n + r.samples, 0)
    const p75 = total ? rows.reduce((n, r) => n + r.p75 * r.samples, 0) / total : null
    const good = d.thresholds[metric]?.[0] ?? Infinity
    const status = p75 === null ? 'No data' : p75 > good ? 'Needs work' : 'Good'
    return {
      metric,
      display: p75 === null ? '—' : format(metric, p75),
      status,
      trend: d.trend.filter((t) => t.metric === metric).map((t) => t.p75),
    }
  })
})

const slowest = computed(() => {
  const byRoute = new Map<string, { sum: number; n: number }>()
  for (const r of data.value?.rows ?? []) {
    if (r.metric !== 'LCP') continue
    const cur = byRoute.get(r.route) ?? { sum: 0, n: 0 }
    cur.sum += r.p75 * r.samples
    cur.n += r.samples
    byRoute.set(r.route, cur)
  }
  return [...byRoute.entries()]
    .map(([label, v]) => ({ label, value: Math.round(v.sum / v.n) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)
})

let seq = 0

async function load() {
  const mine = ++seq
  loading.value = true
  error.value = ''
  try {
    const result = await api.get<SpeedData>(`/api/admin/speed?days=${days.value}`)
    if (mine === seq) data.value = result
  } catch {
    if (mine !== seq) return
    data.value = null
    error.value = 'Could not load speed data. Try again.'
  } finally {
    if (mine === seq) loading.value = false
  }
}

function setDays(d: number) {
  days.value = d
  void load()
}

onMounted(load)
</script>
