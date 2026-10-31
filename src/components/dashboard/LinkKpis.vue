<script setup lang="ts">
import { computed } from 'vue'
import StatTile from '@/components/charts/StatTile.vue'
import PanelState from '@/components/dashboard/PanelState.vue'
import { deltaPercent, formatDelta } from '@/lib/dashboardModel'
import type { UserTrends } from '@/lib/queries'

const props = defineProps<{
  trends: UserTrends | null
  status: 'loading' | 'error' | 'ready'
}>()

const emit = defineEmits<{ retry: [] }>()

type Tile = { label: string; value: string; delta: number | null; newLabel: boolean }

const tiles = computed<Tile[]>(() => {
  const t = props.trends
  if (!t) return []
  const prev = t.previous?.totals
  const keys: { label: string; current: number; previous: number | undefined }[] = [
    { label: 'Clicks', current: t.totals.clicks, previous: prev?.clicks },
    { label: 'Daily uniques', current: t.totals.uniques, previous: prev?.uniques },
    { label: 'QR scans', current: t.totals.qr, previous: prev?.qr },
    { label: 'Active links', current: t.totals.activeLinks, previous: prev?.activeLinks },
    // previous TrendsPeriod totals have no links — show the count with no delta
    { label: 'Links', current: t.totals.links, previous: undefined },
  ]
  return keys.map((k) => {
    if (prev === undefined || k.previous === undefined) {
      return { label: k.label, value: k.current.toLocaleString('en-US'), delta: null, newLabel: false }
    }
    const formatted = formatDelta(k.current, k.previous)
    return {
      label: k.label,
      value: k.current.toLocaleString('en-US'),
      delta: formatted.direction === 'new' || formatted.direction === 'none' ? null : deltaPercent(k.current, k.previous),
      newLabel: formatted.direction === 'new',
    }
  })
})
</script>

<template>
  <PanelState
    :status="status === 'ready' && trends ? 'ready' : status === 'error' ? 'error' : 'loading'"
    title="Link totals"
    @retry="emit('retry')"
  >
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <div
        v-for="tile in tiles"
        :key="tile.label"
        class="space-y-1"
      >
        <StatTile
          :label="tile.label"
          :value="tile.value"
          :delta="tile.delta"
        />
        <p
          v-if="tile.newLabel"
          class="px-1 text-sm text-muted-foreground"
          data-testid="delta-new"
        >
          New
        </p>
      </div>
    </div>
  </PanelState>
</template>