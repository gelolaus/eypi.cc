<script setup lang="ts">
import { computed } from 'vue'
import PanelState from '@/components/dashboard/PanelState.vue'
import type { TicketSummary } from '@/lib/queries'

const props = defineProps<{
  tickets: TicketSummary[] | null
  status: 'loading' | 'error' | 'ready'
}>()
const emit = defineEmits<{ retry: [] }>()

const listed = computed(() => (props.tickets ?? []).slice(0, 3))

const panelStatus = computed<'loading' | 'error' | 'empty' | 'ready'>(() => {
  if (props.status === 'error') return 'error'
  if (props.status !== 'ready' || props.tickets === null) return 'loading'
  if (listed.value.length === 0) return 'empty'
  return 'ready'
})
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h3 class="font-heading text-lg font-semibold tracking-tight">
        Upcoming tickets
      </h3>
      <router-link
        v-if="panelStatus === 'ready'"
        to="/tickets"
        class="inline-flex min-h-11 items-center text-base font-medium text-primary underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        View all
      </router-link>
    </div>
    <PanelState
      :status="panelStatus"
      title="Upcoming tickets"
      empty-body="No upcoming tickets"
      @retry="emit('retry')"
    >
      <ul class="space-y-2">
        <li
          v-for="t in listed"
          :key="t.id"
          class="rounded-2xl border border-border bg-muted/40 px-4 py-3"
        >
          <p class="font-medium text-foreground">
            {{ t.event.name }}
          </p>
          <p class="text-sm text-muted-foreground">
            {{ t.event.eventDate }}
          </p>
        </li>
      </ul>
    </PanelState>
  </div>
</template>