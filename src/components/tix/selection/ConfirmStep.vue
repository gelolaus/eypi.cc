<template>
  <div class="mica-card relative rounded-3xl border border-gray-200 p-5 sm:p-8 dark:border-slate-600">

    <h2 class="mb-1 text-sm font-semibold text-[#34418F] dark:text-slate-300">Confirm & Generate</h2>
    <p class="mb-6 font-mono text-xs text-gray-500 dark:text-slate-400">Once you finalize, QR codes will be generated and downloaded.</p>

    <div class="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white/50 px-4 py-3 dark:border-slate-600 dark:bg-mica-navy-input">
      <label for="selection-max-attendees" class="text-sm font-semibold text-gray-600 dark:text-slate-400">Max Attendees:</label>
      <input
        id="selection-max-attendees"
        v-model.number="maxAttendeesEdit"
        type="number"
        min="1"
        placeholder="Unlimited"
        class="control w-32 font-mono font-bold"
      />
      <span class="font-mono text-xs text-gray-400 dark:text-slate-500">(auto-sum from clusters: {{ totalClusterMax || '—' }})</span>
    </div>

    <div v-if="clusters.length" class="mb-6 space-y-3 md:space-y-0 md:overflow-hidden md:rounded-xl md:border md:border-gray-200 md:dark:border-slate-600">
      <div class="text-data hidden grid-cols-5 border-b border-gray-100 bg-gray-50/60 px-4 py-2 text-xs font-semibold text-[#34418F] dark:border-slate-700 dark:bg-mica-navy-header dark:text-slate-400 md:grid">
        <span class="col-span-2">Cluster</span>
        <span class="text-center">Quota</span>
        <span class="text-center">Guaranteed</span>
        <span class="text-center">Raffle pool</span>
      </div>
      <div
        v-for="cl in clusters"
        :key="cl.value"
        data-cluster-row
        class="grid grid-cols-3 items-center gap-y-2 rounded-2xl border border-gray-200 p-4 dark:border-slate-600 md:grid-cols-5 md:gap-y-0 md:rounded-none md:border-0 md:border-b md:border-gray-100 md:py-3 md:last:border-0 md:dark:border-slate-700/60"
      >
        <span class="col-span-3 font-mono text-sm font-bold text-gray-800 dark:text-slate-200 md:col-span-2">{{ cl.value }}</span>
        <div class="md:text-center">
          <p class="font-mono text-xs text-gray-500 dark:text-slate-400 md:hidden">Quota</p>
          <span class="font-mono text-sm text-gray-700 dark:text-slate-300">{{ cl.maxCount }}</span>
        </div>
        <div class="md:text-center">
          <p class="font-mono text-xs text-gray-500 dark:text-slate-400 md:hidden">Guaranteed</p>
          <span class="font-mono text-sm text-gray-700 dark:text-slate-300">{{ guaranteedCountForCluster(cl.value) }}</span>
        </div>
        <div class="md:text-center">
          <p class="font-mono text-xs text-gray-500 dark:text-slate-400 md:hidden">Raffle pool</p>
          <span class="font-mono text-sm text-gray-700 dark:text-slate-300">{{ rafflePoolForCluster(cl.value) }}</span>
          <p
            v-if="needsRaffleForCluster(cl.value)"
            class="font-mono text-xs uppercase tracking-wide text-amber-700 dark:text-amber-400"
          >raffle</p>
          <p v-else-if="unfilledSlotsForCluster(cl.value) > 0" class="font-mono text-xs uppercase tracking-wide text-blue-700 dark:text-blue-400">
            {{ unfilledSlotsForCluster(cl.value) }} unfilled
          </p>
          <p v-else class="font-mono text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-400">all fit</p>
        </div>
      </div>
    </div>

    <div v-else class="mb-6 grid grid-cols-3 gap-3">
      <div class="rounded-xl border border-gray-200 bg-white/50 px-4 py-3 text-center dark:border-slate-600 dark:bg-mica-navy-input">
        <p class="font-mono text-2xl font-black text-[#34418F] dark:text-slate-200">{{ guaranteedRowIds.size }}</p>
        <p class="font-mono text-xs uppercase tracking-widest text-gray-400 dark:text-slate-500">Guaranteed</p>
      </div>
      <div class="rounded-xl border border-gray-200 bg-white/50 px-4 py-3 text-center dark:border-slate-600 dark:bg-mica-navy-input">
        <p class="font-mono text-2xl font-black text-[#34418F] dark:text-slate-200">{{ globalEligibleRows.length }}</p>
        <p class="font-mono text-xs uppercase tracking-widest text-gray-400 dark:text-slate-500">Eligible</p>
      </div>
      <div class="rounded-xl border border-gray-200 bg-white/50 px-4 py-3 text-center dark:border-slate-600 dark:bg-mica-navy-input">
        <p class="font-mono text-2xl font-black text-[#34418F] dark:text-slate-200">{{ maxAttendeesEdit ?? '∞' }}</p>
        <p class="font-mono text-xs uppercase tracking-widest text-gray-400 dark:text-slate-500">Max slots</p>
      </div>
    </div>

    <div v-if="hasUnfilledClusters" class="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 font-mono text-xs text-amber-700 dark:border-amber-800/40 dark:bg-amber-900/10 dark:text-amber-400">
      Some clusters have fewer eligible respondents than their quota — those slots will remain unfilled. You can re-raffle after finalization once more respondents are available.
    </div>

    <div class="mt-2 flex gap-3">
      <button type="button" class="btn-secondary" @click="emit('back')">← Back</button>
      <button
        type="button"
        :disabled="finalizing"
        :class="[
          'btn-gold min-h-11 flex-1 rounded-xl px-4 text-base font-semibold transition-all duration-200',
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
