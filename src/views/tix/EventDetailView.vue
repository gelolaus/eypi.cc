<template>
  <div class="relative w-full">
    <PageSkeleton v-if="loadingEvent" />

    <AppPage v-else-if="!event" title="Event not found" description="This event does not exist or you do not have access to it.">
      <router-link to="/manage/tix" class="btn-secondary">← My events</router-link>
    </AppPage>

    <AppPage v-else :title="event.name">
      <template #description>
        {{ formatCalendarDate(event.eventDate) }} · {{ formatEventTime(event.eventTime) }} · {{ event.location }}
      </template>

      <div class="space-y-6">
        <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div v-if="event.isLead" class="flex flex-wrap items-center gap-2">
            <span
              class="font-mono text-sm font-bold"
              :class="isAtCapacity ? 'text-red-600 dark:text-red-400' : 'text-g-muted'"
            >
              {{ activeAttendeeCount }}{{ event.maxAttendees ? ` / ${event.maxAttendees}` : '' }} guests
            </span>
            <template v-if="!editingMax">
              <button
                type="button"
                class="min-h-11 min-w-11 rounded-lg px-3 font-mono text-sm text-g-muted transition-colors hover:text-g-accent"
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
                class="control w-24 font-mono"
                @keydown.enter="saveMax"
                @keydown.escape="editingMax = false"
              />
              <button type="button" class="min-h-11 min-w-11 rounded-lg px-3 font-mono text-sm text-emerald-700 transition-colors hover:text-emerald-800 dark:text-emerald-400" @click="saveMax">Save</button>
              <button type="button" class="min-h-11 min-w-11 rounded-lg px-3 font-mono text-sm text-g-muted transition-colors hover:text-g-text" @click="editingMax = false">Cancel</button>
            </template>
          </div>

          <div class="flex flex-wrap gap-2 sm:ml-auto">
            <button
              v-if="event.isLead && event.selectionLocked"
              type="button"
              :disabled="isAtCapacity"
              class="btn-primary"
              @click="showAddGuest = true"
            >
              Add guest
            </button>
            <a
              :href="`/tix/${slug}`"
              target="_blank"
              rel="noopener"
              class="btn-secondary"
            >
              Attendee view
            </a>
          </div>
        </div>

        <AppSection v-if="event.isLead && passColumns.length" title="Pass fields">
          <fieldset>
            <legend class="sr-only">Pass fields</legend>
            <p class="mb-3 text-sm text-g-muted">Checked columns are printed on the wallet pass.</p>
            <div class="flex flex-wrap gap-2">
              <label
                v-for="column in passColumns"
                :key="column"
                class="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 transition-colors"
                :class="passFieldSelection.includes(column)
                  ? 'border-g-primary bg-g-surface ring-1 ring-g-primary'
                  : 'border-g-border bg-g-surface'"
              >
                <input
                  type="checkbox"
                  :checked="passFieldSelection.includes(column)"
                  class="size-5 accent-g-accent"
                  @change="togglePassField(column)"
                />
                <span class="font-mono text-sm text-g-text">{{ column }}</span>
              </label>
            </div>
            <button
              type="button"
              class="btn-primary mt-4"
              :disabled="savingPassFields"
              @click="savePassFields"
            >
              {{ savingPassFields ? 'Saving…' : 'Save pass fields' }}
            </button>
          </fieldset>
        </AppSection>

        <ClusterBars
          v-if="event.isLead && clusters.length"
          :slug="slug"
          :clusters="clusters"
          @updated="refreshAfterGuestChange"
        />

        <div class="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div class="flex w-max gap-2 sm:w-auto sm:flex-wrap" role="tablist" aria-label="Attendee views">
            <button
              v-for="(tab, index) in TABS"
              :key="tab.label"
              type="button"
              role="tab"
              :aria-selected="activeTab === index"
              :class="[
                'min-h-11 shrink-0 rounded-xl px-4 text-sm font-semibold transition-colors',
                activeTab === index
                  ? 'bg-g-primary text-white dark:text-black'
                  : 'bg-transparent text-g-muted hover:text-g-text',
              ]"
              @click="activeTab = index"
            >
              {{ tab.label }}
              <span v-if="tab.filter !== null && attendees.length" class="ml-1 opacity-70">({{ countForTab(tab.filter) }})</span>
            </button>
          </div>
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
          <p class="text-card-title mb-1 text-red-600 dark:text-red-400">Danger zone</p>
          <p class="mb-4 text-sm text-g-muted">
            Permanently deletes this event and all attendee data. This cannot be undone.
          </p>
          <button
            type="button"
            :disabled="deletingEvent"
            class="btn-danger"
            @click="confirmDeleteEvent"
          >
            {{ deletingEvent ? 'Deleting…' : 'Delete event' }}
          </button>
        </div>
      </div>
    </AppPage>

    <AddGuestPanel
      :open="showAddGuest"
      :slug="slug"
      :has-csv-rows="hasCsvRows"
      :column-mapping="csvColMapping"
      :clusters="clusters"
      @close="showAddGuest = false"
      @added="refreshAfterGuestChange"
    />
  </div>
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
import AppPage from '@/components/layout/AppPage.vue'
import AppSection from '@/components/layout/AppSection.vue'
import PageSkeleton from '@/components/PageSkeleton.vue'

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
