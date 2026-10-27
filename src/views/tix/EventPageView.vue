<template>
  <section class="relative mx-auto w-full max-w-3xl px-4 pb-24 pt-8 sm:px-6 md:pt-12">
    <div
      v-if="query.status.value === 'loading' || query.status.value === 'idle'"
      role="status"
      aria-busy="true"
      class="space-y-6"
    >
      <span class="sr-only">Loading</span>
      <div
        class="aspect-[2/1] w-full rounded-3xl bg-muted motion-safe:animate-pulse"
        aria-hidden="true"
      />
      <div
        class="h-9 w-2/3 rounded-xl bg-muted motion-safe:animate-pulse"
        aria-hidden="true"
      />
      <div
        class="h-24 rounded-3xl bg-muted motion-safe:animate-pulse"
        aria-hidden="true"
      />
    </div>

    <Card
      v-else-if="query.status.value === 'error' || !event"
      class="items-center gap-0 rounded-3xl p-12 text-center"
    >
      <h1 class="text-xl font-semibold">
        This event isn't available
      </h1>
      <p
        v-if="!isNotFound"
        role="alert"
        class="mt-2 text-sm text-destructive"
      >
        Could not load the event. Check your connection and try again.
      </p>
      <Button
        v-if="!isNotFound"
        variant="outline"
        class="mt-6"
        @click="query.refresh()"
      >
        Try again
      </Button>
      <Button
        as-child
        variant="ghost"
        class="mt-6"
      >
        <router-link to="/orgs">
          Browse organizations
        </router-link>
      </Button>
    </Card>

    <article
      v-else
      class="space-y-6"
    >
      <div
        v-if="event.coverUrl"
        class="overflow-hidden rounded-3xl bg-muted"
      >
        <AppImage
          :src="event.coverUrl"
          :meta="coverMeta"
          sizes="(min-width: 768px) 768px, 100vw"
          priority
          :alt="`${event.name} cover`"
          class="aspect-[2/1] w-full object-cover"
        />
      </div>

      <header class="space-y-2">
        <router-link
          :to="`/orgs/${event.org.slug}`"
          class="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          {{ event.org.name }}
        </router-link>
        <h1 class="text-3xl font-semibold tracking-tight sm:text-4xl">
          {{ event.name }}
        </h1>
      </header>

      <p
        v-if="banner"
        role="status"
        data-banner
        class="rounded-2xl border border-border bg-muted px-4 py-3 text-sm"
      >
        {{ banner }}
      </p>

      <Card class="gap-4 rounded-3xl p-5 sm:p-6">
        <dl class="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt class="text-muted-foreground">
              When (Manila time)
            </dt>
            <dd class="mt-0.5 font-medium">
              {{ when }}
            </dd>
          </div>
          <div>
            <dt class="text-muted-foreground">
              Where
            </dt>
            <dd class="mt-0.5 font-medium">
              {{ event.location }}
            </dd>
          </div>
          <div v-if="seatsText">
            <dt class="text-muted-foreground">
              Seats
            </dt>
            <dd class="mt-0.5 font-medium">
              {{ seatsText }}
            </dd>
          </div>
          <div v-if="windowText">
            <dt class="text-muted-foreground">
              Registration
            </dt>
            <dd class="mt-0.5 font-medium">
              {{ windowText }}
            </dd>
          </div>
        </dl>

        <div class="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center">
          <Button
            v-if="action.kind === 'view-ticket'"
            as-child
            size="lg"
            class="w-full sm:w-auto"
          >
            <router-link
              to="/tickets"
              data-primary-action
            >
              {{ action.label }}
            </router-link>
          </Button>
          <Button
            v-else
            size="lg"
            class="w-full sm:w-auto"
            data-primary-action
            :disabled="action.kind === 'none'"
            @click="onPrimary"
          >
            {{ action.label }}
          </Button>
          <p
            v-if="ticket?.status === 'waitlisted' && ticket.waitlistPosition"
            class="text-sm text-muted-foreground"
          >
            Waitlist position #{{ ticket.waitlistPosition }}
          </p>
          <Button
            v-if="canCancel"
            variant="ghost"
            class="sm:ml-auto"
            :disabled="cancelling"
            @click="cancelRegistration"
          >
            Cancel registration
          </Button>
        </div>
        <p
          v-if="actionError"
          role="alert"
          class="text-sm text-destructive"
        >
          {{ actionError }}
        </p>
      </Card>

      <!-- eslint-disable vue/no-v-html -- sanitized by sanitizeEventHtml (DOMPurify) -->
      <div
        v-if="descriptionHtml"
        data-event-description
        class="markdown-body max-w-none text-base leading-relaxed [&_a]:text-primary [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-3 [&_ul]:list-disc [&_ul]:pl-6"
        v-html="descriptionHtml"
      />
      <!-- eslint-enable vue/no-v-html -->
    </article>

    <RegisterSheet
      v-if="event && sheetOpen"
      v-model:open="sheetOpen"
      :event="event"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppImage from '@/components/AppImage.vue'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { sanitizeEventHtml } from '@/lib/sanitizeEventHtml'
