<template>
  <div class="mica-card relative rounded-3xl border border-gray-200 p-5 sm:p-8 dark:border-slate-600">
    <PageShell />

    <h2 class="mb-1 text-sm font-semibold text-[#34418F] dark:text-slate-300">Manual Guarantees</h2>
    <p class="mb-6 font-mono text-xs text-gray-500 dark:text-slate-400">Add specific people who are guaranteed a slot regardless of the raffle. These reduce the available raffle slots.</p>

    <div class="mb-4">
      <input
        v-model="guaranteeSearch"
        type="text"
        placeholder="Search by name or email…"
        aria-label="Search guarantees"
        class="control"
      />
    </div>

    <div v-if="guaranteeSearch.trim() && guaranteeSearchResults.length" class="mb-4 max-h-52 overflow-y-auto rounded-xl border border-gray-200 dark:border-slate-600">
      <div
        v-for="row in guaranteeSearchResults"
        :key="row.id"
        class="flex items-center justify-between border-b border-gray-100 px-4 py-2.5 last:border-0 dark:border-slate-700/60"
      >
        <div>
          <p class="font-mono text-sm text-gray-800 dark:text-slate-200">{{ getDisplayName(row) }}</p>
          <p class="font-mono text-xs text-gray-400 dark:text-slate-500">{{ getEmail(row) }}
            <span v-if="columnMapping?.clusterCol" class="ml-2 rounded bg-[#34418F]/10 px-1.5 py-0.5 text-xs font-bold text-[#34418F] dark:bg-slate-700 dark:text-slate-300">
              {{ row.rawData[columnMapping.clusterCol] ?? '—' }}
            </span>
          </p>
        </div>
        <button
          v-if="!guaranteedRowIds.has(row.id)"
          type="button"
          class="btn-primary"
          @click="addGuarantee(row.id)"
        >
          Add
        </button>
        <span v-else class="font-mono text-xs text-emerald-500">Added ✓</span>
      </div>
    </div>
    <div v-else-if="guaranteeSearch.trim() && !guaranteeSearchResults.length" class="mb-4 font-mono text-xs text-gray-400 dark:text-slate-500">No matches found.</div>

    <div v-if="guaranteedRowIds.size" class="mb-4">
      <p class="text-data mb-2 text-xs font-semibold text-gray-500 dark:text-slate-400">Guaranteed ({{ guaranteedRowIds.size }})</p>
      <div class="max-h-52 overflow-y-auto rounded-xl border border-gray-200 dark:border-slate-600">
        <div
          v-for="rowId in [...guaranteedRowIds]"
          :key="rowId"
          class="flex items-center justify-between border-b border-gray-100 px-4 py-2.5 last:border-0 dark:border-slate-700/60"
        >
          <div>
            <p class="font-mono text-sm text-gray-800 dark:text-slate-200">{{ getDisplayName(rowById(rowId)) }}</p>
            <p class="font-mono text-xs text-gray-400 dark:text-slate-500">{{ getEmail(rowById(rowId)) }}
              <span v-if="columnMapping?.clusterCol && rowById(rowId)" class="ml-2 rounded bg-[#34418F]/10 px-1.5 py-0.5 text-xs font-bold text-[#34418F] dark:bg-slate-700 dark:text-slate-300">
                {{ rowById(rowId)!.rawData[columnMapping!.clusterCol!] ?? '—' }}
              </span>
            </p>
          </div>
          <button
            type="button"
            class="min-h-11 min-w-11 rounded-lg border border-red-200 px-2 font-mono text-sm text-red-600 transition-colors hover:bg-red-50 dark:border-red-900/40 dark:hover:bg-red-900/10"
            aria-label="Remove from guaranteed"
            @click="removeGuarantee(rowId)"
          >✕</button>
        </div>
      </div>
    </div>
    <p v-else class="mb-4 font-mono text-xs text-gray-400 dark:text-slate-500">No guaranteed attendees yet.</p>

    <div class="mt-2 flex gap-3">
      <button type="button" class="btn-secondary" @click="emit('back')">← Back</button>
      <button
        type="button"
        class="min-h-11 flex-1 rounded-xl bg-[#34418F] px-4 text-base font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110 dark:bg-slate-700"
        @click="emit('continue')"
      >
        Continue →
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import PageShell from '@/components/PageShell.vue'
import type { ColumnMapping, CsvRow } from '@/types/selection'

const guaranteeSearch = defineModel<string>({ required: true })

defineProps<{
  guaranteeSearchResults: CsvRow[]
  guaranteedRowIds: Set<string>
  columnMapping: ColumnMapping | null
  getDisplayName: (row: CsvRow | undefined) => string
  getEmail: (row: CsvRow | undefined) => string
  rowById: (id: string) => CsvRow | undefined
  addGuarantee: (id: string) => void
  removeGuarantee: (id: string) => void
}>()

const emit = defineEmits<{
  back: []
  continue: []
}>()
</script>
