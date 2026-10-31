<script setup lang="ts">
import { computed } from 'vue'
import BarList from '@/components/charts/BarList.vue'
import PanelState from '@/components/dashboard/PanelState.vue'
import type { UserTrends } from '@/lib/queries'

const props = defineProps<{
  trends: UserTrends | null
  status: 'loading' | 'error' | 'ready'
}>()
const emit = defineEmits<{ retry: [] }>()

const items = computed(() =>
  (props.trends?.top.links ?? []).slice(0, 5).map((l) => ({
    label: `eypi.cc/${l.slug}`,
    value: l.clicks,
  })),
)

const panelStatus = computed<'loading' | 'error' | 'empty' | 'ready'>(() => {
  if (props.status === 'error') return 'error'
  if (props.status !== 'ready' || !props.trends) return 'loading'
  if (props.trends.totals.links === 0) return 'empty'
  if (items.value.length === 0) return 'empty'
  return 'ready'
})

const emptyBody = computed(() => {
  if (props.trends && props.trends.totals.links === 0) return 'No links yet'
  return 'No clicks in this period'
})

const action = computed(() => {
  if (props.trends && props.trends.totals.links === 0) {
    return { label: 'Create a link', to: '/links' }
  }
  return undefined
})
</script>

<template>
  <PanelState
    :status="panelStatus"
    title="Top links"
    :empty-body="emptyBody"
    :action="action"
    @retry="emit('retry')"
  >
    <BarList :items="items" />
  </PanelState>
</template>