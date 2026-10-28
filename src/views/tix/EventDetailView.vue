<template>
  <div class="relative w-full">
    <PageSkeleton v-if="loadingEvent" />

    <AppPage
      v-else-if="!event"
      title="Event not found"
      description="This event does not exist or you do not have access to it."
    >
      <Button
        as-child
        variant="outline"
      >
        <router-link to="/manage/tix">
          ← My events
        </router-link>
      </Button>
    </AppPage>

    <AppPage
      v-else
      :title="event.name"
    >
      <template #description>
        {{ formatCalendarDate(event.eventDate) }} · {{ formatEventTime(event.eventTime) }} · {{ event.location }}
      </template>

      <div class="space-y-6">
        <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div
            v-if="event.isLead"
            class="flex flex-wrap items-center gap-2"
          >
            <span
              class="font-mono text-sm font-bold"
              :class="isAtCapacity ? 'text-destructive' : 'text-muted-foreground'"
            >
              {{ guestCount }}{{ event.maxAttendees ? ` / ${event.maxAttendees}` : '' }} guests
            </span>
            <template v-if="isCancelled" />
            <template v-else-if="!editingMax">
              <Button
                type="button"
                variant="ghost"
                class="min-w-11 font-mono text-sm text-muted-foreground"
                title="Edit max attendees"
                @click="startEditMax"
              >
                Edit
              </Button>
            </template>
            <template v-else>
              <Input
                ref="maxEditInput"
                v-model.number="maxEditValue"
                type="number"
                aria-label="Max attendees"
                min="1"
                placeholder="∞"
                class="w-24 font-mono"
                @keydown.enter="saveMax"
                @keydown.escape="editingMax = false"
              />
              <Button
                type="button"
                variant="ghost"
                class="min-w-11 font-mono text-sm text-primary"
                @click="saveMax"
              >
                Save
              </Button>
              <Button
                type="button"
                variant="ghost"
                class="min-w-11 font-mono text-sm text-muted-foreground"
                @click="editingMax = false"
              >
                Cancel
              </Button>
            </template>
          </div>

          <div class="flex flex-wrap gap-2 sm:ml-auto">
            <Button
              v-if="event.isLead && !isCancelled && (event.selectionLocked || !isImport)"
              type="button"
              :disabled="isAtCapacity"
              @click="showAddGuest = true"
            >
              Add guest
            </Button>
            <Button
              as-child
              variant="outline"
            >
              <a
                :href="`/tix/${slug}`"
                target="_blank"
                rel="noopener"
              >
                Attendee view
              </a>
            </Button>
          </div>
        </div>

        <div class="-mx-4 flex items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div
            class="flex w-max gap-2 sm:w-auto sm:flex-wrap"
            role="tablist"
            aria-label="Event sections"
          >
            <Button
              v-for="(tab, index) in mainTabs"
              :id="`main-tab-${tab.id}`"
              :key="tab.id"
              type="button"
              role="tab"
              data-main-tab
              :variant="mainTab === tab.id ? 'default' : 'ghost'"
              :aria-selected="mainTab === tab.id"
              aria-controls="main-tabpanel"
              :tabindex="mainTab === tab.id ? 0 : -1"
              class="shrink-0 text-sm font-semibold"
              @click="mainTab = tab.id"
              @keydown="onTabKeydown($event, mainTabs.length, index, (i) => (mainTab = mainTabs[i].id))"
            >
              {{ tab.label }}
            </Button>
          </div>
          <Button
            as-child
            variant="ghost"
            class="shrink-0 text-sm font-semibold"
          >
            <router-link
              data-door-link
              :to="`/manage/tix/${slug}/door`"
            >
              Door
            </router-link>
          </Button>
        </div>

        <div
          id="main-tabpanel"
          role="tabpanel"
          tabindex="0"
          :aria-labelledby="`main-tab-${mainTab}`"
          class="space-y-6 outline-none"
        >
          <template v-if="mainTab === 'overview'">
            <AppSection
              v-if="event.isLead"
              title="Status"
            >
              <p
                class="text-sm font-medium"
                data-event-status
              >
                {{ statusLabel }}
              </p>
              <p class="mt-1 text-sm text-muted-foreground">
                {{ statusHint }}
              </p>
              <div
                v-if="!isCancelled"
                class="mt-4 flex flex-wrap gap-2"
              >
                <Button
                  v-if="event.status === 'draft'"
                  type="button"
                  :disabled="changingStatus"
                  @click="changeStatus('publish')"
                >
                  Publish
                </Button>
                <Button
                  v-if="event.status === 'published'"
                  type="button"
                  variant="outline"
                  :disabled="changingStatus"
                  @click="changeStatus('close')"
                >
                  Close registration
                </Button>
                <Button
                  v-if="event.status === 'closed'"
                  type="button"
                  variant="outline"
                  :disabled="changingStatus"
                  @click="changeStatus('publish')"
                >
                  Reopen registration
                </Button>
                <Button
                  v-if="event.status === 'published' || event.status === 'closed'"
                  type="button"
                  variant="destructive"
                  :disabled="changingStatus"
                  @click="changeStatus('cancel')"
                >
                  Cancel event
                </Button>
              </div>
            </AppSection>

            <AppSection
              v-if="!isImport"
              title="Event settings"
            >
              <dl
                class="grid gap-3 text-sm sm:grid-cols-2"
                data-event-summary
              >
                <div>
                  <dt class="text-muted-foreground">
                    Admission
                  </dt>
                  <dd class="font-medium">
                    {{ modeLabel }}
                  </dd>
                </div>
                <div v-if="event.registrationClosesAt">
                  <dt class="text-muted-foreground">
                    Registration closes
                  </dt>
                  <dd class="font-medium">
                    {{ formatStoredDateTime(event.registrationClosesAt) }}
                  </dd>
                </div>
              </dl>
              <Button
                v-if="!isCancelled"
                as-child
                variant="outline"
                class="mt-4"
              >
                <router-link :to="`/manage/tix/${slug}/edit`">
                  Edit event
                </router-link>
              </Button>
            </AppSection>

            <AppSection
              v-if="event.isLead && passColumns.length"
              title="Pass fields"
            >
              <fieldset>
                <legend class="sr-only">
                  Pass fields
                </legend>
                <p class="mb-3 text-sm text-muted-foreground">
                  Checked columns are printed on the wallet pass.
                </p>
                <div class="flex flex-wrap gap-2">
                  <label
                    v-for="column in passColumns"
                    :key="column"
                    class="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 transition-colors"
                    :class="passFieldSelection.includes(column)
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:bg-muted'"
                  >
                    <input
                      type="checkbox"
                      :checked="passFieldSelection.includes(column)"
                      class="size-5 accent-primary"
                      @change="togglePassField(column)"
                    >
                    <span class="font-mono text-sm text-foreground">{{ column }}</span>
                  </label>
                </div>
                <Button
                  type="button"
                  class="mt-4"
                  :disabled="savingPassFields || isCancelled"
                  @click="savePassFields"
                >
                  {{ savingPassFields ? 'Saving…' : 'Save pass fields' }}
                </Button>
              </fieldset>
            </AppSection>

            <ClusterBars
              v-if="event.isLead && clusters.length"
              :slug="slug"
              :clusters="clusters"
              @updated="refreshAfterGuestChange"
            />


            <div
              v-if="event.isLead"
              class="mt-12 border-t border-dashed border-destructive/30 pt-8"
            >
              <p class="mb-1 font-heading text-lg font-semibold text-destructive">
                Danger zone
              </p>
              <p class="mb-4 text-sm text-muted-foreground">
                Permanently deletes this event and all attendee data. This cannot be undone. An event with student registrations cannot be deleted once it is published: cancel it instead.
              </p>
              <Button
                type="button"
                variant="destructive"
                :disabled="deletingEvent"
                @click="confirmDeleteEvent"
              >
                {{ deletingEvent ? 'Deleting…' : 'Delete event' }}
              </Button>
            </div>
          </template>

          <template v-else-if="mainTab === 'attendees'">
            <AttendeesInboxView
              v-if="!isImport"
              :key="inboxKey"
              :slug="slug"
              :questions="event.questions ?? []"
              :admission-mode="event.admissionMode ?? 'fcfs'"
              :waitlist-enabled="event.waitlistEnabled ?? false"
              @counts="(c) => (confirmedCount = c.confirmed)"
            />
            <template v-else>
              <div class="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
                <div
                  class="flex w-max gap-2 sm:w-auto sm:flex-wrap"
                  role="tablist"
                  aria-label="Attendee views"
                >
                  <Button
                    v-for="(tab, index) in TABS"
                    :key="tab.label"
                    type="button"
                    role="tab"
                    :variant="legacyTab === index ? 'default' : 'ghost'"
                    :aria-selected="legacyTab === index"
                    class="shrink-0 text-sm font-semibold"
                    @click="legacyTab = index"
                  >
                    {{ tab.label }}
                    <span
                      v-if="tab.filter !== null && attendees.length"
                      class="ml-1 opacity-70"
                    >({{ countForTab(tab.filter) }})</span>
                  </Button>
                </div>
              </div>

              <ScannerPanel
                v-if="legacyTab === 5"
                :slug="slug"
                @checked-in="fetchAttendees"
              />
              <AttendeeTable
                v-else
                :attendees="attendees"
                :loading="loadingAttendees"
                :action-pending="actionPending"
                :exporting="exportingXlsx"
                :downloading-zip="downloadingZip"
                :tab-filter="TABS[legacyTab].filter"
                :tab-label="TABS[legacyTab].label"
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
            </template>
          </template>

          <template v-else-if="mainTab === 'lottery' && event.admissionMode === 'lottery'">
            <ClusterBars
              v-if="event.isLead && clusters.length"
              :slug="slug"
              :clusters="clusters"
              @updated="refreshAfterGuestChange"
            />
            <LotteryPanel
              :slug="slug"
              :event="lotteryEvent"
              :clusters="clusters"
              @drawn="onDrawn"
              @go-overview="mainTab = 'overview'"
            />
          </template>

          <TixInsights
            v-else-if="mainTab === 'insights'"
            :slug="slug"
            :public-path="`/tix/${slug}`"
            :questions="event.questions ?? []"
          />
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { computed, defineAsyncComponent, nextTick, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '@/lib/api'
import { useDialog } from '@/composables/useDialog'
import { useToast } from '@/composables/useToast'
import { isPendingStatus, useEventAttendees } from '@/composables/useEventAttendees'
import { onTabKeydown } from '@/lib/tix/tabKeys'
import { formatCalendarDate, formatEventTime, formatStoredDateTime } from '@/lib/tix/timestamps'
import type { AdmissionMode, EventQuestion } from '@/lib/tix/eventState'
import AddGuestPanel, { type CsvColumnMapping } from '@/components/tix/AddGuestPanel.vue'
import AttendeeTable from '@/components/tix/AttendeeTable.vue'
import ClusterBars, { type EventClusterBar } from '@/components/tix/ClusterBars.vue'
import LotteryPanel from '@/components/tix/LotteryPanel.vue'
import AttendeesInboxView from '@/views/tix/AttendeesInboxView.vue'
import ScannerPanel from '@/components/tix/ScannerPanel.vue'
import AppPage from '@/components/layout/AppPage.vue'
import AppSection from '@/components/layout/AppSection.vue'
import PageSkeleton from '@/components/PageSkeleton.vue'

const TixInsights = defineAsyncComponent(() => import('@/components/insights/TixInsights.vue'))

const toast = useToast()
const dialog = useDialog()
const route = useRoute()
const router = useRouter()
const slug = route.params.id as string

interface EventInfo {
  name: string
  status?: string
  confirmedCount?: number
  admissionMode?: AdmissionMode
  registrationOpensAt?: string | null
  registrationClosesAt?: string | null
  waitlistEnabled?: boolean
  lotteryDrawnAt?: string | null
  questions?: EventQuestion[]
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
type MainTab = 'overview' | 'attendees' | 'lottery' | 'insights'
const mainTab = ref<MainTab>('overview')
const legacyTab = ref(0)
const inboxKey = ref(0)
const showAddGuest = ref(false)
const hasCsvRows = ref(false)
const csvColMapping = ref<CsvColumnMapping>({})
const csvColumns = ref<string[]>([])
const passFieldSelection = ref<string[]>([])
const savingPassFields = ref(false)
const editingMax = ref(false)
const maxEditValue = ref<number | null>(null)
const maxEditInput = ref<InstanceType<typeof Input> | null>(null)

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

// Events saved before the admission modes existed have no mode and behave as imports.
const isImport = computed(() => (event.value?.admissionMode ?? 'import') === 'import')

const mainTabs = computed<{ id: MainTab; label: string }[]>(() => [
  { id: 'overview', label: 'Overview' },
  { id: 'attendees', label: 'Attendees' },
  ...(event.value?.admissionMode === 'lottery' ? [{ id: 'lottery' as const, label: 'Lottery' }] : []),
  { id: 'insights' as const, label: 'Insights' },
])

const STATUS_LABELS: Record<string, string> = { draft: 'Draft', published: 'Published', closed: 'Closed', cancelled: 'Cancelled' }
const MODE_LABELS: Record<AdmissionMode, string> = {
  fcfs: 'First come, first served',
  lottery: 'Lottery',
  approval: 'Manual approval',
  import: 'Invite only (attendee list)',
}
const statusLabel = computed(() => STATUS_LABELS[event.value?.status ?? ''] ?? 'Draft')
const isCancelled = computed(() => event.value?.status === 'cancelled')
const STATUS_HINTS: Record<string, string> = {
  draft: 'Only your organization can see this event. Publish it when you are ready.',
  published: 'The event page is live and registration follows your window.',
  closed: 'Registration is closed. People who registered keep their place.',
  cancelled: 'This event was cancelled and is read-only.',
}
const statusHint = computed(() => STATUS_HINTS[event.value?.status ?? ''] ?? STATUS_HINTS.draft)
const modeLabel = computed(() => MODE_LABELS[event.value?.admissionMode ?? 'import'])

const lotteryEvent = computed(() => ({
  status: event.value?.status ?? 'draft',
  eventDate: event.value?.eventDate ?? '',
  eventTime: event.value?.eventTime ?? '',
  registrationOpensAt: event.value?.registrationOpensAt ?? null,
  registrationClosesAt: event.value?.registrationClosesAt ?? null,
  waitlistEnabled: event.value?.waitlistEnabled ?? false,
  lotteryDrawnAt: event.value?.lotteryDrawnAt ?? null,
  questions: event.value?.questions ?? [],
}))

// Seats taken. Import events count everyone not removed; the other modes count confirmed guests only,
// so pending, entered, waitlisted, declined and cancelled people never use up capacity.
const confirmedCount = ref(0)
const guestCount = computed(() => (isImport.value ? activeAttendeeCount.value : confirmedCount.value))

async function refreshConfirmedCount() {
  try {
    const res = await api.raw(`/api/events/${slug}`)
    if (!res.ok) return
    const data = await res.json() as { event?: { confirmedCount?: number } }
    confirmedCount.value = data.event?.confirmedCount ?? confirmedCount.value
  } catch { /* the header count stays as it was */ }
}

function onDrawn() {
  if (event.value) event.value.lotteryDrawnAt = new Date().toISOString()
  void refreshConfirmedCount()
}

const passColumns = computed(() => {
  const names = new Set<string>([...csvColumns.value, ...passFieldSelection.value])
  return [...names].filter((name) => name.trim() !== '').sort((left, right) => left.localeCompare(right))
})

const isAtCapacity = computed(() =>
  event.value?.maxAttendees != null && guestCount.value >= event.value.maxAttendees,
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
  nextTick(() => (maxEditInput.value?.$el as HTMLInputElement | undefined)?.focus())
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
  inboxKey.value += 1
  if (isImport.value) await fetchAttendees()
  else await refreshConfirmedCount()
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

function messageFrom(data: { message?: string; error?: { message?: string } } | null, fallback: string): string {
  return data?.error?.message ?? data?.message ?? fallback
}

const changingStatus = ref(false)
const STATUS_CHANGES = {
  publish: {
    title: 'Publish this event?',
    body: 'The event page goes live and people can register while the window is open.',
    confirmLabel: 'Publish',
    done: 'Event published.',
    fail: 'Could not publish the event.',
  },
  close: {
    title: 'Close registration?',
    body: 'No one new can register until you reopen it. People who registered keep their place.',
    confirmLabel: 'Close registration',
    done: 'Registration closed.',
    fail: 'Could not close registration.',
  },
  cancel: {
    title: 'Cancel this event?',
    body: 'Registration closes and every registration is cancelled. The event becomes read-only. This cannot be undone.',
    confirmLabel: 'Cancel event',
    done: 'Event cancelled.',
    fail: 'Could not cancel the event.',
  },
} as const

async function changeStatus(action: keyof typeof STATUS_CHANGES) {
  const copy = STATUS_CHANGES[action]
  const reopening = action === 'publish' && event.value?.status === 'closed'
  const ok = await dialog.confirm({
    title: reopening ? 'Reopen registration?' : copy.title,
    body: reopening ? 'People can register again while the registration window is open.' : copy.body,
    confirmLabel: reopening ? 'Reopen registration' : copy.confirmLabel,
  })
  if (!ok) return
  changingStatus.value = true
  try {
    const res = await api.raw(`/api/events/${slug}/${action}`, { method: 'POST' })
    const data = await res.json().catch(() => null) as { message?: string; error?: { message?: string }; event?: { status?: string } } | null
    if (!res.ok) throw new Error(messageFrom(data, copy.fail))
    if (event.value) event.value.status = data?.event?.status ?? (action === 'cancel' ? 'cancelled' : action === 'close' ? 'closed' : 'published')
    toast.success(reopening ? 'Registration reopened.' : copy.done)
    if (action === 'cancel') await refreshAfterGuestChange()
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : copy.fail)
  } finally {
    changingStatus.value = false
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
    const data = await res.json().catch(() => null) as { message?: string; error?: { message?: string } } | null
    if (!res.ok) throw new Error(messageFrom(data, 'Delete failed.'))
    toast.success('Event deleted.')
    router.push('/manage/tix')
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Delete failed.')
  } finally {
    deletingEvent.value = false
  }
}

onMounted(async () => {
  // Door mode must load offline later; fetching its chunk now lets the service worker cache it.
  void import('@/views/tix/DoorModeView.vue').catch(() => undefined)
  try {
    const res = await api.raw(`/api/events/${slug}`)
    const data = await res.json() as { message?: string; event?: EventInfo }
    if (!res.ok) throw new Error(data.message ?? 'Event not found.')
    if (!data.event!.isLead) {
      router.replace(`/tix/${slug}`)
      return
    }
    // Only import events go through the selection wizard; the other modes have no attendee list to finalize.
    if ((data.event!.admissionMode ?? 'import') === 'import' && !data.event!.selectionLocked) {
      router.replace(`/manage/tix/${slug}/select`)
      return
    }
    event.value = data.event!
    confirmedCount.value = data.event!.confirmedCount ?? 0
    passFieldSelection.value = [...(data.event!.passFields ?? [])]
  } catch {
    event.value = null
    loadingEvent.value = false
    return
  }
  loadingEvent.value = false
  // The unpaged list is the import events' roster; its `status` is the latest check-in action, not admission.
  if (isImport.value) fetchAttendees()
  fetchClusters()
  fetchCsvMeta()
})
</script>
