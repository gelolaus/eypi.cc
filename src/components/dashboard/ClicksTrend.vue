<script setup lang="ts">
import { computed } from 'vue'
import LineChart from '@/components/charts/LineChart.vue'
import PanelState from '@/components/dashboard/PanelState.vue'
import type { UserTrends } from '@/lib/queries'

const props = defineProps<{
  trends: UserTrends | null
  status: 'loading' | 'error' | 'ready'
}>()
const emit = defineEmits<{ retry: [] }>()

const series = computed(() => {
  const t = props.trends
  if (!t) return []
  const out: { label: string; points: { x: string; y: number }[] }[] = [
    { label: 'Clicks', points: t.timeline.map((d) => ({ x: d.day, y: d.clicks })) },
    { label: 'Uniques', points: t.timeline.map((d) => ({ x: d.day, y: d.uniques })) },
  ]
  if (t.previous) {
    out.push({
      label: 'Previous period clicks',
      points: t.previous.timeline.map((d) => ({ x: d.day, y: d.clicks })),
    })
  }
  return out
})

const bestDay = computed(() => {
  const t = props.trends?.timeline ?? []
  if (!t.length) return null
  let best = t[0]
  for (const day of t) if (day.clicks > best.clicks) best = day
  return best
})

const summary = computed(() => {
  const t = props.trends
  if (!t) return ''
  const total = t.totals.clicks.toLocaleString('en-US')
  const best = bestDay.value
  return best
    ? `Clicks total ${total}, best day ${best.day}`
    : `Clicks total ${total}`
})
</script>

<template>
  <PanelState
    :status="status === 'ready' && trends ? 'ready' : status === 'error' ? 'error' : 'loading'"
    title="Clicks trend"
    @retry="emit('retry')"
  >
    <div
      v-if="trends"
      class="space-y-2"
    >
      <p class="text-sm text-muted-foreground">
        {{ summary }}
      </p>
      <div :aria-label="summary">
        <LineChart
          y-label="Clicks"
          :series="series"
        />
      </div>
    </div>
  </PanelState>
</template>