import { useDialog } from '@/composables/useDialog'
import { ApiError, api } from '@/lib/api'
import { useQuery } from '@/lib/queryCache'
import { formatManilaDate, formatManilaDateTime } from '@/lib/manilaTime'
import { primaryAction, registrationBlock, type PublicEventResponse } from '@/lib/tix/eventState'
import type { ImageMeta } from '@/lib/images/variants'
import { useSession } from '@/stores/session'

// The sheet (dialog primitives, form) loads only when someone starts to register.
const RegisterSheet = defineAsyncComponent(() => import('@/components/tix/RegisterSheet.vue'))

const route = useRoute()
const router = useRouter()
const session = useSession()
const dialog = useDialog()

const slug = computed(() => String(route.params.slug ?? ''))
const query = useQuery<PublicEventResponse>(
  () => `events:public:${slug.value}`,
  () => api.get<PublicEventResponse>(`/api/events/${encodeURIComponent(slug.value)}/public`),
)

const event = computed(() => query.data.value?.event ?? null)
const ticket = computed(() => query.data.value?.viewer.ticket ?? null)
const isNotFound = computed(() => query.error.value instanceof ApiError && query.error.value.status === 404)
const coverMeta = computed(() => (event.value?.coverMeta as ImageMeta | null) ?? null)
const descriptionHtml = computed(() => sanitizeEventHtml(event.value?.descriptionHtml))

const now = () => new Date()
const action = computed(() =>
  event.value ? primaryAction(event.value, ticket.value, now()) : { label: 'Registration closed' as const, kind: 'none' as const },
)

const block = computed(() => (event.value ? registrationBlock(event.value, now()) : null))
const banner = computed(() => {
  if (ticket.value?.status === 'cancelled') return 'Your registration was cancelled. Ask the organisers if you want back in.'
  if (ticket.value?.status === 'declined') return 'Your registration was not accepted for this event.'
  if (ticket.value) return ''
  switch (block.value) {
    case 'cancelled': return 'This event was cancelled.'
    case 'closed': return 'Registration has closed.'
    case 'not_open_yet': return `Registration opens ${event.value?.registrationOpensAt ? formatManilaDateTime(event.value.registrationOpensAt) : 'soon'}`
    case 'invite_only': return 'This event is invite only.'
    case 'full': return 'This event is full.'
    default: return ''
  }
})

const when = computed(() => {
  const e = event.value
  if (!e) return ''
  const end = e.endTime ? ` to ${e.endTime}` : ''
  return `${formatManilaDate(e.eventDate)}, ${e.eventTime}${end}`
})
const seatsText = computed(() => {
  const e = event.value
  if (!e || e.seatsLeft == null) return ''
  if (e.seatsLeft === 0) return e.waitlistEnabled ? 'Full, waitlist open' : 'Full'
  return `${e.seatsLeft} ${e.seatsLeft === 1 ? 'seat' : 'seats'} left`
})
const windowText = computed(() => {
  const e = event.value
  if (!e || (!e.registrationOpensAt && !e.registrationClosesAt)) return ''
  const parts: string[] = []
  if (e.registrationOpensAt) parts.push(`Opens ${formatManilaDateTime(e.registrationOpensAt)}`)
  if (e.registrationClosesAt) parts.push(`closes ${formatManilaDateTime(e.registrationClosesAt)}`)
  return parts.join(', ')
})

const sheetOpen = ref(false)
const actionError = ref('')
const cancelling = ref(false)

function onPrimary(): void {
  if (action.value.kind !== 'register') return
  if (!session.user.value) {
    void router.push({ name: 'login', query: { returnTo: route.fullPath } })
    return
  }
  sheetOpen.value = true
}

const canCancel = computed(() => !!ticket.value && ['pending', 'entered', 'waitlisted', 'confirmed'].includes(ticket.value.status))

async function cancelRegistration(): Promise<void> {
  if (!event.value) return
  const ok = await dialog.confirm({
    title: 'Cancel your registration?',
    body: `Your spot at "${event.value.name}" is released.`,
    confirmLabel: 'Cancel registration',
    abortLabel: 'Keep it',
  })
  if (!ok) return
  cancelling.value = true
  actionError.value = ''
  try {
    // api.ts invalidates the events: cache prefix, which reloads this page.
    await api.del(`/api/events/${encodeURIComponent(slug.value)}/registration`)
  } catch (err) {
    actionError.value = err instanceof ApiError ? err.message : 'Could not cancel. Try again.'
  } finally {
    cancelling.value = false
  }
}

// The router owns titles; this only refines the generic one once the event is known.
watch(event, (e) => {
  if (e) document.title = `${e.name} · Eypi`
}, { immediate: true })
</script>
