<template>
  <section class="relative mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-5xl flex-col px-6 py-16">
    <div class="mb-8 flex flex-col gap-4 border-b border-g-border pb-8 md:flex-row md:items-end md:justify-between">
      <div>
        <h1
          class="text-page-title"
        >
          Tix
        </h1>
        <p class="mt-3 max-w-2xl text-base leading-relaxed text-g-muted">
          Manage tickets &amp; check-in
        </p>
      </div>
      <div v-if="!isLocked" class="flex flex-wrap items-center gap-3">
        <OrgSwitcher />
        <router-link
          to="/manage/tix/new"
          class="rounded-xl bg-g-accent px-6 py-3 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:opacity-90 dark:bg-eypi-gold-dark dark:text-slate-100 dark:hover:bg-eypi-gold-hover"
          data-cursor="cta"
        >
          New Event
        </router-link>
      </div>
    </div>

    <input
      v-if="!isLocked"
      v-model="searchQuery"
      type="search"
      placeholder="Search events..."
      class="mb-6 w-full rounded-2xl border-2 border-g-border bg-g-surface px-6 py-4 text-sm text-g-text outline-none transition-colors placeholder:text-g-muted focus:border-g-accent"
    />

    <div v-if="loading" class="space-y-3">
      <div v-for="i in 3" :key="i" class="h-20 animate-pulse rounded-2xl bg-gray-200 dark:bg-slate-800/60" />
    </div>

    <div v-else-if="isLocked">
      <OrgLockout />
    </div>

    <div v-else-if="error" class="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-500 dark:border-red-900/40 dark:bg-red-900/10">
      {{ error }}
    </div>

    <div
      v-else-if="!filteredEvents.length"
      class="mica-card relative rounded-3xl border border-g-border p-12 text-center"
    >
      <div class="absolute left-3 top-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
      <div class="absolute right-3 top-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
      <div class="absolute bottom-3 left-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
      <div class="absolute bottom-3 right-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
      <p class="text-sm font-medium text-g-muted">{{ events.length ? 'No matching events' : 'No events yet' }}</p>
      <p class="mt-3 text-sm leading-relaxed text-g-muted">
        {{ events.length ? 'Try another search term.' : 'Create your first event to generate attendee QR tickets.' }}
      </p>
    </div>

    <div v-else class="overflow-x-auto rounded-2xl border border-g-border">
      <div class="min-w-[520px]">
      <div class="grid grid-cols-12 border-b border-g-border bg-white/40 px-4 py-3 text-data text-xs font-semibold text-g-muted dark:bg-mica-navy-header">
        <div class="col-span-8 sm:col-span-5">Event</div>
        <div class="col-span-4 hidden sm:block">Date &amp; Time</div>
        <div class="col-span-4 sm:col-span-3 text-right">Actions</div>
      </div>

      <div
        v-for="event in filteredEvents"
        :key="event.id as string"
        class="grid grid-cols-12 items-center border-b border-g-border px-4 py-4 transition-colors hover:bg-white/40 dark:hover:bg-mica-navy-row-hover last:border-0"
      >
        <div class="col-span-8 sm:col-span-5">
          <p class="text-base font-semibold text-g-text">{{ event.name }}</p>
        </div>
        <div class="col-span-4 hidden sm:block">
          <p class="text-data text-sm text-g-text">{{ formatDate(event.event_date as string) }}</p>
          <p class="text-data text-xs text-g-muted">{{ event.event_time }}</p>
        </div>
        <div class="col-span-4 sm:col-span-3 flex items-center justify-end gap-1.5">
          <router-link
            :to="`/manage/tix/${event.slug}`"
            class="rounded-lg border border-g-border px-3 py-1.5 text-sm font-semibold text-g-text transition-colors hover:border-g-accent hover:text-g-accent"
            data-cursor="nav"
          >
            Manage
          </router-link>
          <button
            :disabled="deletingSlug === (event.slug as string)"
            class="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-400 transition-colors hover:border-red-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-40 dark:border-red-900/40 dark:text-red-400/70 dark:hover:border-red-700/60 dark:hover:bg-red-900/10 dark:hover:text-red-400"
            @click="deleteEvent(event.slug as string, event.name as string)"
          >
            {{ deletingSlug === (event.slug as string) ? '...' : 'Delete' }}
          </button>
        </div>
      </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useToast } from '@/composables/useToast'
import { useDialog } from '@/composables/useDialog'
import { useAuth } from '@/composables/useAuth'
import { TIX_API_URL } from '@/config/tix-api'
import OrgLockout from '@/components/OrgLockout.vue'
import OrgSwitcher from '@/components/OrgSwitcher.vue'

const toast = useToast()
const dialog = useDialog()
const { authHeaders } = useAuth()

interface Event {
  id: unknown
  slug: unknown
  name: unknown
  event_date: unknown
  event_time: unknown
  location: unknown
  created_at: unknown
}

const events = ref<Event[]>([])
const loading = ref(true)
const error = ref('')
const isLocked = ref(false)
const deletingSlug = ref<string | null>(null)
const searchQuery = ref('')

const filteredEvents = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return events.value
  return events.value.filter((event) =>
    String(event.name ?? '').toLowerCase().includes(q) ||
    String(event.slug ?? '').toLowerCase().includes(q) ||
    String(event.location ?? '').toLowerCase().includes(q)
  )
})

function formatDate(d: string) {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return new Date(Number(y), Number(m) - 1, Number(day)).toLocaleDateString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

async function deleteEvent(slug: string, name: string) {
  const ok = await dialog.confirm({
    title: 'Delete this event?',
    body: `Removes "${name}" and all attendee, QR, check-in, cluster, and CSV data. This cannot be undone.`,
    confirmLabel: 'Delete event',
    requireText: name,
  })
  if (!ok) return

  deletingSlug.value = slug
  try {
    const res = await fetch(`${TIX_API_URL}/api/events/${slug}`, {
      method: 'DELETE',
      headers: authHeaders(),
    })
    const data = await res.json() as { status: string; message?: string }
    if (!res.ok) throw new Error(data.message ?? 'Delete failed.')
    events.value = events.value.filter(e => e.slug !== slug)
    toast.success(`"${name}" deleted.`)
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Delete failed.')
  } finally {
    deletingSlug.value = null
  }
}

onMounted(async () => {
  try {
    const res = await fetch(`${TIX_API_URL}/api/events`, { headers: authHeaders() })
    if (res.status === 403) {
      isLocked.value = true
      return
    }
    const data = await res.json() as { status: string; message?: string; events?: Event[] }
    if (!res.ok) throw new Error(data.message ?? 'Failed to load events.')
    events.value = data.events ?? []
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : 'Failed to load events.'
    toast.error(error.value)
  } finally {
    loading.value = false
  }
})
</script>

