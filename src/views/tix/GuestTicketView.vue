<template>
  <section class="mx-auto w-full max-w-md px-4 pb-24 pt-8 sm:pt-12">
    <p
      v-if="banner"
      role="status"
      class="mb-4 rounded-2xl border border-border bg-muted px-4 py-3 text-sm text-foreground"
    >
      {{ banner }}
    </p>

    <div
      v-if="state === 'loading'"
      role="status"
      aria-busy="true"
      class="space-y-4"
    >
      <span class="sr-only">Loading your ticket</span>
      <div
        class="h-64 rounded-3xl bg-muted motion-safe:animate-pulse"
        aria-hidden="true"
      />
    </div>

    <Card
      v-else-if="state === 'gone'"
      class="items-center gap-0 rounded-3xl p-10 text-center"
    >
      <h1 class="text-xl font-semibold">
        Ticket not found
      </h1>
      <p class="mt-2 text-sm text-muted-foreground">
        This link doesn't work anymore. Ask the organiser for a new one.
      </p>
    </Card>

    <Card
      v-else-if="state === 'error' || !ticket"
      class="items-center gap-0 rounded-3xl p-10 text-center"
    >
      <p
        role="alert"
        class="text-sm text-destructive"
      >
        Could not load your ticket. Check your connection and try again.
      </p>
      <Button
        variant="outline"
        class="mt-4"
        @click="load"
      >
        Try again
      </Button>
    </Card>

    <TicketCard
      v-else
      :ticket="ticket"
      :pass-token="passToken"
      guest
    />
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import TicketCard from '@/components/tix/TicketCard.vue'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { api } from '@/lib/api'
import { offlineBanner, readOfflineInfo, type OfflineInfo } from '@/lib/tix/offline'
import type { TicketDto } from '@/lib/tix/tickets'

const route = useRoute()

const state = ref<'loading' | 'ready' | 'gone' | 'error'>('loading')
const ticket = ref<TicketDto | null>(null)
const passToken = ref<string | null>(null)
const info = ref<OfflineInfo>({ offline: false, cachedAt: null })
const banner = computed(() => offlineBanner(info.value))

// Private link: never put the ticket in the shared query cache, and keep it out of search results.
let robots: HTMLMetaElement | null = null

async function load(): Promise<void> {
  state.value = 'loading'
  try {
    const res = await api.raw(`/api/tickets/guest/${encodeURIComponent(String(route.params.token ?? ''))}`)
    if (res.status === 404) {
      state.value = 'gone'
      return
    }
    if (!res.ok) throw new Error('failed')
    const body = await res.json() as { ticket: TicketDto; passToken: string | null }
    ticket.value = body.ticket
    passToken.value = body.passToken ?? null
    info.value = readOfflineInfo(res)
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}

onMounted(() => {
  robots = document.createElement('meta')
  robots.name = 'robots'
  robots.content = 'noindex'
  document.head.appendChild(robots)
  void load()
})
onBeforeUnmount(() => {
  robots?.remove()
  robots = null
})
</script>
