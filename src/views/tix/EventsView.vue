<template>
  <section class="relative mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-5xl flex-col px-4 py-12 sm:px-6">
    <div class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="font-display text-3xl font-bold text-g-text">Tix</h1>
        <p class="mt-2 text-g-muted">Manage tickets &amp; check-in</p>
      </div>
      <div v-if="!isLocked" class="flex flex-wrap items-center gap-3">
        <OrgSwitcher />
        <Button @click="router.push('/manage/tix/new')">New Event</Button>
      </div>
    </div>

    <Input
      v-if="!isLocked"
      :value="searchQuery"
      type="search"
      placeholder="Search events..."
      className="mb-6"
      @input="onSearchInput"
    />

    <div v-if="loading" class="space-y-3">
      <Card v-for="i in 3" :key="i" className="h-20 animate-pulse" />
    </div>

    <div v-else-if="isLocked">
      <OrgLockout />
    </div>

    <Card v-else-if="error" className="border-g-destructive/30 text-center text-sm text-g-destructive">
      {{ error }}
    </Card>

    <Card v-else-if="!filteredEvents.length">
      <EmptyState
        :title="events.length ? 'No matching events' : 'No events yet'"
        :description="events.length ? 'Try another search term.' : 'Create your first event to generate attendee QR tickets.'"
      >
        <Button v-if="!events.length" @click="router.push('/manage/tix/new')">New Event</Button>
      </EmptyState>
    </Card>

    <Card v-else className="!p-0 overflow-x-auto md:!p-0">
      <div class="min-w-[520px]">
        <div class="grid grid-cols-12 border-b border-g-border bg-g-bg px-4 py-3 text-data text-xs font-semibold text-g-muted">
          <div class="col-span-8 sm:col-span-5">Event</div>
          <div class="col-span-4 hidden sm:block">Date &amp; Time</div>
          <div class="col-span-4 text-right sm:col-span-3">Actions</div>
        </div>

        <div
          v-for="event in filteredEvents"
          :key="event.id as string"
          class="grid grid-cols-12 items-center border-b border-g-border px-4 py-4 transition-colors last:border-0 hover:bg-g-bg"
        >
          <div class="col-span-8 min-w-0 sm:col-span-5">
            <p class="truncate text-base font-semibold text-g-text">{{ event.name }}</p>
          </div>
          <div class="col-span-4 hidden sm:block">
            <p class="text-data text-sm text-g-text">{{ formatDate(event.event_date as string) }}</p>
            <p class="text-data text-xs text-g-muted">{{ event.event_time }}</p>
          </div>
          <div class="col-span-4 flex items-center justify-end gap-1.5 sm:col-span-3">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              @click="router.push(`/manage/tix/${event.slug}`)"
            >
              Manage
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              :disabled="deletingSlug === (event.slug as string)"
              @click="deleteEvent(event.slug as string, event.name as string)"
            >
              {{ deletingSlug === (event.slug as string) ? '…' : 'Delete' }}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from '@/composables/useToast'
import { useDialog } from '@/composables/useDialog'
import { useAuth } from '@/composables/useAuth'
import { TIX_API_URL } from '@/config/tix-api'
import OrgLockout from '@/components/OrgLockout.vue'
import OrgSwitcher from '@/components/OrgSwitcher.vue'
import Card from '@/components/ui/Card.vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

const router = useRouter()
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
    String(event.location ?? '').toLowerCase().includes(q),
  )
})

function onSearchInput(e: Event) {
  searchQuery.value = (e.target as HTMLInputElement).value
}

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
