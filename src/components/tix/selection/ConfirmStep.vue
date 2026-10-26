<template>
  <div class="mica-card relative rounded-3xl border border-gray-200 p-8 dark:border-slate-600">
    <div class="absolute left-3 top-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
    <div class="absolute right-3 top-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
    <div class="absolute bottom-3 left-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
    <div class="absolute bottom-3 right-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />

    <h2 class="mb-1 text-sm font-semibold text-[#34418F] dark:text-slate-300">Confirm & Generate</h2>
    <p class="mb-6 font-mono text-xs text-gray-500 dark:text-slate-400">Once you finalize, QR codes will be generated and downloaded.</p>

    <div class="mb-6 flex items-center gap-3 rounded-xl border border-gray-200 bg-white/50 px-4 py-3 dark:border-slate-600 dark:bg-mica-navy-input">
      <label for="selection-max-attendees" class="text-sm font-semibold text-gray-600 dark:text-slate-400">Max Attendees:</label>
      <input
        id="selection-max-attendees"
        v-model.number="maxAttendeesEdit"
        type="number"
        min="1"
        placeholder="Unlimited"
        class="w-28 rounded-lg border border-gray-200 bg-white px-3 py-1.5 font-mono text-sm font-bold outline-none transition-colors focus:border-[#34418F] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
      />
      <span class="font-mono text-[0.65rem] text-gray-400 dark:text-slate-500">(auto-sum from clusters: {{ totalClusterMax || '—' }})</span>
    </div>

    <div v-if="clusters.length" class="mb-6 overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-600">
      <div class="min-w-[520px]">
        <div class="text-data grid grid-cols-5 border-b border-gray-100 bg-gray-50/60 px-4 py-2 text-xs font-semibold text-[#34418F] dark:border-slate-700 dark:bg-mica-navy-header dark:text-slate-400">
          <span class="col-span-2">Cluster</span>
          <span class="text-center">Quota</span>
          <span class="text-center">Guaranteed</span>
          <span class="text-center">Raffle pool</span>
        </div>
        <div
          v-for="cl in clusters"
          :key="cl.value"
          class="grid grid-cols-5 items-center border-b border-gray-100 px-4 py-3 last:border-0 dark:border-slate-700/60"
        >
          <span class="col-span-2 font-mono text-sm font-bold text-gray-800 dark:text-slate-200">{{ cl.value }}</span>
          <span class="text-center font-mono text-sm text-gray-700 dark:text-slate-300">{{ cl.maxCount }}</span>
          <span class="text-center font-mono text-sm text-gray-700 dark:text-slate-300">{{ guaranteedCountForCluster(cl.value) }}</span>
          <div class="text-center">
            <span class="font-mono text-sm text-gray-700 dark:text-slate-300">{{ rafflePoolForCluster(cl.value) }}</span>
            <p
              v-if="needsRaffleForCluster(cl.value)"
              class="font-mono text-[0.6rem] uppercase tracking-wide text-amber-500"
            >raffle</p>
            <p v-else-if="unfilledSlotsForCluster(cl.value) > 0" class="font-mono text-[0.6rem] uppercase tracking-wide text-blue-400">
              {{ unfilledSlotsForCluster(cl.value) }} unfilled
            </p>
            <p v-else class="font-mono text-[0.6rem] uppercase tracking-wide text-emerald-500">all fit</p>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="mb-6 grid grid-cols-3 gap-3">
      <div class="rounded-xl border border-gray-200 bg-white/50 px-4 py-3 text-center dark:border-slate-600 dark:bg-mica-navy-input">
        <p class="font-mono text-2xl font-black text-[#34418F] dark:text-slate-200">{{ guaranteedRowIds.size }}</p>
        <p class="font-mono text-[0.6rem] uppercase tracking-widest text-gray-400 dark:text-slate-500">Guaranteed</p>
      </div>
      <div class="rounded-xl border border-gray-200 bg-white/50 px-4 py-3 text-center dark:border-slate-600 dark:bg-mica-navy-input">
        <p class="font-mono text-2xl font-black text-[#34418F] dark:text-slate-200">{{ globalEligibleRows.length }}</p>
        <p class="font-mono text-[0.6rem] uppercase tracking-widest text-gray-400 dark:text-slate-500">Eligible</p>
      </div>
      <div class="rounded-xl border border-gray-200 bg-white/50 px-4 py-3 text-center dark:border-slate-600 dark:bg-mica-navy-input">
        <p class="font-mono text-2xl font-black text-[#34418F] dark:text-slate-200">{{ maxAttendeesEdit ?? '∞' }}</p>
        <p class="font-mono text-[0.6rem] uppercase tracking-widest text-gray-400 dark:text-slate-500">Max slots</p>
      </div>
    </div>

    <div v-if="hasUnfilledClusters" class="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 font-mono text-xs text-amber-700 dark:border-amber-800/40 dark:bg-amber-900/10 dark:text-amber-400">
      Some clusters have fewer eligible respondents than their quota — those slots will remain unfilled. You can re-raffle after finalization once more respondents are available.
    </div>

    <div class="mt-2 flex gap-3">
      <button type="button" class="rounded-xl border border-gray-200 px-4 py-3 text-xs font-mediumr text-gray-500 transition-colors hover:border-[#34418F] hover:text-[#34418F] dark:border-slate-600 dark:text-slate-400" @click="emit('back')">← Back</button>
      <button
        type="button"
        :disabled="finalizing"
        :class="[
          'btn-gold flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200',
          finalizing ? 'animate-pulse cursor-not-allowed opacity-50' : 'hover:-translate-y-0.5 hover:brightness-110',
        ]"
        @click="emit('finalize')"
      >
        {{ finalizingLabel }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ClusterConfig, CsvRow } from '@/types/selection'

const maxAttendeesEdit = defineModel<number | null>({ required: true })

defineProps<{
  clusters: ClusterConfig[]
  totalClusterMax: number
  guaranteedRowIds: Set<string>
  globalEligibleRows: CsvRow[]
  hasUnfilledClusters: boolean
  finalizing: boolean
  finalizingLabel: string
  guaranteedCountForCluster: (value: string) => number
  rafflePoolForCluster: (value: string) => number
  needsRaffleForCluster: (value: string) => boolean
  unfilledSlotsForCluster: (value: string) => number
}>()

const emit = defineEmits<{
  back: []
  finalize: []
}>()
</script>
