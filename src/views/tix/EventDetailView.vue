<template>
  <section class="relative mx-auto w-full max-w-5xl px-3 py-8 sm:px-6 sm:py-12">
    <div class="rounded-3xl bg-white/92 px-5 py-8 shadow-[0_4px_40px_rgba(0,0,0,0.07)] ring-1 ring-black/5 backdrop-blur-sm dark:bg-slate-900/95 dark:ring-white/[0.06] sm:px-8 sm:py-10">
      <div v-if="loadingEvent" class="space-y-4">
        <div class="h-10 w-64 animate-pulse rounded-lg bg-gray-200 dark:bg-slate-800/60" />
        <div class="h-4 w-40 animate-pulse rounded-lg bg-gray-200 dark:bg-slate-800/60" />
      </div>

      <div v-else-if="!event" class="py-24 text-center">
        <p class="font-mono text-4xl font-black text-[#34418F] dark:text-slate-200">404</p>
        <p class="mt-2 text-sm text-gray-500 dark:text-slate-400">Event not found</p>
        <router-link to="/manage/tix" class="mt-6 inline-block text-sm font-medium text-[#DEAC4B] hover:underline">← My events</router-link>
      </div>

      <template v-else>
        <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1
              class="font-mono font-black tracking-tight text-[#34418F] dark:text-slate-200"
              style="font-size: clamp(1.8rem, 4.5vw, 3rem); letter-spacing: -0.03em;"
            >
              {{ event.name }}
            </h1>
            <p class="mt-1 text-sm text-gray-500 dark:text-slate-400">
              {{ formatCalendarDate(event.eventDate) }} · {{ formatEventTime(event.eventTime) }} · {{ event.location }}
            </p>

            <div v-if="event.isLead" class="mt-2 flex flex-wrap items-center gap-3">
              <div class="flex items-center gap-1.5">
                <span
                  class="font-mono text-xs font-bold"
                  :class="isAtCapacity ? 'text-red-500' : 'text-gray-500 dark:text-slate-400'"
                >
                  {{ activeAttendeeCount }}{{ event.maxAttendees ? ` / ${event.maxAttendees}` : '' }} guests
                </span>
                <template v-if="!editingMax">
                  <button
                    type="button"
                    class="font-mono text-[0.65rem] text-gray-400 transition-colors hover:text-[#34418F] dark:text-slate-500 dark:hover:text-slate-300"
                    title="Edit max attendees"
                    @click="startEditMax"
                  >
                    Edit
                  </button>
                </template>
                <template v-else>
                  <input
                    ref="maxEditInput"
                    v-model.number="maxEditValue"
                    type="number"
                    aria-label="Max attendees"
                    min="1"
                    placeholder="∞"
                    class="w-20 rounded-md border border-[#34418F] px-2 py-0.5 font-mono text-xs outline-none dark:border-slate-500 dark:bg-slate-800 dark:text-slate-200"
                    @keydown.enter="saveMax"
                    @keydown.escape="editingMax = false"
                  />
                  <button type="button" class="font-mono text-[0.65rem] text-emerald-500 transition-colors hover:text-emerald-600" @click="saveMax">Save</button>
                  <button type="button" class="font-mono text-[0.65rem] text-gray-400 transition-colors hover:text-gray-600" @click="editingMax = false">Cancel</button>
                </template>
              </div>

              <button
                v-if="event.selectionLocked"
                type="button"
                :disabled="isAtCapacity"
                :class="[
                  'rounded-lg border px-3 py-1 text-sm font-semibold transition-colors',
                  isAtCapacity
                    ? 'cursor-not-allowed border-gray-200 text-gray-300 dark:border-slate-700 dark:text-slate-600'
                    : 'border-[#34418F] text-[#34418F] hover:bg-[#34418F] hover:text-white dark:border-slate-500 dark:text-slate-300 dark:hover:bg-slate-700',
                ]"
                @click="showAddGuest = true"
              >
                Add guest
              </button>
            </div>
          </div>

          <div class="flex flex-wrap gap-2">
            <a
              :href="`/tix/${slug}`"
              target="_blank"
              class="rounded-lg border border-gray-200 px-4 py-2 text-xs font-medium text-gray-500 transition-colors hover:border-[#34418F] hover:text-[#34418F] dark:border-slate-600 dark:text-slate-400 dark:hover:border-slate-400"
            >
              Attendee view
            </a>
          </div>
        </div>

        <fieldset v-if="event.isLead && passColumns.length" class="mb-6">
          <legend class="mb-2 text-sm font-semibold text-gray-700 dark:text-slate-200">Pass fields</legend>
          <p class="mb-3 text-sm text-gray-500 dark:text-slate-400">Checked columns are printed on the wallet pass.</p>
          <div class="flex flex-wrap gap-2">
            <label
              v-for="column in passColumns"
              :key="column"
              class="flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 transition-colors"
              :class="passFieldSelection.includes(column)
                ? 'border-[#34418F] bg-[#34418F]/10 dark:border-slate-400 dark:bg-slate-700/50'
                : 'border-gray-200 bg-white/60 dark:border-slate-600 dark:bg-slate-800/60'"
            >
              <input
                type="checkbox"
                :checked="passFieldSelection.includes(column)"
                class="h-3.5 w-3.5 accent-[#34418F]"
                @change="togglePassField(column)"
              />
              <span class="font-mono text-xs text-gray-700 dark:text-slate-300">{{ column }}</span>
            </label>
          </div>
          <button
            type="button"
            class="mt-3 rounded-lg bg-[#34418F] px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-700"
            :disabled="savingPassFields"
            @click="savePassFields"
          >
            {{ savingPassFields ? 'Saving…' : 'Save pass fields' }}
          </button>
        </fieldset>

        <ClusterBars
          v-if="event.isLead && clusters.length"
          :slug="slug"
          :clusters="clusters"
          @updated="refreshAfterGuestChange"
        />

        <div class="mb-6 flex flex-wrap gap-2">
          <button
            v-for="(tab, index) in TABS"
            :key="tab.label"
            type="button"
            :class="[
              'rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
              activeTab === index
                ? 'bg-[#34418F] text-white dark:bg-slate-700 dark:text-slate-100'
                : 'bg-transparent text-gray-400 hover:text-[#34418F] dark:text-slate-400 dark:hover:text-slate-200',
            ]"
            @click="activeTab = index"
          >
            {{ tab.label }}
            <span v-if="tab.filter !== null && attendees.length" class="ml-1 opacity-60">({{ countForTab(tab.filter) }})</span>
          </button>
        </div>

        <ScannerPanel v-if="activeTab === 5" :slug="slug" @checked-in="fetchAttendees" />
        <AttendeeTable
          v-else
          :attendees="attendees"
          :loading="loadingAttendees"
          :action-pending="actionPending"
          :exporting="exportingXlsx"
          :downloading-zip="downloadingZip"
          :tab-filter="TABS[activeTab].filter"
          :tab-label="TABS[activeTab].label"
          :clusters="clusters"
          @check-in="checkIn"
          @check-out="checkOut"
          @remove="removeAttendee"
          @restore="restoreAttendee"
          @download-qr="downloadQr"
          @download-zip="downloadAllZip"
          @export="exportToXlsx"
          @save-cluster="onSaveCluster"
        />

        <div v-if="event.isLead" class="mt-12 border-t border-dashed border-red-200 pt-8 dark:border-red-900/30">
          <p class="text-card-title mb-1 text-red-500">Danger zone</p>
          <p class="mb-4 font-mono text-xs text-gray-400 dark:text-slate-500">
            Permanently deletes this event and all attendee data. This cannot be undone.
          </p>
          <button
            type="button"
            :disabled="deletingEvent"
            class="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-500 transition-colors hover:bg-red-500 hover:text-white disabled:opacity-40 dark:border-red-800/60 dark:hover:bg-red-700"
            @click="confirmDeleteEvent"
          >
            {{ deletingEvent ? 'Deleting…' : 'Delete event' }}
          </button>
        </div>
      </template>
    </div>

    <AddGuestPanel
      :open="showAddGuest"
      :slug="slug"
      :has-csv-rows="hasCsvRows"
      :column-mapping="csvColMapping"
      :clusters="clusters"
      @close="showAddGuest = false"
      @added="refreshAfterGuestChange"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '@/lib/api'
