<template>
  <Card class="gap-0 rounded-3xl p-5 sm:p-8">
    <h2 class="mb-1 font-heading text-xl font-semibold tracking-tight text-foreground">Confirm & Generate</h2>
    <p class="mb-6 font-mono text-xs text-muted-foreground">Once you finalize, QR codes will be generated and downloaded.</p>

    <div class="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-border px-4 py-3">
      <Label for="selection-max-attendees" class="text-sm font-semibold text-muted-foreground">Max Attendees:</Label>
      <Input
        id="selection-max-attendees"
        v-model.number="maxAttendeesEdit"
        type="number"
        min="1"
        placeholder="Unlimited"
        class="w-32 font-mono font-bold"
      />
      <span class="font-mono text-xs text-muted-foreground">(auto-sum from clusters: {{ totalClusterMax || '—' }})</span>
    </div>

    <div v-if="clusters.length" class="mb-6 overflow-x-auto">
      <div class="space-y-3 md:min-w-128 md:space-y-0 md:overflow-hidden md:rounded-xl md:border md:border-border">
        <div class="hidden grid-cols-5 border-b border-border bg-muted px-4 py-2 font-mono text-xs font-semibold text-foreground md:grid">
          <span class="col-span-2">Cluster</span>
          <span class="text-center">Quota</span>
          <span class="text-center">Guaranteed</span>
          <span class="text-center">Raffle pool</span>
        </div>
        <div
          v-for="cl in clusters"
          :key="cl.value"
          data-cluster-row
          class="grid grid-cols-3 items-center gap-y-2 rounded-2xl border border-border p-4 md:grid-cols-5 md:gap-y-0 md:rounded-none md:border-0 md:border-b md:py-3 md:last:border-0"
        >
          <span class="col-span-3 font-mono text-sm font-bold text-foreground md:col-span-2">{{ cl.value }}</span>
          <div class="md:text-center">
            <p class="font-mono text-xs text-muted-foreground md:hidden">Quota</p>
            <span class="font-mono text-sm text-foreground">{{ cl.maxCount }}</span>
          </div>
          <div class="md:text-center">
            <p class="font-mono text-xs text-muted-foreground md:hidden">Guaranteed</p>
            <span class="font-mono text-sm text-foreground">{{ guaranteedCountForCluster(cl.value) }}</span>
          </div>
          <div class="md:text-center">
            <p class="font-mono text-xs text-muted-foreground md:hidden">Raffle pool</p>
            <span class="font-mono text-sm text-foreground">{{ rafflePoolForCluster(cl.value) }}</span>
            <p
              v-if="needsRaffleForCluster(cl.value)"
              class="font-mono text-xs uppercase tracking-wide text-primary"
            >raffle</p>
            <p v-else-if="unfilledSlotsForCluster(cl.value) > 0" class="font-mono text-xs uppercase tracking-wide text-muted-foreground">
              {{ unfilledSlotsForCluster(cl.value) }} unfilled
            </p>
            <p v-else class="font-mono text-xs uppercase tracking-wide text-foreground">all fit</p>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="mb-6 grid grid-cols-3 gap-3">
      <div class="rounded-xl border border-border px-4 py-3 text-center">
        <p class="font-mono text-2xl font-black text-foreground">{{ guaranteedRowIds.size }}</p>
        <p class="font-mono text-xs uppercase tracking-widest text-muted-foreground">Guaranteed</p>
      </div>
      <div class="rounded-xl border border-border px-4 py-3 text-center">
        <p class="font-mono text-2xl font-black text-foreground">{{ globalEligibleRows.length }}</p>
        <p class="font-mono text-xs uppercase tracking-widest text-muted-foreground">Eligible</p>
      </div>
      <div class="rounded-xl border border-border px-4 py-3 text-center">
        <p class="font-mono text-2xl font-black text-foreground">{{ maxAttendeesEdit ?? '∞' }}</p>
        <p class="font-mono text-xs uppercase tracking-widest text-muted-foreground">Max slots</p>
      </div>
    </div>

    <div v-if="hasUnfilledClusters" class="mb-4 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 font-mono text-xs text-primary">
      Some clusters have fewer eligible respondents than their quota — those slots will remain unfilled. You can re-raffle after finalization once more respondents are available.
    </div>

    <div class="mt-2 flex gap-3">
      <Button type="button" variant="outline" @click="emit('back')">← Back</Button>
      <Button
        type="button"
        class="flex-1"
        :class="finalizing ? 'animate-pulse' : ''"
        :disabled="finalizing"
        @click="emit('finalize')"
      >
        {{ finalizingLabel }}
      </Button>
    </div>
  </Card>
</template>

<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
