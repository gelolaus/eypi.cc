<template>
  <div class="space-y-4">
    <div class="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div
        class="flex w-max gap-2 sm:w-auto sm:flex-wrap"
        role="tablist"
        aria-label="Registration status"
      >
        <Button
          v-for="(tab, index) in TABS"
          :id="`inbox-tab-${tab.status}`"
          :key="tab.status"
          type="button"
          role="tab"
          :variant="activeStatus === tab.status ? 'default' : 'ghost'"
          :aria-selected="activeStatus === tab.status"
          aria-controls="inbox-tabpanel"
          :tabindex="activeStatus === tab.status ? 0 : -1"
          class="shrink-0 text-sm font-semibold"
          @click="selectStatus(tab.status)"
          @keydown="onTabKeydown($event, TABS.length, index, (i) => selectStatus(TABS[i].status))"
        >
          {{ tab.label }} ({{ counts[tab.status] }})
        </Button>
      </div>
    </div>

    <div class="flex flex-col gap-2 sm:flex-row sm:items-start">
      <Input
        v-model="searchQuery"
        type="search"
        placeholder="Search by name or email…"
        aria-label="Search attendees"
        class="min-w-0 flex-1"
      />
      <div class="flex flex-col gap-1">
        <Button
          type="button"
          variant="outline"
          :disabled="exporting"
          @click="exportCsv"
        >
          {{ exporting ? 'Preparing…' : 'Export CSV' }}
        </Button>
      </div>
    </div>
    <p class="text-sm text-muted-foreground">
      Exporting also creates a private ticket link for each confirmed guest who does not have one.
    </p>

    <div
      v-if="selectedIds.length && (activeStatus === 'pending' || CANCELLABLE.has(activeStatus))"
      class="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3"
      role="group"
      aria-label="Bulk actions"
    >
      <span class="mr-auto text-sm font-semibold">{{ selectedIds.length }} selected</span>
      <Button
        v-if="activeStatus === 'pending'"
        type="button"
        :disabled="bulkBusy"
        @click="runBulk('approve')"
      >
        Approve
      </Button>
      <Button
        v-if="activeStatus === 'pending'"
        type="button"
        variant="outline"
        :disabled="bulkBusy"
        @click="runBulk('decline')"
      >
        Decline
      </Button>
      <Button
        v-if="CANCELLABLE.has(activeStatus)"
        type="button"
        variant="destructive"
        :disabled="bulkBusy"
        @click="runBulk('cancel')"
      >
        Cancel registrations
      </Button>
      <Button
        type="button"
        variant="ghost"
        :disabled="bulkBusy"
        @click="selected = new Set()"
      >
        Clear
      </Button>
    </div>

    <div
      aria-live="polite"
      data-bulk-live
    >
      <div
        v-if="bulkResult"
        data-bulk-result
        class="rounded-2xl border border-border bg-muted p-4 text-sm"
      >
        <p class="font-semibold">
          {{ bulkResult.updated }} {{ bulkResult.updated === 1 ? 'person' : 'people' }} {{ bulkResult.verb }}.
          <span v-if="bulkResult.skipped.length">{{ bulkResult.skipped.length }} skipped.</span>
        </p>
        <ul
          v-if="bulkResult.skipped.length"
          class="mt-2 list-disc space-y-1 pl-5"
        >
          <li
            v-for="item in bulkResult.skipped"
            :key="item.id"
          >
            {{ item.name }} ({{ item.reason }})
          </li>
        </ul>
      </div>
    </div>

    <p
      v-if="error"
      role="alert"
      class="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
    >
      {{ error }}
    </p>

    <div
      id="inbox-tabpanel"
      role="tabpanel"
      :aria-labelledby="`inbox-tab-${activeStatus}`"
      :aria-busy="loading"
    >
      <div
        v-if="loading"
        class="space-y-2"
      >
        <div
          v-for="i in 4"
          :key="i"
          class="h-16 animate-pulse rounded-2xl bg-muted"
        />
      </div>

      <div
        v-else
        class="space-y-3"
      >
        <label
          v-if="rows.length"
          class="flex min-h-11 w-fit cursor-pointer items-center gap-2 text-sm"
        >
          <input
            type="checkbox"
            class="size-5 accent-primary"
            aria-label="Select all loaded attendees"
            :checked="allSelected"
            @change="toggleAll"
          >
          Select all loaded ({{ rows.length }})
        </label>

        <Card
          v-if="!rows.length && !error"
          class="rounded-2xl p-0"
        >
          <EmptyState :title="emptyTitle" />
        </Card>

        <Card
          v-for="row in rows"
          :key="row.id"
          data-attendee-row
          class="gap-3 rounded-2xl p-4"
        >
          <div class="flex flex-wrap items-start gap-3">
            <label class="flex min-h-11 min-w-11 cursor-pointer items-center justify-center">
              <input
                type="checkbox"
                class="size-5 accent-primary"
                :aria-label="`Select ${fullName(row)}`"
                :checked="selected.has(row.id)"
                @change="toggleOne(row.id)"
              >
            </label>
            <div class="min-w-0 flex-1">
              <p class="break-words font-mono text-sm font-bold">
                {{ fullName(row) }}
              </p>
              <p class="truncate font-mono text-xs text-muted-foreground">
                {{ row.email }}
              </p>
              <p
                v-if="row.registered_at"
                class="font-mono text-xs text-muted-foreground"
              >
                {{ row.source === 'self' ? 'Registered' : 'Added' }} {{ formatStoredDateTime(row.registered_at) }}
              </p>
            </div>
            <Badge :variant="STATUS_VARIANT[row.status] ?? 'outline'">
              {{ STATUS_LABEL[row.status] ?? row.status }}
            </Badge>
          </div>

          <div class="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              :aria-label="`Show answers for ${fullName(row)}`"
              :aria-expanded="expanded.has(row.id)"
              :aria-controls="`answers-${row.id}`"
              @click="toggleAnswers(row.id)"
            >
              {{ expanded.has(row.id) ? 'Hide answers' : 'Answers' }}
            </Button>
            <Button
              v-if="LINKABLE.has(row.status)"
              type="button"
              variant="outline"
              :aria-label="`New guest link for ${fullName(row)}`"
              :disabled="linkingId === row.id"
              @click="copyGuestLink(row)"
            >
              New guest link
            </Button>
            <Button
              v-if="row.status === 'cancelled' && !(row.source === 'self' && row.decided_by == null)"
              type="button"
              variant="outline"
              :aria-label="`Restore ${fullName(row)}`"
              :disabled="restoringId === row.id"
              @click="restore(row)"
            >
              Restore
            </Button>
          </div>

          <dl
            v-if="expanded.has(row.id)"
            :id="`answers-${row.id}`"
            data-answers
            class="space-y-2 rounded-xl bg-muted p-3 text-sm"
          >
            <template v-if="questions.length">
              <div
                v-for="question in questions"
                :key="question.id"
              >
                <dt class="text-muted-foreground">
                  {{ question.label }}
                </dt>
                <dd class="break-words font-medium">
                  {{ answerText(row, question.id) }}
                </dd>
              </div>
            </template>
            <p
              v-else
              class="text-muted-foreground"
            >
              This event has no questions.
            </p>
          </dl>
        </Card>

        <div
          v-if="nextCursor"
          class="pt-1"
        >
          <Button
            type="button"
            variant="outline"
            :disabled="loadingMore"
            @click="load(true)"
          >
            {{ loadingMore ? 'Loading…' : 'Load more' }}
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { api } from '@/lib/api'
import { useDialog } from '@/composables/useDialog'
import { useToast } from '@/composables/useToast'
import type { AdmissionMode, EventQuestion, TicketStatus } from '@/lib/tix/eventState'
import { onTabKeydown } from '@/lib/tix/tabKeys'
import { formatStoredDateTime } from '@/lib/tix/timestamps'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import EmptyState from '@/components/EmptyState.vue'