import { useDialog } from '@/composables/useDialog'
import { useToast } from '@/composables/useToast'
import { isPendingStatus, useEventAttendees } from '@/composables/useEventAttendees'
import { formatCalendarDate, formatEventTime } from '@/lib/tix/timestamps'
import AddGuestPanel, { type CsvColumnMapping } from '@/components/tix/AddGuestPanel.vue'
import AttendeeTable from '@/components/tix/AttendeeTable.vue'
import ClusterBars, { type EventClusterBar } from '@/components/tix/ClusterBars.vue'
import ScannerPanel from '@/components/tix/ScannerPanel.vue'

const toast = useToast()
const dialog = useDialog()
const route = useRoute()
const router = useRouter()
const slug = route.params.id as string

interface EventInfo {
  name: string
  eventDate: string
  eventTime: string
  location: string
  isLead: boolean
  maxAttendees: number | null
  selectionLocked: boolean
  attendeeCount: number
  passFields?: string[]
}

const TABS = [
  { label: 'All', filter: null },
  { label: 'Pending', filter: 'pending' },
  { label: 'Checked in', filter: 'checked_in' },
  { label: 'Checked out', filter: 'checked_out' },
  { label: 'Removed', filter: 'removed' },
  { label: 'Scanner', filter: null },
] as const

