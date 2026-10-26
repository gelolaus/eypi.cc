<template>
  <Card class="gap-0 rounded-3xl p-5 sm:p-8">
    <h2 class="mb-1 font-heading text-xl font-semibold tracking-tight text-foreground">Map Columns</h2>
    <p class="mb-6 font-mono text-xs text-muted-foreground">One column must be the attendee's email.</p>

    <div class="overflow-hidden rounded-xl border border-border">
      <div class="grid grid-cols-2 border-b border-border bg-muted px-4 py-3 font-mono text-sm font-bold uppercase tracking-wide text-foreground">
        <span>Column</span><span>Role</span>
      </div>
      <div
        v-for="col in columnHeaders"
        :key="col"
        class="grid grid-cols-2 items-center gap-2 border-b border-border px-4 py-2 last:border-0"
      >
        <span class="truncate pr-2 font-mono text-sm text-foreground">{{ col }}</span>
        <select
          :value="getColRole(col)"
          :aria-label="`Role for ${col}`"
          class="h-11 w-full min-w-0 rounded-xl border border-input bg-transparent px-3.5 font-mono text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 [&>option]:bg-popover [&>option]:text-popover-foreground"
          @change="setColRole(col, ($event.target as HTMLSelectElement).value)"
        >
          <option value="criteria">Criteria</option>
          <option value="email">Email</option>
          <option value="first_name">First Name</option>
          <option value="last_name">Last Name</option>
          <option value="full_name">Full Name</option>
          <option value="cluster">Cluster / Group</option>
          <option value="ignore">Ignore</option>
        </select>
      </div>
    </div>

    <p v-if="mapError" class="mt-3 text-xs font-medium text-destructive">{{ mapError }}</p>

    <div class="mt-6 flex gap-3">
      <Button type="button" variant="outline" @click="emit('back')">← Back</Button>
      <Button type="button" class="flex-1" @click="emit('continue')">Continue →</Button>
    </div>
  </Card>
</template>

<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

defineProps<{
  columnHeaders: string[]
  mapError: string
  getColRole: (col: string) => string
  setColRole: (col: string, role: string) => void
}>()

const emit = defineEmits<{
  back: []
  continue: []
}>()
</script>
