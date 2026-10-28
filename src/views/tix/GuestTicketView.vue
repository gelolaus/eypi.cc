<template>
  <section class="mx-auto w-full max-w-md px-4 pb-24 pt-8 sm:pt-12">
    <p
      v-if="banner"
      role="status"
      class="mb-4 rounded-2xl border border-border bg-muted px-4 py-3 text-sm text-foreground"
    >
      {{ banner }}
    </p>

    <ListSkeleton
      v-if="state === 'loading'"
      :rows="1"
      :row-height="256"
      :radius="24"
      label="Loading your ticket"
    />

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
        @click="load()"
      >
        Try again
      </Button>
    </Card>

    <TicketCard
      v-else
      :ticket="ticket"
      :pass-token="passToken"
      :refresh-pass="refreshPass"
      guest
    />
  </section>
</template>

<script setup lang="ts">
import ListSkeleton from '@/components/skeletons/ListSkeleton.vue'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
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

// A newer load wins: a slow answer for an old token must not overwrite the current one.
let loadSeq = 0

async function load(quiet = false): Promise<void> {
  const mine = ++loadSeq
  if (!quiet) state.value = 'loading'
  try {
    const res = await api.raw(`/api/tickets/guest/${encodeURIComponent(String(route.params.token ?? ''))}`)
    if (mine !== loadSeq) return
    if (res.status === 404) {
      state.value = 'gone'
      return
    }
    if (!res.ok) throw new Error('failed')
    const body = await res.json() as { ticket: TicketDto; passToken: string | null }
    if (mine !== loadSeq) return
    ticket.value = body.ticket
    passToken.value = body.passToken ?? null
    info.value = readOfflineInfo(res)
    state.value = 'ready'
  } catch {
    if (mine === loadSeq && !quiet) state.value = 'error'
  }
}

/** For an expired wallet token: reload the ticket quietly and hand back the new token. */
async function refreshPass(): Promise<string | null> {
  await load(true)
  return passToken.value
}

watch(() => route.params.token, (now, before) => {
  if (now !== before) void load()
})

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
