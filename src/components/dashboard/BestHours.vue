<script setup lang="ts">
import { computed } from 'vue'
import HeatGrid from '@/components/charts/HeatGrid.vue'
import PanelState from '@/components/dashboard/PanelState.vue'
import { peakHourLabel } from '@/lib/dashboardModel'
import type { UserTrends } from '@/lib/queries'

const props = defineProps<{
  trends: UserTrends | null
  status: 'loading' | 'error' | 'ready'
}>()
const emit = defineEmits<{ retry: [] }>()

const peak = computed(() => (props.trends ? peakHourLabel(props.trends.heat) : null))

const panelStatus = computed<'loading' | 'error' | 'empty' | 'ready'>(() => {
  if (props.status === 'error') return 'error'
  if (props.status !== 'ready' || !props.trends) return 'loading'
  if (!peak.value) return 'empty'
  return 'ready'
})

const heatLabel = computed(() => {
  const p = peak.value
  return p ? `Clicks by hour of week. Peak: ${p}` : 'Clicks by hour of week'
})
</script>

<template>
  <PanelState
    :status="panelStatus"
    title="Best hours"
    empty-body="No best hours yet"
    @retry="emit('retry')"
  >
    <div
      v-if="trends"
      class="space-y-2"
    >
      <p
        v-if="peak"
        class="text-base text-foreground"
      >
        {{ peak }}
      </p>
      <HeatGrid
        :cells="trends.heat"
        :label="heatLabel"
      />
    </div>
  </PanelState>
</template>