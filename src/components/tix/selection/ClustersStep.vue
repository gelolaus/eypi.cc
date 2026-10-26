<template>
  <div class="mica-card relative rounded-3xl border border-gray-200 p-5 sm:p-8 dark:border-slate-600">
    <PageShell />

    <h2 class="mb-1 text-sm font-semibold text-[#34418F] dark:text-slate-300">Configure Clusters</h2>
    <p class="mb-1 font-mono text-xs text-gray-500 dark:text-slate-400">
      Column: <span class="font-bold text-[#34418F] dark:text-slate-300">{{ columnMapping?.clusterCol }}</span>
    </p>
    <p class="mb-6 font-mono text-xs text-gray-400 dark:text-slate-500">Set how many attendees each group can have. Total capacity is the sum of all quotas.</p>

    <div class="space-y-3">
      <div
        v-for="cl in clusters"
        :key="cl.value"
        class="flex items-center gap-3 rounded-xl border border-gray-200 bg-white/50 px-4 py-3 dark:border-slate-600 dark:bg-mica-navy-input"
      >
        <div class="flex-1">
          <p class="font-mono text-sm font-bold text-gray-800 dark:text-slate-200">{{ cl.value }}</p>
          <p class="font-mono text-xs uppercase tracking-wide text-gray-400 dark:text-slate-500">{{ clusterRawCount(cl.value) }} respondents</p>
        </div>
        <div class="flex items-center gap-2">
          <label :for="`cluster-max-${cl.value}`" class="font-mono text-xs text-gray-500 dark:text-slate-400">Max:</label>
          <input
            :id="`cluster-max-${cl.value}`"
            :value="cl.maxCount"
            type="number"
            min="0"
            class="control w-24 text-center font-mono font-bold"
            @input="setClusterMax(cl.value, Math.max(0, parseInt(($event.target as HTMLInputElement).value) || 0))"
          />
        </div>
      </div>
    </div>

    <div class="mt-4 rounded-xl bg-gray-50 px-4 py-3 dark:bg-slate-800/50">
      <p class="font-mono text-xs text-gray-600 dark:text-slate-400">
        Total capacity: <span class="font-bold text-[#34418F] dark:text-slate-200">{{ totalClusterMax }}</span> attendees
      </p>
    </div>

    <p v-if="clusterError" class="mt-3 text-xs font-medium text-red-500">{{ clusterError }}</p>

    <div class="mt-6 flex gap-3">
      <button type="button" class="btn-secondary" @click="emit('back')">← Back</button>
      <button
        type="button"
        :disabled="savingClusters"
        :class="[
          'min-h-11 flex-1 rounded-xl bg-[#34418F] px-4 text-base font-semibold text-white transition-all duration-200 dark:bg-slate-700',
          savingClusters ? 'cursor-not-allowed opacity-50' : 'hover:-translate-y-0.5 hover:brightness-110',
        ]"
        @click="emit('continue')"
      >
        {{ savingClusters ? 'Saving…' : 'Continue →' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import PageShell from '@/components/PageShell.vue'
import type { ClusterConfig, ColumnMapping } from '@/types/selection'

defineProps<{
  columnMapping: ColumnMapping | null
  clusters: ClusterConfig[]
  clusterRawCount: (value: string) => number
  totalClusterMax: number
  clusterError: string
  savingClusters: boolean
  setClusterMax: (value: string, maxCount: number) => void
}>()

const emit = defineEmits<{
  back: []
  continue: []
}>()
</script>
