<template>
  <Card class="gap-0 rounded-3xl p-5 sm:p-8">
    <h2 class="mb-1 font-heading text-xl font-semibold tracking-tight text-foreground">Manual Guarantees</h2>
    <p class="mb-6 font-mono text-xs text-muted-foreground">Add specific people who are guaranteed a slot regardless of the raffle. These reduce the available raffle slots.</p>

    <div class="mb-4">
      <Input
        v-model="guaranteeSearch"
        type="text"
        placeholder="Search by name or email…"
        aria-label="Search guarantees"
      />
    </div>

    <div v-if="guaranteeSearch.trim() && guaranteeSearchResults.length" class="mb-4 max-h-52 overflow-y-auto rounded-xl border border-border">
      <div
        v-for="row in guaranteeSearchResults"
        :key="row.id"
        class="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5 last:border-0"
      >
        <div class="min-w-0">
          <p class="font-mono text-sm text-foreground">{{ getDisplayName(row) }}</p>
          <p class="font-mono text-xs text-muted-foreground">{{ getEmail(row) }}
            <Badge v-if="columnMapping?.clusterCol" variant="secondary" class="ml-2">
              {{ row.rawData[columnMapping.clusterCol] ?? '—' }}
            </Badge>
          </p>
        </div>
        <Button
          v-if="!guaranteedRowIds.has(row.id)"
          type="button"
          @click="addGuarantee(row.id)"
        >
          Add
        </Button>
        <span v-else class="font-mono text-xs text-primary">Added ✓</span>
      </div>
    </div>
    <div v-else-if="guaranteeSearch.trim() && !guaranteeSearchResults.length" class="mb-4 font-mono text-xs text-muted-foreground">No matches found.</div>

    <div v-if="guaranteedRowIds.size" class="mb-4">
      <p class="mb-2 font-mono text-xs font-semibold text-muted-foreground">Guaranteed ({{ guaranteedRowIds.size }})</p>
      <div class="max-h-52 overflow-y-auto rounded-xl border border-border">
        <div
          v-for="rowId in [...guaranteedRowIds]"
          :key="rowId"
          class="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5 last:border-0"
        >
          <div class="min-w-0">
            <p class="font-mono text-sm text-foreground">{{ getDisplayName(rowById(rowId)) }}</p>
            <p class="font-mono text-xs text-muted-foreground">{{ getEmail(rowById(rowId)) }}
              <Badge v-if="columnMapping?.clusterCol && rowById(rowId)" variant="secondary" class="ml-2">
                {{ rowById(rowId)!.rawData[columnMapping!.clusterCol!] ?? '—' }}
              </Badge>
            </p>
          </div>
          <Button
            type="button"
            variant="destructive"
            size="icon"
            aria-label="Remove from guaranteed"
            @click="removeGuarantee(rowId)"
          >✕</Button>
        </div>
      </div>
    </div>
    <p v-else class="mb-4 font-mono text-xs text-muted-foreground">No guaranteed attendees yet.</p>

    <div class="mt-2 flex gap-3">
      <Button type="button" variant="outline" @click="emit('back')">← Back</Button>
      <Button type="button" class="flex-1" @click="emit('continue')">Continue →</Button>
    </div>
  </Card>
</template>

<script setup lang="ts">
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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
