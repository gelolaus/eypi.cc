<template>
  <div class="mica-card relative rounded-3xl border border-gray-200 p-5 sm:p-8 dark:border-slate-600">

    <h2 class="mb-1 text-sm font-semibold text-[#34418F] dark:text-slate-300">Selection Criteria</h2>
    <p class="mb-6 font-mono text-xs text-gray-500 dark:text-slate-400">
      Check the answer values you want to <span class="font-bold">include</span> in the raffle. Unchecked = excluded. Empty column = no filter applied.
    </p>

    <template v-if="clusters.length">
      <div v-for="cl in clusters" :key="cl.value" class="mb-4 overflow-hidden rounded-xl border border-gray-200 dark:border-slate-600">
        <button
          type="button"
          class="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-slate-800/40"
          @click="toggleClusterOpen(cl.value)"
        >
          <div>
            <p class="font-mono text-sm font-bold text-gray-800 dark:text-slate-200">{{ cl.value }}</p>
            <p class="text-xs font-medium text-gray-400 dark:text-slate-500">
              max {{ cl.maxCount }} · {{ clusterEligibleCount(cl.value) }} eligible of {{ clusterRawCount(cl.value) }} total
            </p>
          </div>
          <span class="font-mono text-xs text-gray-400 dark:text-slate-500">{{ openClusters.has(cl.value) ? '▲' : '▼' }}</span>
        </button>

        <div v-if="openClusters.has(cl.value)" class="border-t border-gray-100 px-4 py-4 dark:border-slate-700">
          <div v-if="!criteriaColumns.length" class="font-mono text-xs text-gray-400 dark:text-slate-500">No criteria columns configured.</div>
          <div v-for="col in criteriaColumns" :key="col" class="mb-4 last:mb-0">
            <p class="mb-2 text-sm font-semibold text-gray-600 dark:text-slate-400">{{ col }}</p>
            <div class="flex flex-wrap gap-2">
              <label
                v-for="val in uniqueValuesForCluster(col, cl.value)"
                :key="val"
                class="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 transition-colors"
                :class="isChecked(cl.value, col, val)
                  ? 'border-[#34418F] bg-[#34418F]/10 dark:border-slate-400 dark:bg-slate-700/50'
                  : 'border-gray-200 bg-white/60 hover:border-gray-300 dark:border-slate-600 dark:bg-mica-navy-input'"
              >
                <input
                  type="checkbox"
                  :checked="isChecked(cl.value, col, val)"
                  class="size-5 accent-[#34418F]"
                  @change="toggleFilter(cl.value, col, val)"
                />
                <span class="font-mono text-xs text-gray-700 dark:text-slate-300">{{ val }}</span>
                <span class="font-mono text-xs text-gray-400 dark:text-slate-500">({{ countInCluster(col, val, cl.value) }})</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template v-else>
      <div v-for="col in criteriaColumns" :key="col" class="mb-6 last:mb-0">
        <p class="mb-2 text-sm font-semibold text-gray-600 dark:text-slate-400">{{ col }}</p>
        <div class="flex flex-wrap gap-2">
          <label
            v-for="val in uniqueValues(col)"
            :key="val"
            class="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 transition-colors"
            :class="isChecked(null, col, val)
              ? 'border-[#34418F] bg-[#34418F]/10 dark:border-slate-400 dark:bg-slate-700/50'
              : 'border-gray-200 bg-white/60 hover:border-gray-300 dark:border-slate-600 dark:bg-mica-navy-input'"
          >
            <input
              type="checkbox"
              :checked="isChecked(null, col, val)"
              class="size-5 accent-[#34418F]"
              @change="toggleFilter(null, col, val)"
            />
            <span class="font-mono text-xs text-gray-700 dark:text-slate-300">{{ val }}</span>
            <span class="font-mono text-xs text-gray-400 dark:text-slate-500">({{ countInAll(col, val) }})</span>
          </label>
        </div>
      </div>
      <div v-if="!criteriaColumns.length" class="font-mono text-xs text-gray-400 dark:text-slate-500">No criteria columns configured.</div>
    </template>

    <div class="mt-6 rounded-xl bg-gray-50 px-4 py-3 dark:bg-slate-800/50">
      <p class="font-mono text-xs text-gray-600 dark:text-slate-400">
        Total eligible: <span class="font-bold text-[#34418F] dark:text-slate-200">{{ totalEligible }}</span>
      </p>
    </div>

    <div class="mt-6 flex gap-3">
      <button
        type="button"
        :disabled="savingCriteria"
        class="btn-secondary"
        @click="emit('leave', 'back')"
      >← Back</button>
      <button
        type="button"
        :disabled="savingCriteria"
        :class="[
          'min-h-11 flex-1 rounded-xl bg-[#34418F] px-4 text-base font-semibold text-white transition-all duration-200 dark:bg-slate-700',
          savingCriteria ? 'cursor-not-allowed opacity-50' : 'hover:-translate-y-0.5 hover:brightness-110',
        ]"
        @click="emit('leave', 'forward')"
      >
        {{ savingCriteria ? 'Saving…' : 'Continue →' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ClusterConfig } from '@/types/selection'

defineProps<{
  clusters: ClusterConfig[]
  criteriaColumns: string[]
  openClusters: Set<string>
  totalEligible: number
  savingCriteria: boolean
  clusterRawCount: (value: string) => number
  clusterEligibleCount: (value: string) => number
  uniqueValuesForCluster: (col: string, clusterValue: string) => string[]
  uniqueValues: (col: string) => string[]
  isChecked: (clusterValue: string | null, col: string, val: string) => boolean
  countInCluster: (col: string, val: string, clusterValue: string) => number
  countInAll: (col: string, val: string) => number
  toggleClusterOpen: (value: string) => void
  toggleFilter: (clusterValue: string | null, col: string, val: string) => void
}>()

const emit = defineEmits<{
  leave: [direction: 'back' | 'forward']
}>()
</script>
