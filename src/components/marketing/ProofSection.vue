<template>
  <section
    v-if="stats"
    class="mx-auto w-full max-w-3xl px-5 py-24 text-center sm:px-6"
    aria-labelledby="proof-heading"
  >
    <h2
      id="proof-heading"
      class="text-3xl font-semibold tracking-tight sm:text-4xl"
    >
      Used across APC
    </h2>
    <dl class="mt-10 grid grid-cols-3 divide-x divide-border">
      <div
        v-for="item in items"
        :key="item.key"
        class="flex flex-col-reverse items-center gap-2 px-3"
      >
        <dt class="text-sm text-muted-foreground sm:text-base">
          {{ item.label }}
        </dt>
        <dd class="text-3xl font-semibold tracking-tight tabular-nums sm:text-5xl">
          {{ formatCount(stats[item.key]) }}
        </dd>
      </div>
    </dl>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api } from '@/lib/api'

interface PlatformStats {
  orgs: number
  links: number
  events: number
}

const stats = ref<PlatformStats | null>(null)

const items = [
  { key: 'orgs' as const, label: 'Orgs registered' },
  { key: 'links' as const, label: 'Links created' },
  { key: 'events' as const, label: 'Events run' },
]

function formatCount(value: number): string {
  return value.toLocaleString('en-US')
}

onMounted(async () => {
  try {
    const res = await api.raw('/api/stats')
    if (!res.ok) return
    stats.value = (await res.json()) as PlatformStats
  } catch {
    // The section stays hidden when stats are unavailable.
  }
})
</script>
