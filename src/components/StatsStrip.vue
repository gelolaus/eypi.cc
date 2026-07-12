<template>
  <section
    v-if="stats"
    class="relative w-full px-6 py-10 md:py-14"
    aria-label="Platform usage statistics"
  >
    <div class="reveal mx-auto grid w-full max-w-5xl grid-cols-3 divide-x divide-g-border">
      <div
        v-for="item in statItems"
        :key="item.key"
        class="flex flex-col items-center gap-2 px-4 text-center"
      >
        <span class="text-data text-3xl font-bold tracking-tight text-g-text sm:text-4xl md:text-5xl">
          {{ formatCount(stats[item.key]) }}
        </span>
        <span class="text-sm font-medium text-g-muted sm:text-base">
          {{ item.label }}
        </span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { API_BASE_URL } from '@/config/api'
import { useReveal } from '@/composables/useReveal'

useReveal()

interface PlatformStats {
  orgs: number
  links: number
  events: number
}

const stats = ref<PlatformStats | null>(null)

const statItems = [
  { key: 'orgs' as const, label: 'Orgs registered' },
  { key: 'links' as const, label: 'Links created' },
  { key: 'events' as const, label: 'Events run' },
]

function formatCount(value: number): string {
  return value.toLocaleString('en-US')
}

onMounted(async () => {
  try {
    const res = await fetch(`${API_BASE_URL}/api/stats`)
    if (!res.ok) return
    stats.value = await res.json() as PlatformStats
  } catch {
    // Section stays hidden if stats are unavailable
  }
})
</script>
