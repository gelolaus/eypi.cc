<template>
  <Teleport to="body">
  <Transition name="panel">
    <div v-if="open" class="fixed inset-0 flex items-end justify-center sm:items-stretch sm:justify-end" style="z-index: 99990">
      <button type="button" class="absolute inset-0 cursor-default border-0 bg-black/60 p-0 outline-none backdrop-blur-sm focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50" aria-label="Close add guest" @click="emit('close')" />
      <!-- eslint-disable-next-line vuejs-accessibility/no-static-element-interactions -- dialog handles focus and Escape -->
      <div
        ref="panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-guest-title"
        tabindex="-1"
        class="relative z-10 flex max-h-[92dvh] w-full flex-col overflow-y-auto rounded-t-3xl border-t border-border bg-popover pb-[env(safe-area-inset-bottom)] text-popover-foreground shadow-2xl outline-none sm:h-full sm:max-h-none sm:max-w-md sm:rounded-none sm:border-l sm:border-t-0"
        @keydown.esc.stop="emit('close')"
      >
        <div class="flex items-center justify-between border-b border-border px-5 py-2 sm:px-8">
          <h2 id="add-guest-title" class="text-sm font-semibold text-foreground">Add guest</h2>
          <Button type="button" variant="ghost" size="icon" class="font-mono text-lg" aria-label="Close" @click="emit('close')">×</Button>
        </div>

        <div class="flex border-b border-border">
          <Button
            v-if="hasCsvRows"
            type="button"
            variant="ghost"
            :class="[
              'h-11 flex-1 rounded-none border-b-2 text-sm font-semibold',
              guestMode === 'search' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground',
            ]"
            @click="guestMode = 'search'"
          >
            From CSV
          </Button>
          <Button
            type="button"
            variant="ghost"
            :class="[
              'h-11 flex-1 rounded-none border-b-2 text-sm font-semibold',
              guestMode === 'freeform' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground',
            ]"
            @click="guestMode = 'freeform'"
          >
            Free-form
          </Button>
        </div>

        <div class="flex-1 p-5 sm:p-8">
          <div v-if="guestMode === 'search' && hasCsvRows">
            <Input
              v-model="guestSearch"
              type="text"
              placeholder="Search by name or email…"
              aria-label="Search CSV rows"
              class="mb-4"
            />
            <div v-if="guestSearchResults.length" class="space-y-1">
              <div
                v-for="row in guestSearchResults"
                :key="row.id"
                class="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3"
              >
                <div>
                  <p class="font-mono text-sm font-bold text-foreground">{{ guestRowName(row) }}</p>
                  <p class="font-mono text-xs text-muted-foreground">
                    {{ guestRowEmail(row) }}
                    <span v-if="row.isSelected" class="ml-2 text-primary">Already added</span>
                  </p>
                </div>
                <Button
                  v-if="!row.isSelected"
                  type="button"
                  :disabled="addingGuest"
                  @click="addGuestFromCsv(row.id)"
                >
                  Add
                </Button>
              </div>
            </div>
            <p v-else-if="guestSearch.trim()" class="font-mono text-xs text-muted-foreground">No matches found.</p>
          </div>

          <div v-if="guestMode === 'freeform'" class="flex flex-col gap-4">
            <div class="space-y-1.5">
              <Label for="guest-first-name">First name *</Label>
              <Input id="guest-first-name" v-model="guestForm.firstName" type="text" />
            </div>
            <div class="space-y-1.5">
              <Label for="guest-last-name">Last name</Label>
              <Input id="guest-last-name" v-model="guestForm.lastName" type="text" />
            </div>
            <div class="space-y-1.5">
              <Label for="guest-email">Email *</Label>
              <Input id="guest-email" v-model="guestForm.email" type="email" />
            </div>
            <div class="space-y-1.5">
              <Label for="guest-cluster">Cluster <span class="font-normal text-muted-foreground">(optional)</span></Label>
              <Input
                id="guest-cluster"
                v-model="guestForm.clusterValue"
                type="text"
                list="guest-cluster-suggestions"
                placeholder="Type or pick a cluster…"
              />
              <datalist id="guest-cluster-suggestions">
                <option v-for="cluster in clusters" :key="cluster.value" :value="cluster.value" />
              </datalist>
            </div>
            <Button
              type="button"
              size="lg"
              class="w-full"
              :disabled="addingGuest || !guestForm.firstName.trim() || !guestForm.email.trim()"
              @click="addGuestFreeform"
            >
              {{ addingGuest ? 'Adding…' : 'Add guest' }}
            </Button>
          </div>
        </div>
      </div>
    </div>
  </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { nextTick, onScopeDispose, ref, watch } from 'vue'
import { useFocusTrap } from '@/composables/useFocusTrap'
import { api } from '@/lib/api'
import { useToast } from '@/composables/useToast'
import { downloadAttendeeQr } from '@/lib/tix/qrFiles'
import type { EventClusterBar } from '@/components/tix/ClusterBars.vue'

