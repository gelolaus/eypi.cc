<template>
  <div class="relative w-full">
    <PageSkeleton v-if="loading" />
    <AppPage
      v-else
      title="Tix"
      description="Manage tickets & check-in"
    >
      <div v-if="!isLocked" class="mb-6 flex flex-col gap-3 sm:flex-row">
        <Input
          v-model="searchQuery"
          type="search"
          placeholder="Search events..."
          aria-label="Search events"
          class="min-w-0 flex-1"
        />
        <Button as-child size="lg">
          <router-link to="/manage/tix/new">
            New Event
          </router-link>
        </Button>
      </div>

      <div v-if="isLocked">
        <OrgLockout />
      </div>

      <div v-else-if="error" role="alert" class="rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-center text-sm text-destructive">
        {{ error }}
      </div>

      <Card
        v-else-if="!filteredEvents.length"
        class="gap-0 rounded-3xl p-12 text-center"
      >
        <p class="text-sm font-medium text-foreground">{{ events.length ? 'No matching events' : 'No events yet' }}</p>
        <p class="mt-3 text-sm leading-relaxed text-muted-foreground">
          {{ events.length ? 'Try another search term.' : 'Create your first event to generate attendee QR tickets.' }}
        </p>
      </Card>

      <div v-else class="space-y-3 md:space-y-0 md:overflow-hidden md:rounded-2xl md:border md:border-border">
        <div class="hidden grid-cols-12 border-b border-border bg-card px-4 py-3 font-mono text-xs font-semibold text-muted-foreground md:grid">
          <div class="col-span-5">Event</div>
          <div class="col-span-4">Date &amp; Time</div>
          <div class="col-span-3 text-right">Actions</div>
        </div>

        <Card
          v-for="event in filteredEvents"
          :key="event.id as string"
          data-event-row
          class="gap-3 rounded-2xl p-4 md:grid md:grid-cols-12 md:items-center md:gap-0 md:rounded-none md:border-b md:border-border md:bg-transparent md:py-4 md:ring-0 md:last:border-b-0"
        >
          <div class="min-w-0 md:col-span-5">
            <p class="break-words text-base font-semibold text-foreground">{{ event.name }}</p>
            <p class="mt-1 font-mono text-sm text-muted-foreground md:hidden">
              {{ formatDate(event.event_date as string) }}<span v-if="event.event_time"> · {{ event.event_time }}</span>
            </p>
          </div>
          <div class="hidden md:col-span-4 md:block">
            <p class="font-mono text-sm text-foreground">{{ formatDate(event.event_date as string) }}</p>
            <p class="font-mono text-xs text-muted-foreground">{{ event.event_time }}</p>
          </div>
          <div class="flex items-center gap-2 md:col-span-3 md:justify-end">
            <Button as-child variant="outline" class="flex-1 md:flex-none">
              <router-link :to="`/manage/tix/${event.slug}`">
                Manage
              </router-link>
            </Button>
            <Button
              type="button"
              variant="destructive"
              :disabled="deletingSlug === (event.slug as string)"
              class="flex-1 md:flex-none"
              @click="deleteEvent(event.slug as string, event.name as string)"
            >
              {{ deletingSlug === (event.slug as string) ? '...' : 'Delete' }}
            </Button>
          </div>
        </Card>
      </div>
    </AppPage>
  </div>
</template>

<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import { ref, computed, onMounted } from 'vue'
import { useToast } from '@/composables/useToast'
import { useDialog } from '@/composables/useDialog'
import OrgLockout from '@/components/OrgLockout.vue'
import AppPage from '@/components/layout/AppPage.vue'
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