interface InboxRow {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  status: TicketStatus
  source: string | null
  decided_by?: string | null
  answers: Record<string, unknown>
  registered_at: string | null
}

type BulkAction = 'approve' | 'decline' | 'cancel'

const MAX_BULK = 200
const SEARCH_DELAY = 300

const TABS: { status: TicketStatus; label: string }[] = [
  { status: 'pending', label: 'Pending' },
  { status: 'entered', label: 'Entered' },
  { status: 'waitlisted', label: 'Waitlisted' },
  { status: 'confirmed', label: 'Confirmed' },
  { status: 'declined', label: 'Declined' },
  { status: 'cancelled', label: 'Cancelled' },
]

const STATUS_LABEL: Record<string, string> = Object.fromEntries(TABS.map((tab) => [tab.status, tab.label]))
const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  confirmed: 'default',
  entered: 'secondary',
  waitlisted: 'secondary',
  pending: 'outline',
  declined: 'destructive',
  cancelled: 'destructive',
}
const CANCELLABLE = new Set<TicketStatus>(['pending', 'entered', 'waitlisted', 'confirmed'])
const LINKABLE = new Set(['confirmed', 'pending', 'entered', 'waitlisted'])
const SKIP_COPY: Record<string, string> = {
  not_found: 'no longer on the list',
  invalid_transition: "can't move from their current status",
  event_full: 'the event is full',
}
const SKIP_FALLBACK = 'could not be changed'
const VERB: Record<BulkAction, string> = { approve: 'approved', decline: 'declined', cancel: 'cancelled' }

