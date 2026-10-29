<template>
  <AppSection title="Clicks in the last 60 minutes">
    <p
      v-if="!live"
      class="text-base text-muted-foreground"
    >
      Loading live clicks…
    </p>
    <template v-else>
      <p class="mb-2 text-sm text-muted-foreground tabular-nums">
        {{ total.toLocaleString('en-US') }} {{ total === 1 ? 'click' : 'clicks' }}, updating live
      </p>
      <SparkLine
        :values="live.last60"
        label="Clicks per minute over the last 60 minutes"
      />
      <p
        v-if="!live.recent.length"
        class="mt-4 text-base text-muted-foreground"
      >
        No clicks in the last hour.
      </p>
      <ul
        v-else
        class="mt-4 divide-y divide-border text-sm"
        aria-label="Recent clicks"
      >
        <li
          v-for="(item, i) in live.recent"
          :key="`${item.at}-${i}`"
          class="flex items-center justify-between gap-3 py-2"
        >
          <span class="tabular-nums text-muted-foreground">{{ timeLabel(item.at) }}</span>
          <span class="min-w-0 truncate">
            {{ item.country ?? 'Unknown' }}<template v-if="item.app"> · {{ APP_LABELS[item.app] ?? item.app }}</template>
          </span>
        </li>
      </ul>
    </template>
  </AppSection>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import SparkLine from '@/components/charts/SparkLine.vue'
import AppSection from '@/components/layout/AppSection.vue'
import { useLivePoll } from '@/composables/useLivePoll'

type LiveClicks = { last60: number[]; recent: { at: string; country: string | null; app: string | null }[] }

const APP_LABELS: Record<string, string> = {
  messenger: 'Messenger', facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', x: 'X', line: 'LINE', discord: 'Discord',
}

const { data } = useLivePoll<LiveClicks>('/api/links/summary/live')
// A failed or empty response parses to {}, so only trust a payload that has both lists.
const live = computed(() => (Array.isArray(data.value?.last60) && Array.isArray(data.value?.recent) ? data.value : null))
const total = computed(() => live.value?.last60.reduce((a, b) => a + b, 0) ?? 0)

function timeLabel(at: string): string {
  const d = new Date(at)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
}
</script>
