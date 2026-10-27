<template>
  <section
    v-if="status !== 'ready' || visibleItems.length > 0"
    aria-label="Platform totals"
    :aria-busy="status === 'loading' ? 'true' : undefined"
  >
    <Card class="gap-4 rounded-3xl p-5 sm:p-6">
      <p
        v-if="status === 'error'"
        class="text-base text-muted-foreground"
        role="status"
      >
        Stats are unavailable right now.
      </p>
      <dl
        v-else
        aria-label="Platform totals"
        class="grid grid-cols-2 gap-3 sm:grid-cols-3"
      >
        <div
          v-for="item in visibleItems"
          :key="item.key"
          class="flex flex-col-reverse gap-1 rounded-2xl border border-border bg-muted/40 p-4"
        >
          <dt class="text-sm text-muted-foreground">
            {{ item.label }}
          </dt>
          <dd
            v-if="stats"
            class="font-heading text-3xl font-semibold tracking-tight tabular-nums"
          >
            {{ formatCount(stats[item.key]) }}
          </dd>
          <div
            v-else
            class="h-9 w-16 animate-pulse rounded-lg bg-muted"
            aria-hidden="true"
          />
        </div>
      </dl>
    </Card>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Card } from '@/components/ui/card'
import { api } from '@/lib/api'

interface PlatformStats {
  users: number
  orgs: number
  members: number
  links: number
  clicks: number
  events: number
  tickets: number
  checkIns: number
  frames: number
  frameDownloads: number
}

const stats = ref<PlatformStats | null>(null)
const failed = ref(false)
const status = computed(() => (failed.value ? 'error' : stats.value ? 'ready' : 'loading'))

const items: { key: keyof PlatformStats; label: string }[] = [
  { key: 'users', label: 'Students signed up' },
  { key: 'orgs', label: 'Orgs' },
  { key: 'members', label: 'Org members' },
  { key: 'links', label: 'Short links' },
  { key: 'clicks', label: 'Link clicks' },
  { key: 'events', label: 'Events' },
  { key: 'tickets', label: 'Tickets issued' },
  { key: 'checkIns', label: 'Check-ins' },
  { key: 'frames', label: 'Frames' },
  { key: 'frameDownloads', label: 'Frame downloads' },
]

// Keep every tile while loading so the skeleton holds its shape; once loaded, drop zeros.
const visibleItems = computed(() =>
  stats.value ? items.filter(item => stats.value![item.key] > 0) : items,
)

function formatCount(value: number): string {
  return value.toLocaleString('en-US')
}

onMounted(async () => {
  try {
    const res = await api.raw('/api/stats')
    if (!res.ok) throw new Error('stats')
    stats.value = (await res.json()) as PlatformStats
  } catch {
    failed.value = true
  }
})
</script>