const props = defineProps<{
  slug: string
  questions: EventQuestion[]
  admissionMode: AdmissionMode
  waitlistEnabled?: boolean
}>()

const emit = defineEmits<{ changed: []; counts: [counts: Record<TicketStatus, number>] }>()

const dialog = useDialog()
const toast = useToast()

const DEFAULT_STATUS: Record<AdmissionMode, TicketStatus> = {
  approval: 'pending', lottery: 'entered', fcfs: 'confirmed', import: 'confirmed',
}
const activeStatus = ref<TicketStatus>(DEFAULT_STATUS[props.admissionMode])
const searchQuery = ref('')
const rows = ref<InboxRow[]>([])
const counts = ref<Record<TicketStatus, number>>({ pending: 0, entered: 0, waitlisted: 0, confirmed: 0, declined: 0, cancelled: 0 })
const nextCursor = ref<string | null>(null)
const loading = ref(true)
const loadingMore = ref(false)
const error = ref('')
const selected = ref<Set<string>>(new Set())
const expanded = ref<Set<string>>(new Set())
const bulkBusy = ref(false)
const bulkResult = ref<{ verb: string; updated: number; skipped: { id: string; name: string; reason: string }[] } | null>(null)
const linkingId = ref('')
const restoringId = ref('')
const exporting = ref(false)

let requestId = 0
let searchTimer: ReturnType<typeof setTimeout> | undefined

const selectedIds = computed(() => [...selected.value])
const allSelected = computed(() => rows.value.length > 0 && rows.value.every((row) => selected.value.has(row.id)))
const activeLabel = computed(() => STATUS_LABEL[activeStatus.value] ?? '')
const emptyTitle = computed(() => {
  const query = searchQuery.value.trim()
  return query ? `No results for "${query}"` : `No ${activeLabel.value.toLowerCase()} registrations`
})

