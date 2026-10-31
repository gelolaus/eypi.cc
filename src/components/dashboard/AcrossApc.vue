<script setup lang="ts">
import { computed } from 'vue'
import type { PlatformStats } from '@/lib/queries'

const props = defineProps<{
  stats: PlatformStats | null
  status: 'loading' | 'error' | 'ready'
}>()

const rows = computed(() => {
  const s = props.stats
  if (!s) return []
  return [
    { label: 'Students', value: s.users },
    { label: 'Orgs', value: s.orgs },
    { label: 'Links', value: s.links },
    { label: 'Clicks', value: s.clicks },
    { label: 'Events', value: s.events },
  ]
})
</script>

<template>
  <dl
    v-if="status === 'ready' && stats"
    class="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground"
  >
    <div
      v-for="row in rows"
      :key="row.label"
      class="flex gap-2"
    >
      <dt>{{ row.label }}</dt>
      <dd class="tabular-nums text-foreground">
        {{ row.value.toLocaleString('en-US') }}
      </dd>
    </div>
  </dl>
</template>