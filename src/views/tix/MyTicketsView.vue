<template>
  <AppPage
    title="My tickets"
    description="Your registrations and entry codes."
  >
    <p
      v-if="banner"
      role="status"
      class="rounded-2xl border border-border bg-muted px-4 py-3 text-sm text-foreground"
    >
      {{ banner }}
    </p>

    <div
      v-if="query.status.value === 'loading' || query.status.value === 'idle'"
      role="status"
      aria-busy="true"
      class="space-y-4"
    >
      <span class="sr-only">Loading your tickets</span>
      <div
        v-for="n in 2"
        :key="n"
        class="h-48 rounded-3xl bg-muted motion-safe:animate-pulse"
        aria-hidden="true"
      />
    </div>

    <Card
      v-else-if="query.status.value === 'error'"
      class="items-center gap-0 rounded-3xl p-10 text-center"
    >
      <p
        role="alert"
        class="text-sm text-destructive"
      >
        Could not load your tickets. Check your connection and try again.
      </p>
      <Button
        variant="outline"
        class="mt-4"
        @click="query.refresh()"
      >
        Try again
      </Button>
    </Card>

    <Card
      v-else-if="tickets.length === 0"
      class="items-center gap-0 rounded-3xl p-10 text-center"
    >
      <h2 class="text-lg font-semibold">
        No tickets yet
      </h2>
      <p class="mt-1 text-sm text-muted-foreground">
        When you register for an event, your ticket shows up here.
      </p>
      <Button
        as-child
        class="mt-4"
      >
        <router-link to="/orgs">
          Find events through organizations
        </router-link>
      </Button>
    </Card>

    <template v-else>
      <section
        v-if="upcoming.length"
        aria-labelledby="upcoming-heading"
        class="space-y-4"
      >
        <h2
          id="upcoming-heading"
          class="text-lg font-semibold"
        >
          Upcoming
        </h2>
        <TicketCard
          v-for="ticket in upcoming"
          :key="ticket.id"
          :ticket="ticket"
          @cancelled="query.refresh()"
        />
      </section>
      <section
        v-if="past.length"
        aria-labelledby="past-heading"
        class="space-y-4"
      >
        <h2
          id="past-heading"
          class="text-lg font-semibold"
        >
          Past
        </h2>
        <TicketCard
          v-for="ticket in past"
          :key="ticket.id"
          :ticket="ticket"
          @cancelled="query.refresh()"
        />
      </section>
    </template>
  </AppPage>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import AppPage from '@/components/layout/AppPage.vue'
import TicketCard from '@/components/tix/TicketCard.vue'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ApiError, api } from '@/lib/api'
import { useQuery } from '@/lib/queryCache'
import { offlineBanner, readOfflineInfo, type OfflineInfo } from '@/lib/tix/offline'
import { isPastEvent, type TicketDto } from '@/lib/tix/tickets'
import { useSession } from '@/stores/session'

type Loaded = { tickets: TicketDto[]; info: OfflineInfo }

const session = useSession()

const query = useQuery<Loaded>('tickets:list', async () => {
  // raw, not get: the offline marker is a response header.
  const res = await api.raw('/api/tickets')
  if (!res.ok) throw new ApiError(res.status, 'http_error', 'Could not load your tickets.')
  const body = await res.json() as { tickets?: TicketDto[] }
  return { tickets: body.tickets ?? [], info: readOfflineInfo(res) }
})

const tickets = computed(() => query.data.value?.tickets ?? [])
const banner = computed(() => (query.data.value ? offlineBanner(query.data.value.info) : ''))

const upcoming = computed(() => tickets.value.filter((t) => !isPastEvent(t)))
const past = computed(() => tickets.value.filter((t) => isPastEvent(t)))

// The server marks updates as seen on a live load; a cached copy proves nothing.
watch(() => query.data.value, (data) => {
  if (data && !data.info.offline) session.ticketUpdates.value = 0
}, { immediate: true })
</script>