function fullName(row: InboxRow): string {
  return `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim() || 'Guest'
}

function messageOf(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback
}

async function load(append = false) {
  const id = ++requestId
  if (append) loadingMore.value = true
  else {
    loading.value = true
    error.value = ''
  }
  const params = new URLSearchParams({ paged: '1', status: activeStatus.value })
  const q = searchQuery.value.trim()
  if (q) params.set('q', q)
  if (append && nextCursor.value) params.set('cursor', nextCursor.value)
  try {
    const data = await api.get<{ attendees: InboxRow[]; counts: Record<TicketStatus, number>; nextCursor: string | null }>(
      `/api/events/${props.slug}/attendees?${params.toString()}`,
    )
    if (id !== requestId) return
    rows.value = append ? [...rows.value, ...data.attendees] : data.attendees
    counts.value = data.counts
    emit('counts', data.counts)
    nextCursor.value = data.nextCursor
  } catch (err: unknown) {
    if (id === requestId) error.value = messageOf(err, 'Could not load attendees. Try again.')
  } finally {
    if (id === requestId) {
      loading.value = false
      loadingMore.value = false
    }
  }
}

function resetAndLoad() {
  selected.value = new Set()
  expanded.value = new Set()
  nextCursor.value = null
  void load()
}

function selectStatus(status: TicketStatus) {
  if (status === activeStatus.value) return
  activeStatus.value = status
  bulkResult.value = null
  resetAndLoad()
}

watch(searchQuery, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(resetAndLoad, SEARCH_DELAY)
})

function toggleOne(id: string) {
  const next = new Set(selected.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selected.value = next
}

function toggleAll() {
  selected.value = allSelected.value ? new Set() : new Set(rows.value.map((row) => row.id))
}

function toggleAnswers(id: string) {
  const next = new Set(expanded.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expanded.value = next
}

function answerText(row: InboxRow, questionId: string): string {
  const value = row.answers?.[questionId]
  if (Array.isArray(value)) return value.length ? value.join(', ') : 'No answer'
  if (typeof value === 'string' && value.trim()) return value
  return 'No answer'
}

async function runBulk(action: BulkAction) {
  const ids = selectedIds.value
  if (!ids.length || bulkBusy.value) return
  bulkBusy.value = true
  if (action !== 'approve') {
    const noun = `${ids.length} ${ids.length === 1 ? 'registration' : 'registrations'}`
    const ok = await dialog.confirm({
      title: action === 'decline' ? `Decline ${noun}?` : `Cancel ${noun}?`,
      body: action === 'decline'
        ? 'These people are told they did not get a place.'
        : `Their tickets stop working.${props.waitlistEnabled ? ' A confirmed guest\'s seat can go to the next person on the waitlist.' : ''}`,
      confirmLabel: action === 'decline' ? 'Decline' : 'Cancel registrations',
    })
    if (!ok) {
      bulkBusy.value = false
      return
    }
  }
  const names = new Map(rows.value.map((row) => [row.id, fullName(row)]))
  let updated = 0
  const skipped: { id: string; name: string; reason: string }[] = []
  try {
    for (let start = 0; start < ids.length; start += MAX_BULK) {
      const chunk = ids.slice(start, start + MAX_BULK)
      const res = await api.post<{ updated: number; skipped: { id: string; reason: string }[] }>(
        `/api/events/${props.slug}/attendees/bulk`,
        { ids: chunk, action },
      )
      updated += res.updated
      for (const item of res.skipped) {
        skipped.push({ id: item.id, name: names.get(item.id) ?? 'Someone', reason: SKIP_COPY[item.reason] ?? SKIP_FALLBACK })
      }
    }
    toast.success(`${updated} ${VERB[action]}.`)
  } catch (err: unknown) {
    toast.error(messageOf(err, 'Could not finish. Some changes may have been saved.'))
  } finally {
    bulkBusy.value = false
  }
  bulkResult.value = { verb: VERB[action], updated, skipped }
  resetAndLoad()
  emit('changed')
}

async function copyGuestLink(row: InboxRow) {
  // We cannot tell whether a link already exists, and a new one replaces it, so always ask first.
  const ok = await dialog.confirm({
    title: 'Create a new guest link?',
    body: 'Any link you shared before stops working.',
    confirmLabel: 'Create new link',
  })
  if (!ok) return
  linkingId.value = row.id
  try {
    const { url } = await api.post<{ url: string }>(`/api/events/${props.slug}/attendees/${row.id}/guest-link`)
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Guest link copied. Any earlier link for this guest no longer works.')
    } catch {
      toast.error('Could not copy to the clipboard.', { detail: url, duration: 20000 })
    }
  } catch (err: unknown) {
    toast.error(messageOf(err, 'Could not create a guest link.'))
  } finally {
    linkingId.value = ''
  }
}

async function restore(row: InboxRow) {
  restoringId.value = row.id
  try {
    await api.post(`/api/events/${props.slug}/restore`, { attendeeId: row.id })
    toast.success(`${fullName(row)} restored.`)
    resetAndLoad()
    emit('changed')
  } catch (err: unknown) {
    toast.error(messageOf(err, 'Could not restore this person.'))
  } finally {
    restoringId.value = ''
  }
}

async function exportCsv() {
  const orgId = localStorage.getItem('active_org_id') ?? ''
  if (!orgId) {
    toast.error('Pick an organization first, then export again.')
    return
  }
  exporting.value = true
  try {
    const res = await api.raw(`/api/events/${props.slug}/attendees.csv`, { headers: { 'X-Active-Org-Id': orgId } })
    if (!res.ok) throw new Error('Could not export the attendees. Try again.')
    const blob = await res.blob()
    const href = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = href
    link.download = `${props.slug}-attendees.csv`
    link.click()
    setTimeout(() => URL.revokeObjectURL(href), 1000)
  } catch (err: unknown) {
    toast.error(messageOf(err, 'Could not export the attendees. Try again.'))
  } finally {
    exporting.value = false
  }
}

onMounted(() => { void load() })
onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer)
})
</script>
