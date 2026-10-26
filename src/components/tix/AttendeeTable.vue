<template>
  <div>
    <div class="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      <input
        v-model="searchQuery"
        type="search"
        placeholder="Search by name, email, or group…"
        aria-label="Search attendees"
        class="control min-w-0 flex-1"
      />
      <div class="flex gap-2">
        <button
          type="button"
          :disabled="!attendees.length || downloadingZip"
          class="btn-secondary flex-1 sm:flex-none"
          @click="emit('downloadZip')"
        >
          {{ downloadingZip ? 'Preparing ZIP…' : 'Download all (ZIP)' }}
        </button>
        <button
          type="button"
          :disabled="!attendees.length || exporting"
          class="btn-secondary flex-1 sm:flex-none"
          @click="emit('export')"
        >
          {{ exporting ? '…' : 'Export .xlsx' }}
        </button>
      </div>
    </div>

    <div class="mb-3 md:hidden">
      <label for="attendee-sort" class="sr-only">Sort attendees</label>
      <select id="attendee-sort" v-model="sortField" class="control" @change="currentPage = 1">
        <option value="name">Sort by name</option>
        <option value="email">Sort by email</option>
        <option value="status">Sort by status</option>
      </select>
    </div>

    <div v-if="loading" class="space-y-2">
      <div v-for="i in 5" :key="i" class="h-14 animate-pulse rounded-xl bg-g-border" />
    </div>

    <div v-else>
      <div data-attendee-list class="space-y-3 md:space-y-0 md:overflow-hidden md:rounded-2xl md:border md:border-g-border">
        <div class="hidden grid-cols-12 border-b border-g-border bg-g-surface text-data text-xs font-semibold text-g-primary md:grid">
          <button type="button" class="col-span-4 flex min-h-11 items-center gap-1 px-4 text-left transition-colors hover:text-g-accent" @click="toggleSort('name')">
            Attendee <span class="opacity-40">{{ sortMark('name') }}</span>
          </button>
          <button type="button" class="col-span-3 flex min-h-11 items-center gap-1 px-4 text-left transition-colors hover:text-g-accent" @click="toggleSort('email')">
            Email <span class="opacity-40">{{ sortMark('email') }}</span>
          </button>
          <button type="button" class="col-span-2 flex min-h-11 items-center gap-1 px-4 text-left transition-colors hover:text-g-accent" @click="toggleSort('status')">
            Status <span class="opacity-40">{{ sortMark('status') }}</span>
          </button>
          <div class="col-span-3 flex min-h-11 items-center justify-end px-4">Actions</div>
        </div>

        <div
          v-if="!filteredAttendees.length"
          class="rounded-2xl border border-g-border px-4 py-12 text-center text-sm font-medium text-g-muted md:rounded-none md:border-0"
        >
          {{ searchQuery.trim() ? `No results for "${searchQuery.trim()}"` : `No ${tabLabel.toLowerCase()} attendees` }}
        </div>

        <div
          v-for="attendee in paginatedAttendees"
          :key="attendee.id"
          data-attendee-row
          class="flex flex-col gap-3 rounded-2xl border border-g-border bg-g-surface p-4 md:grid md:grid-cols-12 md:items-center md:gap-0 md:rounded-none md:border-0 md:border-b md:bg-transparent md:px-0 md:py-3 md:last:border-0"
        >
          <div class="min-w-0 md:col-span-4 md:px-4">
            <p class="break-words font-mono text-sm font-bold text-g-text">{{ attendee.first_name }} {{ attendee.last_name }}</p>
            <p class="truncate font-mono text-xs text-g-muted md:hidden">{{ attendee.email }}</p>
            <template v-if="editingClusterAttendee === attendee.id">
              <input
                v-model="attendeeClusterEditValue"
                type="text"
                aria-label="Cluster"
                list="attendee-cluster-suggestions"
                placeholder="Cluster…"
                class="control mt-1"
                @keydown.enter="saveAttendeeCluster(attendee.id)"
                @keydown.escape="editingClusterAttendee = ''"
                @blur="saveAttendeeCluster(attendee.id)"
              />
            </template>
            <button
              v-else
              type="button"
              class="-ml-2 mt-0.5 min-h-11 cursor-pointer rounded-lg border-0 bg-transparent px-2 text-left font-mono text-xs text-g-muted transition-colors hover:text-g-accent"
              :title="attendee.cluster_value ? 'Edit cluster' : 'Assign cluster'"
              @click="startEditAttendeeCluster(attendee.id, attendee.cluster_value)"
            >
              {{ attendee.cluster_value || '+ cluster' }}
            </button>
          </div>
          <div class="hidden min-w-0 md:col-span-3 md:block md:px-4">
            <p class="truncate font-mono text-xs text-g-muted">{{ attendee.email }}</p>
          </div>
          <div class="md:col-span-2 md:px-4">
            <span
              :class="statusClass(attendee.status)"
              class="rounded px-2 py-0.5 font-mono text-xs font-bold tracking-wide"
            >
              {{ statusLabel(attendee.status) }}
            </span>
            <p v-if="attendee.actioned_at" class="mt-1 font-mono text-xs text-g-muted">
              {{ formatStoredDateTime(attendee.actioned_at) }}
            </p>
          </div>
          <div class="flex flex-wrap gap-2 md:col-span-3 md:justify-end md:px-4">
            <button
              v-if="attendee.status !== 'checked_in' && attendee.status !== 'removed'"
              type="button"
              :disabled="!!actionPending"
              class="min-h-11 min-w-11 rounded-xl bg-emerald-700 px-4 font-mono text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-emerald-800 disabled:opacity-40"
              title="Check in"
              @click="emit('checkIn', attendee.id)"
            >
              In
            </button>
            <button
              v-if="attendee.status === 'checked_in'"
              type="button"
              :disabled="!!actionPending"
              class="min-h-11 min-w-11 rounded-xl bg-gray-600 px-4 font-mono text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-gray-700 disabled:opacity-40"
              title="Check out"
              @click="emit('checkOut', attendee.id)"
            >
              Out
            </button>
            <button
              v-if="attendee.status === 'removed'"
              type="button"
              :disabled="!!actionPending"
              class="btn-primary"
              @click="emit('restore', attendee.id)"
            >
              Restore
            </button>
            <button
              type="button"
              class="btn-secondary"
              @click="emit('downloadQr', attendee)"
            >
              Download QR
            </button>
            <button
              v-if="attendee.status !== 'removed'"
              type="button"
              :disabled="!!actionPending"
              class="btn-danger"
              title="Remove"
              @click="confirmRemove(attendee)"
            >
              Remove
            </button>
          </div>
        </div>
      </div>

      <datalist id="attendee-cluster-suggestions">
        <option v-for="cluster in clusters" :key="cluster.value" :value="cluster.value" />
      </datalist>

      <div
        v-if="totalPages > 1 || filteredAttendees.length > 0"
        class="mt-4 flex flex-wrap items-center justify-between gap-2 font-mono text-xs text-g-muted"
      >
        <span>{{ filteredAttendees.length }} result{{ filteredAttendees.length === 1 ? '' : 's' }} · page {{ currentPage }} of {{ totalPages }}</span>
        <div class="flex gap-2">
          <button
            type="button"
            :disabled="currentPage === 1"
            class="btn-secondary"
            @click="currentPage--"
          >
            ← Prev
          </button>
          <button
            type="button"
            :disabled="currentPage === totalPages"
            class="btn-secondary"
            @click="currentPage++"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useDialog } from '@/composables/useDialog'
