<template>
  <div class="relative w-full">
    <PageSkeleton v-if="loading" />
    <AppPage
      v-else
      title="Tix"
      description="Manage tickets & check-in"
    >
      <div v-if="!isLocked" class="mb-6 flex flex-col gap-3 sm:flex-row">
        <input
          v-model="searchQuery"
          type="search"
          placeholder="Search events..."
          aria-label="Search events"
          class="control min-w-0 flex-1"
        />
        <router-link
          to="/manage/tix/new"
          class="btn-gold inline-flex min-h-11 items-center justify-center rounded-xl px-6 text-base font-semibold transition-all duration-200 hover:opacity-90"
          data-cursor="cta"
        >
          New Event
        </router-link>
      </div>

      <div v-if="isLocked">
        <OrgLockout />
      </div>

      <div v-else-if="error" role="alert" class="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/10 dark:text-red-400">
        {{ error }}
      </div>

      <div
        v-else-if="!filteredEvents.length"
        class="mica-card relative rounded-3xl border border-g-border p-12 text-center"
      >
        <PageShell />
        <p class="text-sm font-medium text-g-muted">{{ events.length ? 'No matching events' : 'No events yet' }}</p>
        <p class="mt-3 text-sm leading-relaxed text-g-muted">
          {{ events.length ? 'Try another search term.' : 'Create your first event to generate attendee QR tickets.' }}
        </p>
      </div>

      <div v-else class="space-y-3 md:space-y-0 md:overflow-hidden md:rounded-2xl md:border md:border-g-border">
        <div class="hidden grid-cols-12 border-b border-g-border bg-g-surface px-4 py-3 text-data text-xs font-semibold text-g-muted md:grid">
          <div class="col-span-5">Event</div>
          <div class="col-span-4">Date &amp; Time</div>
          <div class="col-span-3 text-right">Actions</div>
        </div>

        <div
          v-for="event in filteredEvents"
          :key="event.id as string"
          data-event-row
          class="flex flex-col gap-3 rounded-2xl border border-g-border bg-g-surface p-4 md:grid md:grid-cols-12 md:items-center md:gap-0 md:rounded-none md:border-0 md:border-b md:bg-transparent md:py-4 md:last:border-b-0"
        >
          <div class="min-w-0 md:col-span-5">
            <p class="break-words text-base font-semibold text-g-text">{{ event.name }}</p>
            <p class="text-data mt-1 text-sm text-g-muted md:hidden">
              {{ formatDate(event.event_date as string) }}<span v-if="event.event_time"> · {{ event.event_time }}</span>
            </p>
          </div>
          <div class="hidden md:col-span-4 md:block">
            <p class="text-data text-sm text-g-text">{{ formatDate(event.event_date as string) }}</p>
            <p class="text-data text-xs text-g-muted">{{ event.event_time }}</p>
          </div>
          <div class="flex items-center gap-2 md:col-span-3 md:justify-end">
            <router-link
              :to="`/manage/tix/${event.slug}`"
              class="btn-secondary flex-1 md:flex-none"
              data-cursor="nav"
            >
              Manage
            </router-link>
            <button
              type="button"
              :disabled="deletingSlug === (event.slug as string)"
              class="btn-secondary flex-1 border-red-300 text-red-600 md:flex-none dark:border-red-900/60 dark:text-red-400"
              @click="deleteEvent(event.slug as string, event.name as string)"
            >
              {{ deletingSlug === (event.slug as string) ? '...' : 'Delete' }}
            </button>
          </div>
        </div>
      </div>
    </AppPage>
  </div>
</template>

<script setup lang="ts">
import { api } from '@/lib/api'
import { ref, computed, onMounted } from 'vue'
import { useToast } from '@/composables/useToast'
import { useDialog } from '@/composables/useDialog'
import OrgLockout from '@/components/OrgLockout.vue'
import PageShell from '@/components/PageShell.vue'
import AppPage from '@/components/AppPage.vue'
import PageSkeleton from '@/components/PageSkeleton.vue'

const toast = useToast()
const dialog = useDialog()

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
    const res = await api.raw(`/api/events/${slug}`, { method: 'DELETE' })
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
    const res = await api.raw(`/api/events`)
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

