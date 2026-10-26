<template>
  <Teleport to="body">
  <Transition name="panel">
    <div v-if="open" class="fixed inset-0 flex items-end justify-center sm:items-stretch sm:justify-end" style="z-index: 99990">
      <button type="button" class="absolute inset-0 cursor-default border-0 bg-black/30 p-0 backdrop-blur-sm" aria-label="Close add guest" @click="emit('close')" />
      <!-- eslint-disable-next-line vuejs-accessibility/no-static-element-interactions -- dialog handles focus and Escape -->
      <div
        ref="panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-guest-title"
        tabindex="-1"
        class="relative z-10 flex max-h-[92dvh] w-full flex-col overflow-y-auto rounded-t-3xl bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl sm:h-full sm:max-h-none sm:max-w-md sm:rounded-none dark:bg-slate-900"
        @keydown.esc.stop="emit('close')"
      >
        <div class="flex items-center justify-between border-b border-gray-100 px-5 py-2 sm:px-8 dark:border-slate-700">
          <h2 id="add-guest-title" class="text-sm font-semibold text-[#34418F] dark:text-slate-300">Add guest</h2>
          <button type="button" class="flex size-11 items-center justify-center font-mono text-lg text-gray-400 transition-colors hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300" aria-label="Close" @click="emit('close')">×</button>
        </div>

        <div class="flex border-b border-gray-100 dark:border-slate-700">
          <button
            v-if="hasCsvRows"
            type="button"
            :class="[
              'min-h-11 flex-1 text-sm font-semibold transition-colors',
              guestMode === 'search' ? 'border-b-2 border-[#34418F] text-[#34418F] dark:border-slate-400 dark:text-slate-200' : 'text-gray-400 hover:text-gray-600 dark:text-slate-500',
            ]"
            @click="guestMode = 'search'"
          >
            From CSV
          </button>
          <button
            type="button"
            :class="[
              'min-h-11 flex-1 text-sm font-semibold transition-colors',
              guestMode === 'freeform' ? 'border-b-2 border-[#34418F] text-[#34418F] dark:border-slate-400 dark:text-slate-200' : 'text-gray-400 hover:text-gray-600 dark:text-slate-500',
            ]"
            @click="guestMode = 'freeform'"
          >
            Free-form
          </button>
        </div>

        <div class="flex-1 p-5 sm:p-8">
          <div v-if="guestMode === 'search' && hasCsvRows">
            <input
              v-model="guestSearch"
              type="text"
              placeholder="Search by name or email…"
              aria-label="Search CSV rows"
              class="mb-4 w-full rounded-lg border-2 border-gray-200 bg-white/50 h-11 px-4 text-base outline-none transition-colors focus:border-[#34418F] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:placeholder-slate-400"
            />
            <div v-if="guestSearchResults.length" class="space-y-1">
              <div
                v-for="row in guestSearchResults"
                :key="row.id"
                class="flex items-center justify-between gap-3 rounded-xl border border-gray-200 px-4 py-3 dark:border-slate-600"
              >
                <div>
                  <p class="font-mono text-sm font-bold text-gray-800 dark:text-slate-200">{{ guestRowName(row) }}</p>
                  <p class="font-mono text-xs text-gray-400 dark:text-slate-500">
                    {{ guestRowEmail(row) }}
                    <span v-if="row.isSelected" class="ml-2 text-emerald-500">Already added</span>
                  </p>
                </div>
                <button
                  v-if="!row.isSelected"
                  type="button"
                  :disabled="addingGuest"
                  class="btn-primary"
                  @click="addGuestFromCsv(row.id)"
                >
                  Add
                </button>
              </div>
            </div>
            <p v-else-if="guestSearch.trim()" class="font-mono text-xs text-gray-400 dark:text-slate-500">No matches found.</p>
          </div>

          <div v-if="guestMode === 'freeform'" class="flex flex-col gap-4">
            <div>
              <label for="guest-first-name" class="mb-1 block text-sm font-semibold text-[#34418F] dark:text-slate-300">First name *</label>
              <input id="guest-first-name" v-model="guestForm.firstName" type="text" class="w-full rounded-lg border-2 border-gray-200 bg-white/50 h-11 px-4 text-base outline-none transition-colors focus:border-[#34418F] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" />
            </div>
            <div>
              <label for="guest-last-name" class="mb-1 block text-sm font-semibold text-[#34418F] dark:text-slate-300">Last name</label>
              <input id="guest-last-name" v-model="guestForm.lastName" type="text" class="w-full rounded-lg border-2 border-gray-200 bg-white/50 h-11 px-4 text-base outline-none transition-colors focus:border-[#34418F] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" />
            </div>
            <div>
              <label for="guest-email" class="mb-1 block text-sm font-semibold text-[#34418F] dark:text-slate-300">Email *</label>
              <input id="guest-email" v-model="guestForm.email" type="email" class="w-full rounded-lg border-2 border-gray-200 bg-white/50 h-11 px-4 text-base outline-none transition-colors focus:border-[#34418F] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" />
            </div>
            <div>
              <label for="guest-cluster" class="mb-1 block text-sm font-semibold text-[#34418F] dark:text-slate-300">Cluster <span class="font-normal text-gray-400">(optional)</span></label>
              <input
                id="guest-cluster"
                v-model="guestForm.clusterValue"
                type="text"
                list="guest-cluster-suggestions"
                placeholder="Type or pick a cluster…"
                class="w-full rounded-lg border-2 border-gray-200 bg-white/50 h-11 px-4 text-base outline-none transition-colors focus:border-[#34418F] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              />
              <datalist id="guest-cluster-suggestions">
                <option v-for="cluster in clusters" :key="cluster.value" :value="cluster.value" />
              </datalist>
            </div>
            <button
              type="button"
              :disabled="addingGuest || !guestForm.firstName.trim() || !guestForm.email.trim()"
              :class="[
                'btn-gold w-full rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200',
                (addingGuest || !guestForm.firstName.trim() || !guestForm.email.trim()) ? 'cursor-not-allowed opacity-50' : 'hover:brightness-110',
              ]"
              @click="addGuestFreeform"
            >
              {{ addingGuest ? 'Adding…' : 'Add guest' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Transition>
  </Teleport>
</template>

<script setup lang="ts">
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
