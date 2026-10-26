<template>
  <div class="mica-card relative rounded-3xl border border-gray-200 p-5 sm:p-8 dark:border-slate-600">
    <PageShell />

    <h2 class="mb-1 text-sm font-semibold text-[#34418F] dark:text-slate-300">Map Columns</h2>
    <p class="mb-6 font-mono text-xs text-gray-500 dark:text-slate-400">One column must be the attendee's email.</p>

    <div class="overflow-hidden rounded-xl border border-gray-200 dark:border-slate-600">
      <div class="grid grid-cols-2 border-b border-gray-100 bg-gray-50/60 px-4 py-3 font-mono text-sm font-bold uppercase tracking-wide text-[#34418F] dark:border-slate-700 dark:bg-mica-navy-header dark:text-slate-400">
        <span>Column</span><span>Role</span>
      </div>
      <div
        v-for="col in columnHeaders"
        :key="col"
        class="grid grid-cols-2 items-center gap-2 border-b border-gray-100 px-4 py-2 last:border-0 dark:border-slate-700/60"
      >
        <span class="truncate pr-2 font-mono text-sm text-gray-700 dark:text-slate-300">{{ col }}</span>
        <select
          :value="getColRole(col)"
          :aria-label="`Role for ${col}`"
          class="control font-mono"
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

    <p v-if="mapError" class="mt-3 text-xs font-medium text-red-500">{{ mapError }}</p>

    <div class="mt-6 flex gap-3">
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
