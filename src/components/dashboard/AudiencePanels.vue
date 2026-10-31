<script setup lang="ts">
import { computed } from 'vue'
import BarList from '@/components/charts/BarList.vue'
import PanelState from '@/components/dashboard/PanelState.vue'
import type { TopItem, UserTrends } from '@/lib/queries'

const props = defineProps<{
  trends: UserTrends | null
  status: 'loading' | 'error' | 'ready'
}>()
const emit = defineEmits<{ retry: [] }>()

type Dim = { title: string; items: { label: string; value: number }[] }

function mapItems(rows: TopItem[]): { label: string; value: number }[] {
  return rows.slice(0, 5).map((r) => ({ label: r.value, value: r.clicks }))
}

const dims = computed<Dim[]>(() => {
  const t = props.trends
  if (!t) return []
  const out: Dim[] = []
  if (t.top.device.length) out.push({ title: 'Device', items: mapItems(t.top.device) })
  if (t.top.country.length) out.push({ title: 'Country', items: mapItems(t.top.country) })
  if (t.top.referrer.length) out.push({ title: 'Referrer', items: mapItems(t.top.referrer) })
  if (t.top.app.length) out.push({ title: 'App', items: mapItems(t.top.app) })
  return out
})

const panelStatus = computed<'loading' | 'error' | 'empty' | 'ready'>(() => {
  if (props.status === 'error') return 'error'
  if (props.status !== 'ready' || !props.trends) return 'loading'
  if (dims.value.length === 0) return 'empty'
  return 'ready'
})
</script>

<template>
  <PanelState
    :status="panelStatus"
    title="Audience"
    empty-body="No audience data yet"
    @retry="emit('retry')"
  >
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div
        v-for="dim in dims"
        :key="dim.title"
        class="space-y-2"
      >
        <h3 class="text-sm font-medium text-muted-foreground">
          {{ dim.title }}
        </h3>
        <BarList :items="dim.items" />
      </div>
    </div>
  </PanelState>
</template>