import { isPendingStatus, type AttendeeRow } from '@/composables/useEventAttendees'
import { formatStoredDateTime } from '@/lib/tix/timestamps'

const props = defineProps<{
  attendees: AttendeeRow[]
  loading: boolean
  actionPending: string
  exporting: boolean
  downloadingZip: boolean
  tabFilter: string | null
  tabLabel: string
  clusters: { value: string }[]
}>()

const emit = defineEmits<{
  checkIn: [id: string]
  checkOut: [id: string]
  remove: [id: string]
  restore: [id: string]
  downloadQr: [attendee: AttendeeRow]
  downloadZip: []
  export: []
  saveCluster: [id: string, value: string | null]
}>()

const dialog = useDialog()
const searchQuery = ref('')
const sortField = ref<'name' | 'email' | 'status' | 'time'>('name')
const sortDir = ref<'asc' | 'desc'>('asc')
const currentPage = ref(1)
const PAGE_SIZE = 10
const editingClusterAttendee = ref('')
const attendeeClusterEditValue = ref('')

watch(() => props.tabFilter, () => {
  currentPage.value = 1
  searchQuery.value = ''
})

watch(searchQuery, () => { currentPage.value = 1 })

const filteredAttendees = computed(() => {
  let list = !props.tabFilter
    ? [...props.attendees]
    : props.tabFilter === 'pending'
      ? props.attendees.filter((attendee) => isPendingStatus(attendee.status))
      : props.attendees.filter((attendee) => attendee.status === props.tabFilter)

  const query = searchQuery.value.trim().toLowerCase()
  if (query) {
    list = list.filter((attendee) =>
      `${attendee.first_name} ${attendee.last_name}`.toLowerCase().includes(query)
      || (attendee.email ?? '').toLowerCase().includes(query)
      || (attendee.cluster_value ?? '').toLowerCase().includes(query),
    )
  }

  list.sort((left, right) => {
    let leftValue = ''
    let rightValue = ''
    if (sortField.value === 'name') {
      leftValue = `${left.first_name} ${left.last_name}`.toLowerCase()
      rightValue = `${right.first_name} ${right.last_name}`.toLowerCase()
    } else if (sortField.value === 'email') {
      leftValue = (left.email ?? '').toLowerCase()
      rightValue = (right.email ?? '').toLowerCase()
    } else if (sortField.value === 'status') {
      leftValue = left.status ?? ''
      rightValue = right.status ?? ''
    } else {
      leftValue = left.actioned_at ?? ''
      rightValue = right.actioned_at ?? ''
    }
    const compared = leftValue.localeCompare(rightValue)
    return sortDir.value === 'asc' ? compared : -compared
  })
  return list
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredAttendees.value.length / PAGE_SIZE)))

