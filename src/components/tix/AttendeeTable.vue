<template>
  <div>
    <div class="mb-3 flex flex-wrap gap-2">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Search by name, email, or group…"
        aria-label="Search attendees"
        class="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 font-mono text-xs outline-none transition-colors focus:border-[#34418F] dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-200 dark:placeholder-slate-500 dark:focus:border-slate-400"
      />
      <button
        type="button"
        :disabled="!attendees.length || downloadingZip"
        class="flex-shrink-0 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-500 transition-colors hover:border-[#34418F] hover:text-[#34418F] disabled:opacity-40 dark:border-slate-600 dark:text-slate-400 dark:hover:border-slate-400"
        @click="emit('downloadZip')"
      >
        {{ downloadingZip ? 'Preparing ZIP…' : 'Download all (ZIP)' }}
      </button>
      <button
        type="button"
        :disabled="!attendees.length || exporting"
        class="flex-shrink-0 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-500 transition-colors hover:border-[#34418F] hover:text-[#34418F] disabled:opacity-40 dark:border-slate-600 dark:text-slate-400 dark:hover:border-slate-400"
        @click="emit('export')"
      >
        {{ exporting ? '…' : 'Export .xlsx' }}
      </button>
    </div>

    <div v-if="loading" class="space-y-2">
      <div v-for="i in 5" :key="i" class="h-14 animate-pulse rounded-xl bg-gray-200 dark:bg-slate-800/60" />
    </div>

    <div v-else>
      <div class="overflow-x-auto rounded-2xl border border-gray-200 dark:border-slate-600">
        <div>
          <div class="grid grid-cols-12 border-b border-gray-100 bg-gray-50/60 text-data text-xs font-semibold text-[#34418F] dark:border-slate-700 dark:bg-mica-navy-header dark:text-slate-300">
            <button type="button" class="col-span-5 flex items-center gap-1 px-4 py-3 text-left transition-colors hover:text-[#2a3578] dark:hover:text-slate-100 sm:col-span-4" @click="toggleSort('name')">
              Attendee <span class="opacity-40">{{ sortMark('name') }}</span>
            </button>
            <button type="button" class="col-span-3 hidden items-center gap-1 px-4 py-3 text-left transition-colors hover:text-[#2a3578] dark:hover:text-slate-100 sm:flex" @click="toggleSort('email')">
              Email <span class="opacity-40">{{ sortMark('email') }}</span>
            </button>
            <button type="button" class="col-span-3 flex items-center gap-1 px-4 py-3 text-left transition-colors hover:text-[#2a3578] dark:hover:text-slate-100" @click="toggleSort('status')">
              Status <span class="opacity-40">{{ sortMark('status') }}</span>
            </button>
            <div class="col-span-4 px-4 py-3 text-right sm:col-span-2">Actions</div>
          </div>

          <div
            v-if="!filteredAttendees.length"
            class="px-4 py-12 text-center text-sm font-medium text-gray-400 dark:text-slate-500"
          >
            {{ searchQuery.trim() ? `No results for "${searchQuery.trim()}"` : `No ${tabLabel.toLowerCase()} attendees` }}
          </div>

          <div
            v-for="attendee in paginatedAttendees"
            :key="attendee.id"
            class="grid grid-cols-12 items-center border-b border-gray-100 px-4 py-3 transition-colors last:border-0 hover:bg-gray-50/60 dark:border-slate-700/60 dark:hover:bg-mica-navy-row-hover"
          >
            <div class="col-span-5 sm:col-span-4">
              <p class="font-mono text-sm font-bold text-gray-900 dark:text-slate-100">{{ attendee.first_name }} {{ attendee.last_name }}</p>
              <template v-if="editingClusterAttendee === attendee.id">
                <input
                  v-model="attendeeClusterEditValue"
                  type="text"
                  aria-label="Cluster"
                  list="attendee-cluster-suggestions"
                  placeholder="Cluster…"
                  class="mt-0.5 w-full rounded border border-[#34418F] px-1.5 py-0.5 font-mono text-[0.6rem] outline-none dark:border-slate-500 dark:bg-slate-800 dark:text-slate-200"
                  @keydown.enter="saveAttendeeCluster(attendee.id)"
                  @keydown.escape="editingClusterAttendee = ''"
                  @blur="saveAttendeeCluster(attendee.id)"
                />
              </template>
              <button
                v-else
                type="button"
                class="mt-0.5 cursor-pointer border-0 bg-transparent p-0 text-left font-mono text-[0.6rem] text-gray-400 transition-colors hover:text-[#34418F] dark:text-slate-500 dark:hover:text-slate-300"
                :title="attendee.cluster_value ? 'Edit cluster' : 'Assign cluster'"
                @click="startEditAttendeeCluster(attendee.id, attendee.cluster_value)"
              >
                {{ attendee.cluster_value || '+ cluster' }}
              </button>
            </div>
            <div class="col-span-3 hidden sm:block">
              <p class="truncate font-mono text-xs text-gray-500 dark:text-slate-400">{{ attendee.email }}</p>
            </div>
            <div class="col-span-3">
              <span
                :class="statusClass(attendee.status)"
                class="rounded px-2 py-0.5 font-mono text-[0.65rem] font-bold tracking-wide"
              >
                {{ statusLabel(attendee.status) }}
              </span>
              <p v-if="attendee.actioned_at" class="mt-0.5 font-mono text-[0.6rem] text-gray-400 dark:text-slate-500">
                {{ formatStoredDateTime(attendee.actioned_at) }}
              </p>
            </div>
            <div class="col-span-4 flex flex-wrap justify-end gap-1 sm:col-span-2">
              <button
                v-if="attendee.status !== 'checked_in' && attendee.status !== 'removed'"
                type="button"
                :disabled="!!actionPending"
                class="rounded-lg bg-emerald-500 px-2 py-1 font-mono text-[0.6rem] font-bold uppercase tracking-wide text-white transition-colors hover:bg-emerald-600 disabled:opacity-40"
                title="Check in"
                @click="emit('checkIn', attendee.id)"
              >
                In
              </button>
              <button
                v-if="attendee.status === 'checked_in'"
                type="button"
                :disabled="!!actionPending"
                class="rounded-lg bg-gray-500 px-2 py-1 font-mono text-[0.6rem] font-bold uppercase tracking-wide text-white transition-colors hover:bg-gray-600 disabled:opacity-40"
                title="Check out"
                @click="emit('checkOut', attendee.id)"
              >
                Out
              </button>
              <button
                v-if="attendee.status === 'removed'"
                type="button"
                :disabled="!!actionPending"
                class="rounded-lg bg-[#34418F] px-2 py-1 text-[0.65rem] font-semibold text-white transition-colors hover:brightness-110 disabled:opacity-40 dark:bg-slate-600"
                @click="emit('restore', attendee.id)"
              >
                Restore
              </button>
              <button
                type="button"
                class="rounded-lg border border-gray-200 px-2 py-1 text-[0.65rem] font-semibold text-gray-600 transition-colors hover:border-[#34418F] hover:text-[#34418F] dark:border-slate-600 dark:text-slate-300"
                @click="emit('downloadQr', attendee)"
              >
                Download QR
              </button>
              <button
                v-if="attendee.status !== 'removed'"
                type="button"
                :disabled="!!actionPending"
                class="rounded-lg bg-red-500 px-2 py-1 text-[0.65rem] font-semibold text-white transition-colors hover:bg-red-600 disabled:opacity-40"
                title="Remove"
                @click="confirmRemove(attendee)"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      </div>

      <datalist id="attendee-cluster-suggestions">
        <option v-for="cluster in clusters" :key="cluster.value" :value="cluster.value" />
      </datalist>

      <div
        v-if="totalPages > 1 || filteredAttendees.length > 0"
        class="mt-4 flex items-center justify-between font-mono text-xs text-gray-400 dark:text-slate-500"
      >
        <span>{{ filteredAttendees.length }} result{{ filteredAttendees.length === 1 ? '' : 's' }} · page {{ currentPage }} of {{ totalPages }}</span>
        <div class="flex gap-1">
          <button
            type="button"
            :disabled="currentPage === 1"
            class="rounded-lg border border-gray-200 px-3 py-1.5 transition-colors hover:border-[#34418F] hover:text-[#34418F] disabled:opacity-30 dark:border-slate-600 dark:hover:border-slate-400"
            @click="currentPage--"
          >
            ← Prev
          </button>
          <button
            type="button"
            :disabled="currentPage === totalPages"
            class="rounded-lg border border-gray-200 px-3 py-1.5 transition-colors hover:border-[#34418F] hover:text-[#34418F] disabled:opacity-30 dark:border-slate-600 dark:hover:border-slate-400"
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
