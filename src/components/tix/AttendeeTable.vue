<template>
  <div>
    <div class="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      <Input
        v-model="searchQuery"
        type="search"
        placeholder="Search by name, email, or group…"
        aria-label="Search attendees"
        class="min-w-0 flex-1"
      />
      <div class="flex gap-2">
        <Button
          type="button"
          variant="outline"
          :disabled="!attendees.length || downloadingZip"
          class="flex-1 sm:flex-none"
          @click="emit('downloadZip')"
        >
          {{ downloadingZip ? 'Preparing ZIP…' : 'Download all (ZIP)' }}
        </Button>
        <Button
          type="button"
          variant="outline"
          :disabled="!attendees.length || exporting"
          class="flex-1 sm:flex-none"
          @click="emit('export')"
        >
          {{ exporting ? '…' : 'Export .xlsx' }}
        </Button>
      </div>
    </div>

    <div class="mb-3 md:hidden">
      <Label
        for="attendee-sort"
        class="sr-only"
      >Sort attendees</Label>
      <select
        id="attendee-sort"
        v-model="sortField"
        class="h-11 w-full min-w-0 rounded-xl border border-input bg-transparent px-3.5 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 [&>option]:bg-popover [&>option]:text-popover-foreground"
        @change="currentPage = 1"
      >
        <option value="name">
          Sort by name
        </option>
        <option value="email">
          Sort by email
        </option>
        <option value="status">
          Sort by status
        </option>
      </select>
    </div>

    <div
      v-if="loading"
      class="space-y-2"
    >
      <div
        v-for="i in 5"
        :key="i"
        class="h-14 animate-pulse rounded-xl bg-muted"
      />
    </div>

    <div v-else>
      <div
        data-attendee-scroll
        class="overflow-x-auto"
      >
        <div
          data-attendee-list
          class="space-y-3 md:min-w-176 md:space-y-0 md:overflow-hidden md:rounded-2xl md:border md:border-border"
        >
          <div class="hidden grid-cols-12 border-b border-border bg-card text-sm font-semibold text-foreground md:grid">
            <Button
              type="button"
              variant="ghost"
              class="col-span-4 h-11 justify-start gap-1 rounded-none px-4"
              @click="toggleSort('name')"
            >
              Attendee <span class="opacity-40">{{ sortMark('name') }}</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              class="col-span-3 h-11 justify-start gap-1 rounded-none px-4"
              @click="toggleSort('email')"
            >
              Email <span class="opacity-40">{{ sortMark('email') }}</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              class="col-span-2 h-11 justify-start gap-1 rounded-none px-4"
              @click="toggleSort('status')"
            >
              Status <span class="opacity-40">{{ sortMark('status') }}</span>
            </Button>
            <div class="col-span-3 flex min-h-11 items-center justify-end px-4">
              Actions
            </div>
          </div>

          <div
            v-if="!filteredAttendees.length"
            class="rounded-2xl border border-border px-4 py-12 text-center text-sm font-medium text-muted-foreground md:rounded-none md:border-0"
          >
            {{ searchQuery.trim() ? `No results for "${searchQuery.trim()}"` : `No ${tabLabel.toLowerCase()} attendees` }}
          </div>

          <Card
            v-for="attendee in paginatedAttendees"
            :key="attendee.id"
            data-attendee-row
            class="gap-3 rounded-2xl p-4 md:grid md:grid-cols-12 md:items-center md:gap-0 md:rounded-none md:border-b md:border-border md:bg-transparent md:px-0 md:py-3 md:ring-0 md:last:border-0"
          >
            <div class="min-w-0 md:col-span-4 md:px-4">
              <p class="break-words font-mono text-base font-bold text-foreground">
                {{ attendee.first_name }} {{ attendee.last_name }}
              </p>
              <p class="truncate font-mono text-sm text-muted-foreground md:hidden">
                {{ attendee.email }}
              </p>
              <template v-if="editingClusterAttendee === attendee.id">
                <Input
                  v-model="attendeeClusterEditValue"
                  type="text"
                  aria-label="Cluster"
                  list="attendee-cluster-suggestions"
                  placeholder="Cluster…"
                  class="mt-1"
                  @keydown.enter="saveAttendeeCluster(attendee.id)"
                  @keydown.escape="editingClusterAttendee = ''"
                  @blur="saveAttendeeCluster(attendee.id)"
                />
              </template>
              <Button
                v-else
                type="button"
                variant="ghost"
                size="sm"
                class="-ml-2 mt-0.5 h-11 px-2 font-mono text-sm text-muted-foreground"
                :title="attendee.cluster_value ? 'Edit cluster' : 'Assign cluster'"
                @click="startEditAttendeeCluster(attendee.id, attendee.cluster_value)"
              >
                {{ attendee.cluster_value || '+ cluster' }}
              </Button>
            </div>
            <div class="hidden min-w-0 md:col-span-3 md:block md:px-4">
              <p class="truncate font-mono text-sm text-muted-foreground">
                {{ attendee.email }}
              </p>
            </div>
            <div class="md:col-span-2 md:px-4">
              <Badge :variant="statusVariant(attendee.status)">
                {{ statusLabel(attendee.status) }}
              </Badge>
              <p
                v-if="attendee.actioned_at"
                class="mt-1 font-mono text-sm text-muted-foreground"
              >
                {{ formatStoredDateTime(attendee.actioned_at) }}
              </p>
            </div>
            <div class="flex flex-wrap gap-2 md:col-span-3 md:justify-end md:px-4">
              <Button
                v-if="attendee.status !== 'checked_in' && attendee.status !== 'removed'"
                type="button"
                :disabled="!!actionPending"
                title="Check in"
                @click="emit('checkIn', attendee.id)"
              >
                In
              </Button>
              <Button
                v-if="attendee.status === 'checked_in'"
                type="button"
                variant="secondary"
                :disabled="!!actionPending"
                title="Check out"
                @click="emit('checkOut', attendee.id)"
              >
                Out
              </Button>
              <Button
                v-if="attendee.status === 'removed'"
                type="button"
                :disabled="!!actionPending"
                @click="emit('restore', attendee.id)"
              >
                Restore
              </Button>
              <Button
                type="button"
                variant="outline"
                @click="emit('downloadQr', attendee)"
              >
                Download QR
              </Button>
              <Button
                v-if="attendee.status !== 'removed'"
                type="button"
                variant="destructive"
                :disabled="!!actionPending"
                title="Remove"
                @click="emit('remove', attendee.id)"
              >
                Remove
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <datalist id="attendee-cluster-suggestions">
        <option
          v-for="cluster in clusters"
          :key="cluster.value"
          :value="cluster.value"
        />
      </datalist>

      <div
        v-if="totalPages > 1 || filteredAttendees.length > 0"
        class="mt-4 flex flex-wrap items-center justify-between gap-2 font-mono text-xs text-muted-foreground"
      >
        <span>{{ filteredAttendees.length }} result{{ filteredAttendees.length === 1 ? '' : 's' }} · page {{ currentPage }} of {{ totalPages }}</span>
        <div class="flex gap-2">
          <Button
            type="button"
            variant="outline"
            :disabled="currentPage === 1"
            @click="currentPage--"
          >
            ← Prev
          </Button>
          <Button
            type="button"
            variant="outline"
            :disabled="currentPage === totalPages"
            @click="currentPage++"
          >
            Next →
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { isPendingStatus, type AttendeeRow } from '@/composables/useEventAttendees'
import { formatStoredDateTime } from '@/lib/tix/timestamps'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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

function statusVariant(status: string | null) {
  const variants = { checked_in: 'default', checked_out: 'secondary', removed: 'destructive' } as const
  return variants[(status ?? '') as keyof typeof variants] ?? 'outline'
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
</script>