const event = ref<EventInfo | null>(null)
const loadingEvent = ref(true)
const deletingEvent = ref(false)
const clusters = ref<EventClusterBar[]>([])
const activeTab = ref(0)
const showAddGuest = ref(false)
const hasCsvRows = ref(false)
const csvColMapping = ref<CsvColumnMapping>({})
const csvColumns = ref<string[]>([])
const passFieldSelection = ref<string[]>([])
const savingPassFields = ref(false)
const editingMax = ref(false)
const maxEditValue = ref<number | null>(null)
const maxEditInput = ref<HTMLInputElement | null>(null)

const {
  attendees,
  loadingAttendees,
  actionPending,
  exportingXlsx,
  downloadingZip,
  activeAttendeeCount,
  fetchAttendees,
  saveCluster,
  downloadQr,
  downloadAllZip,
  exportToXlsx,
  checkIn,
  checkOut,
  removeAttendee,
  restoreAttendee,
} = useEventAttendees(slug)

const passColumns = computed(() => {
  const names = new Set<string>([...csvColumns.value, ...passFieldSelection.value])
  return [...names].filter((name) => name.trim() !== '').sort((left, right) => left.localeCompare(right))
})

const isAtCapacity = computed(() =>
  event.value?.maxAttendees != null && activeAttendeeCount.value >= event.value.maxAttendees,
)

function countForTab(filter: string | null) {
  if (!filter) return attendees.value.length
  if (filter === 'pending') return attendees.value.filter((attendee) => isPendingStatus(attendee.status)).length
  return attendees.value.filter((attendee) => attendee.status === filter).length
}

function togglePassField(column: string) {
  if (passFieldSelection.value.includes(column)) {
    passFieldSelection.value = passFieldSelection.value.filter((name) => name !== column)
  } else {
    passFieldSelection.value = [...passFieldSelection.value, column]
  }
}

