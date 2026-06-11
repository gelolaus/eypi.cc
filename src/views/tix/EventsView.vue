<template>
  <section class="relative mx-auto w-full max-w-5xl px-6 py-16">
    <div class="mb-10 flex items-end justify-between">
      <div>
        <h1
          class="font-mono font-black tracking-tight text-[#34418F] dark:text-slate-200"
          style="font-size: clamp(2rem, 5vw, 3.5rem); letter-spacing: -0.03em;"
          data-cursor="text"
        >
          Your Events
        </h1>
        <p class="mt-1 font-mono text-xs uppercase tracking-widest text-gray-500 dark:text-slate-400">
          Manage tickets &amp; check-in
        </p>
      </div>
      <router-link
        to="/events/new"
        class="rounded-xl bg-[#DEAC4B] px-6 py-3 font-mono text-sm font-bold uppercase tracking-wider text-white transition-all duration-200 hover:brightness-110 hover:-translate-y-0.5 dark:bg-eypi-gold-dark dark:text-slate-100 dark:hover:bg-eypi-gold-hover"
        data-cursor="cta"
      >
        New Event
      </router-link>
    </div>

    <!-- Loading skeleton -->
    <div v-if="loading" class="space-y-3">
      <div v-for="i in 3" :key="i" class="h-20 animate-pulse rounded-2xl bg-gray-200 dark:bg-slate-800/60" />
    </div>

    <!-- Error -->
    <div v-else-if="error" class="rounded-2xl border border-red-200 bg-red-50 p-6 text-center font-mono text-sm text-red-500 dark:border-red-900/40 dark:bg-red-900/10">
      {{ error }}
    </div>

    <!-- Empty state -->
    <div
      v-else-if="!events.length"
      class="mica-card relative rounded-3xl border border-gray-200 dark:border-slate-600 p-12 text-center"
    >
      <div class="absolute left-3 top-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
      <div class="absolute right-3 top-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
      <div class="absolute bottom-3 left-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
      <div class="absolute bottom-3 right-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
      <p class="font-mono text-sm uppercase tracking-widest text-gray-500 dark:text-slate-400">No events yet</p>
      <p class="mt-3 font-mono text-xs leading-relaxed text-gray-400 dark:text-slate-500">
        Create your first event to generate attendee QR tickets.
      </p>
    </div>

    <!-- Event list -->
    <div v-else class="overflow-hidden rounded-2xl border border-gray-200 dark:border-slate-600">
      <!-- Header row -->
      <div class="grid grid-cols-12 border-b border-gray-100 bg-gray-50/60 px-4 py-3 font-mono text-xs font-bold uppercase tracking-widest text-[#34418F] dark:border-slate-700 dark:bg-mica-navy-header dark:text-slate-300">
        <div class="col-span-8 sm:col-span-5">Event</div>
        <div class="col-span-4 hidden sm:block">Date &amp; Time</div>
        <div class="col-span-4 sm:col-span-3 text-right">Actions</div>
      </div>

      <div
        v-for="event in events"
        :key="event.id as string"
        class="grid grid-cols-12 items-center border-b border-gray-100 px-4 py-4 transition-colors hover:bg-white/50 dark:border-slate-700/60 dark:hover:bg-mica-navy-row-hover last:border-0"
      >
        <div class="col-span-8 sm:col-span-5">
          <p class="font-mono text-base font-bold text-gray-900 dark:text-slate-100">{{ event.name }}</p>
          <p class="mt-0.5 font-mono text-xs text-gray-400 dark:text-slate-500">tix.eypi.cc/{{ event.slug }}</p>
        </div>
        <div class="col-span-4 hidden sm:block">
          <p class="font-mono text-sm text-gray-600 dark:text-slate-300">{{ formatDate(event.event_date as string) }}</p>
          <p class="font-mono text-xs text-gray-400 dark:text-slate-500">{{ event.event_time }}</p>
        </div>
        <div class="col-span-4 sm:col-span-3 flex items-center justify-end gap-1.5">
          <router-link
            :to="`/manage/${event.slug}`"
            class="rounded-lg bg-[#34418F] px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#2a3578] dark:bg-slate-700 dark:hover:bg-slate-600"
            data-cursor="nav"
          >
            Manage
          </router-link>
          <button
            :disabled="deletingSlug === (event.slug as string)"
            class="rounded-lg border border-red-200 px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider text-red-400 transition-colors hover:border-red-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-40 dark:border-red-900/40 dark:text-red-400/70 dark:hover:border-red-700/60 dark:hover:bg-red-900/10 dark:hover:text-red-400"
            @click="deleteEvent(event.slug as string, event.name as string)"
          >
            {{ deletingSlug === (event.slug as string) ? '…' : 'Delete' }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useToast } from '@/composables/useToast'
import { useAuth } from '@/composables/useAuth'
import { TIX_API_URL } from '@/config/tix-api'

const toast = useToast()
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

const events     = ref<Event[]>([])
const loading    = ref(true)
const error      = ref('')
const deletingSlug = ref<string | null>(null)

function formatDate(d: string) {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return new Date(Number(y), Number(m) - 1, Number(day)).toLocaleDateString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

async function deleteEvent(slug: string, name: string) {
  if (!confirm(
    `Delete "${name}"?\n\nThis will permanently remove all attendees, QR tokens, check-in records, clusters, and CSV data tied to this event. This cannot be undone.`
  )) return

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
