<template>
  <AppSection title="Check-in, live">
    <p
      v-if="!data"
      class="text-base text-muted-foreground"
    >
      Loading live counts…
    </p>
    <dl
      v-else
      class="grid grid-cols-2 gap-3"
      data-live-checkin
    >
      <div class="flex flex-col-reverse rounded-2xl border border-border bg-muted/40 p-4">
        <dt class="text-sm text-muted-foreground">
          Checked in
        </dt>
        <dd class="font-heading text-3xl font-semibold tabular-nums">
          {{ data.checkedIn.toLocaleString('en-US') }}<span class="text-lg text-muted-foreground"> / {{ data.confirmed.toLocaleString('en-US') }}</span>
        </dd>
      </div>
      <div class="flex flex-col-reverse rounded-2xl border border-border bg-muted/40 p-4">
        <dt class="text-sm text-muted-foreground">
          Arrived in the last 10 minutes
        </dt>
        <dd class="font-heading text-3xl font-semibold tabular-nums">
          {{ data.last10min.toLocaleString('en-US') }}
        </dd>
      </div>
    </dl>
  </AppSection>
</template>

<script setup lang="ts">
import AppSection from '@/components/layout/AppSection.vue'
import { useLivePoll } from '@/composables/useLivePoll'

const props = defineProps<{ slug: string }>()
const { data } = useLivePoll<{ confirmed: number; checkedIn: number; last10min: number }>(
  `/api/events/${encodeURIComponent(props.slug)}/live`,
)
</script>