async function savePassFields() {
  savingPassFields.value = true
  try {
    const res = await api.raw(`/api/events/${slug}`, {
      method: 'PATCH',
      body: JSON.stringify({ passFields: passFieldSelection.value }),
    })
    const data = await res.json() as { message?: string }
    if (!res.ok) throw new Error(data.message ?? 'Could not save pass fields. Try again.')
    toast.success('Pass fields saved.')
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Could not save pass fields. Try again.')
  } finally {
    savingPassFields.value = false
  }
}

function startEditMax() {
  maxEditValue.value = event.value?.maxAttendees ?? null
  editingMax.value = true
  nextTick(() => maxEditInput.value?.focus())
}

async function saveMax() {
  try {
    const res = await api.raw(`/api/events/${slug}`, {
      method: 'PATCH',
      body: JSON.stringify({ maxAttendees: maxEditValue.value ?? null }),
    })
    if (!res.ok) throw new Error((await res.json() as { message?: string }).message ?? 'Failed.')
    if (event.value) event.value.maxAttendees = maxEditValue.value
    editingMax.value = false
    toast.success('Max attendees updated.')
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Update failed.')
  }
}

async function fetchClusters() {
  try {
    const res = await api.raw(`/api/events/${slug}/clusters`)
    if (!res.ok) return
    const data = await res.json() as { clusters?: EventClusterBar[] }
    clusters.value = data.clusters ?? []
  } catch { /* clusters are optional */ }
}

async function fetchCsvMeta() {
  try {
    const res = await api.raw(`/api/events/${slug}/csv-data`)
    if (!res.ok) return
    const data = await res.json() as {
      rows?: { rawData?: Record<string, unknown> }[]
      columnMapping?: CsvColumnMapping
    }
    hasCsvRows.value = (data.rows?.length ?? 0) > 0
    const names = new Set<string>()
    for (const row of data.rows ?? []) {
      for (const key of Object.keys(row.rawData ?? {})) {
        if (key.trim()) names.add(key)
      }
    }
    csvColumns.value = [...names]
    if (data.columnMapping) csvColMapping.value = data.columnMapping
  } catch { /* no CSV is fine */ }
}

async function refreshAfterGuestChange() {
  await fetchAttendees()
  await fetchClusters()
}

async function onSaveCluster(id: string, value: string | null) {
  try {
    await saveCluster(id, value)
    await fetchClusters()
    toast.success('Cluster updated.')
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Update failed.')
  }
}

async function confirmDeleteEvent() {
  const eventName = event.value?.name ?? slug
  const ok = await dialog.confirm({
    title: 'Delete this event?',
    body: `Removes "${eventName}" and all attendee data. This cannot be undone.`,
    confirmLabel: 'Delete event',
    requireText: eventName,
  })
  if (!ok) return
  deletingEvent.value = true
  try {
    const res = await api.raw(`/api/events/${slug}`, { method: 'DELETE' })
    const data = await res.json() as { message?: string }
    if (!res.ok) throw new Error(data.message ?? 'Delete failed.')
    toast.success('Event deleted.')
    router.push('/manage/tix')
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Delete failed.')
  } finally {
    deletingEvent.value = false
  }
}

onMounted(async () => {
  try {
    const res = await api.raw(`/api/events/${slug}`)
    const data = await res.json() as { message?: string; event?: EventInfo }
    if (!res.ok) throw new Error(data.message ?? 'Event not found.')
    if (!data.event!.isLead) {
      router.replace(`/tix/${slug}`)
      return
    }
    if (!data.event!.selectionLocked) {
      router.replace(`/manage/tix/${slug}/select`)
      return
    }
    event.value = data.event!
    passFieldSelection.value = [...(data.event!.passFields ?? [])]
  } catch {
    event.value = null
    loadingEvent.value = false
    return
  }
  loadingEvent.value = false
  fetchAttendees()
  fetchClusters()
  fetchCsvMeta()
})
</script>