const paginatedAttendees = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE
  return filteredAttendees.value.slice(start, start + PAGE_SIZE)
})

function sortMark(field: typeof sortField.value) {
  if (sortField.value !== field && !(field === 'status' && sortField.value === 'time')) return '↕'
  return sortDir.value === 'asc' ? '↑' : '↓'
}

function toggleSort(field: typeof sortField.value) {
  if (sortField.value === field) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  else {
    sortField.value = field
    sortDir.value = 'asc'
  }
  currentPage.value = 1
}

function statusLabel(status: string | null) {
  if (isPendingStatus(status)) return 'Pending'
  return { checked_in: 'Checked in', checked_out: 'Checked out', removed: 'Removed' }[status ?? ''] ?? 'Pending'
}

function statusClass(status: string | null) {
  return {
    checked_in: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    checked_out: 'bg-gray-100 text-gray-600 dark:bg-slate-700/50 dark:text-slate-400',
    removed: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  }[status ?? ''] ?? 'bg-gray-100 text-gray-400 dark:bg-slate-800/50 dark:text-slate-500'
}

function startEditAttendeeCluster(id: string, current: string | null) {
  editingClusterAttendee.value = id
  attendeeClusterEditValue.value = current ?? ''
}

function saveAttendeeCluster(id: string) {
  if (editingClusterAttendee.value !== id) return
  editingClusterAttendee.value = ''
  emit('saveCluster', id, attendeeClusterEditValue.value.trim() || null)
}

async function confirmRemove(attendee: AttendeeRow) {
  const name = `${attendee.first_name} ${attendee.last_name}`.trim()
  const ok = await dialog.confirm({
    title: 'Remove this attendee?',
    body: `${name} will be marked removed. You can restore them later.`,
    confirmLabel: 'Remove attendee',
  })
  if (!ok) return
  emit('remove', attendee.id)
}
</script>
