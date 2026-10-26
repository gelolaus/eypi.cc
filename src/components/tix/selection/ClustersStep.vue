<template>
  <Card class="gap-0 rounded-3xl p-5 sm:p-8">
    <h2 class="mb-1 font-heading text-xl font-semibold tracking-tight text-foreground">
      Configure Clusters
    </h2>
    <p class="mb-1 font-mono text-xs text-muted-foreground">
      Column: <span class="font-bold text-foreground">{{ columnMapping?.clusterCol }}</span>
    </p>
    <p class="mb-6 font-mono text-xs text-muted-foreground">
      Set how many attendees each group can have. Total capacity is the sum of all quotas.
    </p>

    <div class="space-y-3">
      <div
        v-for="cl in clusters"
        :key="cl.value"
        class="flex items-center gap-3 rounded-xl border border-border px-4 py-3"
      >
        <div class="min-w-0 flex-1">
          <p class="break-words font-mono text-sm font-bold text-foreground">
            {{ cl.value }}
          </p>
          <p class="font-mono text-xs uppercase tracking-wide text-muted-foreground">
            {{ clusterRawCount(cl.value) }} respondents
          </p>
        </div>
        <div class="flex items-center gap-2">
          <Label
            :for="`cluster-max-${cl.value}`"
            class="font-mono text-xs text-muted-foreground"
          >Max:</Label>
          <Input
            :id="`cluster-max-${cl.value}`"
            :model-value="cl.maxCount"
            type="number"
            min="0"
            class="w-24 text-center font-mono font-bold"
            @input="setClusterMax(cl.value, Math.max(0, parseInt(($event.target as HTMLInputElement).value) || 0))"
          />
        </div>
      </div>
    </div>

    <div class="mt-4 rounded-xl bg-muted px-4 py-3">
      <p class="font-mono text-xs text-muted-foreground">
        Total capacity: <span class="font-bold text-foreground">{{ totalClusterMax }}</span> attendees
      </p>
    </div>

    <p
      v-if="clusterError"
      class="mt-3 text-xs font-medium text-destructive"
    >
      {{ clusterError }}
    </p>

    <div class="mt-6 flex gap-3">
      <Button
        type="button"
        variant="outline"
        @click="emit('back')"
      >
        ← Back
      </Button>
      <Button
        type="button"
        class="flex-1"
        :disabled="savingClusters"
        @click="emit('continue')"
      >
        {{ savingClusters ? 'Saving…' : 'Continue →' }}
      </Button>
    </div>
  </Card>
</template>

<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