export interface CsvColumnMapping {
  firstNameCol?: string | null
  lastNameCol?: string | null
  fullNameCol?: string | null
  emailCol?: string | null
}

const props = defineProps<{
  open: boolean
  slug: string
  hasCsvRows: boolean
  columnMapping: CsvColumnMapping
  clusters: EventClusterBar[]
}>()

const emit = defineEmits<{ close: []; added: [] }>()

const toast = useToast()
const panel = ref<HTMLElement | null>(null)
const trap = useFocusTrap(panel)

watch(() => props.open, (open) => {
  if (open) void nextTick(() => trap.activate())
  else trap.release()
}, { immediate: true })
onScopeDispose(() => trap.release())
const guestMode = ref<'search' | 'freeform'>(props.hasCsvRows ? 'search' : 'freeform')
const guestSearch = ref('')
const addingGuest = ref(false)
const guestForm = ref({ firstName: '', lastName: '', email: '', clusterValue: '' })

interface CsvSearchRow { id: string; rowIndex: number; rawData: Record<string, string>; isSelected: boolean }
const guestSearchResults = ref<CsvSearchRow[]>([])

watch(() => props.hasCsvRows, (hasRows) => {
  guestMode.value = hasRows ? 'search' : 'freeform'
})

let guestSearchTimer: ReturnType<typeof setTimeout> | null = null
watch(guestSearch, (query) => {
  if (guestSearchTimer) clearTimeout(guestSearchTimer)
  if (!query.trim()) {
    guestSearchResults.value = []
    return
  }
  guestSearchTimer = setTimeout(async () => {
    try {
      const res = await api.raw(`/api/events/${props.slug}/csv-rows/search?q=${encodeURIComponent(query.trim())}`)
      const data = await res.json() as { rows?: CsvSearchRow[] }
      guestSearchResults.value = data.rows ?? []
    } catch { /* ignore */ }
  }, 300)
})

interface AddedGuest {
  id: string
  firstName: string
  lastName: string
  email: string
  qrToken: string
}

function guestRowName(row: CsvSearchRow): string {
  const mapping = props.columnMapping
  if (mapping.firstNameCol && mapping.lastNameCol) {
    return `${row.rawData[mapping.firstNameCol] ?? ''} ${row.rawData[mapping.lastNameCol] ?? ''}`.trim()
  }
  if (mapping.fullNameCol) return row.rawData[mapping.fullNameCol] ?? ''
  return Object.values(row.rawData).slice(0, 2).join(' ')
}

function guestRowEmail(row: CsvSearchRow): string {
  return props.columnMapping.emailCol ? row.rawData[props.columnMapping.emailCol] ?? '' : ''
}

async function finishAdd(data: { message?: string; attendee?: AddedGuest }, markRowId?: string) {
  if (!data.attendee) throw new Error('Failed to add guest.')
  await downloadAttendeeQr(data.attendee)
  toast.success(`${data.attendee.firstName} ${data.attendee.lastName} added.`)
  if (markRowId) {
    const row = guestSearchResults.value.find((item) => item.id === markRowId)
    if (row) row.isSelected = true
  } else {
    guestForm.value = { firstName: '', lastName: '', email: '', clusterValue: '' }
    emit('close')
  }
  emit('added')
}

async function addGuestFromCsv(csvRowId: string) {
  addingGuest.value = true
  try {
    const res = await api.raw(`/api/events/${props.slug}/add-guest`, {
      method: 'POST',
      body: JSON.stringify({ csvRowId }),
    })
    const data = await res.json() as { message?: string; attendee?: AddedGuest }
    if (!res.ok) throw new Error(data.message ?? 'Failed to add guest.')
    await finishAdd(data, csvRowId)
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Failed.')
  } finally {
    addingGuest.value = false
  }
}

async function addGuestFreeform() {
  if (!guestForm.value.firstName.trim() || !guestForm.value.email.trim()) return
  addingGuest.value = true
  try {
    const res = await api.raw(`/api/events/${props.slug}/add-guest`, {
      method: 'POST',
      body: JSON.stringify({
        firstName: guestForm.value.firstName.trim(),
        lastName: guestForm.value.lastName.trim(),
        email: guestForm.value.email.trim(),
        clusterValue: guestForm.value.clusterValue || null,
      }),
    })
    const data = await res.json() as { message?: string; attendee?: AddedGuest }
    if (!res.ok) throw new Error(data.message ?? 'Failed to add guest.')
    await finishAdd(data)
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Failed.')
  } finally {
    addingGuest.value = false
  }
}
</script>

<style scoped>
.panel-enter-active, .panel-leave-active { transition: opacity 0.2s; }
.panel-enter-active .relative, .panel-leave-active .relative { transition: transform 0.25s ease; }
.panel-enter-from, .panel-leave-to { opacity: 0; }
.panel-enter-from .relative, .panel-leave-to .relative { transform: translateY(100%); }
@media (min-width: 640px) {
  .panel-enter-from .relative, .panel-leave-to .relative { transform: translateX(100%); }
}
</style>
