<template>
  <Card class="gap-0 rounded-3xl p-5 sm:p-8">
    <h2 class="mb-1 font-heading text-xl font-semibold tracking-tight text-foreground">
      Selection Criteria
    </h2>
    <p class="mb-6 font-mono text-xs text-muted-foreground">
      Check the answer values you want to <span class="font-bold">include</span> in the raffle. Unchecked = excluded. Empty column = no filter applied.
    </p>

    <template v-if="clusters.length">
      <div
        v-for="cl in clusters"
        :key="cl.value"
        class="mb-4 overflow-hidden rounded-xl border border-border"
      >
        <button
          type="button"
          class="flex min-h-11 w-full items-center justify-between px-4 py-3 text-left outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50"
          @click="toggleClusterOpen(cl.value)"
        >
          <div>
            <p class="font-mono text-sm font-bold text-foreground">
              {{ cl.value }}
            </p>
            <p class="text-xs font-medium text-muted-foreground">
              max {{ cl.maxCount }} · {{ clusterEligibleCount(cl.value) }} eligible of {{ clusterRawCount(cl.value) }} total
            </p>
          </div>
          <span class="font-mono text-xs text-muted-foreground">{{ openClusters.has(cl.value) ? '▲' : '▼' }}</span>
        </button>

        <div
          v-if="openClusters.has(cl.value)"
          class="border-t border-border px-4 py-4"
        >
          <div
            v-if="!criteriaColumns.length"
            class="font-mono text-xs text-muted-foreground"
          >
            No criteria columns configured.
          </div>
          <div
            v-for="col in criteriaColumns"
            :key="col"
            class="mb-4 last:mb-0"
          >
            <p class="mb-2 text-sm font-semibold text-muted-foreground">
              {{ col }}
            </p>
            <div class="flex flex-wrap gap-2">
              <label
                v-for="val in uniqueValuesForCluster(col, cl.value)"
                :key="val"
                class="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 transition-colors"
                :class="isChecked(cl.value, col, val)
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:bg-muted'"
              >
                <input
                  type="checkbox"
                  :checked="isChecked(cl.value, col, val)"
                  class="size-5 accent-primary"
                  @change="toggleFilter(cl.value, col, val)"
                >
                <span class="font-mono text-xs text-foreground">{{ val }}</span>
                <span class="font-mono text-xs text-muted-foreground">({{ countInCluster(col, val, cl.value) }})</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template v-else>
      <div
        v-for="col in criteriaColumns"
        :key="col"
        class="mb-6 last:mb-0"
      >
        <p class="mb-2 text-sm font-semibold text-muted-foreground">
          {{ col }}
        </p>
        <div class="flex flex-wrap gap-2">
          <label
            v-for="val in uniqueValues(col)"
            :key="val"
            class="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 transition-colors"
            :class="isChecked(null, col, val)
              ? 'border-primary bg-primary/10'
              : 'border-border hover:bg-muted'"
          >
            <input
              type="checkbox"
              :checked="isChecked(null, col, val)"
              class="size-5 accent-primary"
              @change="toggleFilter(null, col, val)"
            >
            <span class="font-mono text-xs text-foreground">{{ val }}</span>
            <span class="font-mono text-xs text-muted-foreground">({{ countInAll(col, val) }})</span>
          </label>
        </div>
      </div>
      <div
        v-if="!criteriaColumns.length"
        class="font-mono text-xs text-muted-foreground"
      >
        No criteria columns configured.
      </div>
    </template>

    <div class="mt-6 rounded-xl bg-muted px-4 py-3">
      <p class="font-mono text-xs text-muted-foreground">
        Total eligible: <span class="font-bold text-foreground">{{ totalEligible }}</span>
      </p>
    </div>

    <div class="mt-6 flex gap-3">
      <Button
        type="button"
        variant="outline"
        :disabled="savingCriteria"
        @click="emit('leave', 'back')"
      >
        ← Back
      </Button>
      <Button
        type="button"
        class="flex-1"
        :disabled="savingCriteria"
        @click="emit('leave', 'forward')"
      >
        {{ savingCriteria ? 'Saving…' : 'Continue →' }}
      </Button>
    </div>
  </Card>
</template>

<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
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
