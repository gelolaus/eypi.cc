<template>
  <div
    role="tablist"
    :class="cn('flex flex-wrap gap-2', className)"
  >
    <button
      v-for="tab in tabs"
      :key="tab.id"
      type="button"
      role="tab"
      :id="`tab-${tab.id}`"
      :aria-selected="model === tab.id"
      :tabindex="model === tab.id ? 0 : -1"
      :class="
        cn(
          'rounded-full px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]',
          model === tab.id
            ? 'bg-g-primary text-g-primary-fg'
            : 'bg-transparent text-g-muted hover:text-g-text hover:bg-g-bg',
        )
      "
      @click="model = tab.id"
    >
      {{ tab.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@/lib/cn'

export type TabItem = {
  id: string
  label: string
}

const model = defineModel<string>({ required: true })

defineProps<{
  tabs: TabItem[]
  className?: string
}>()
</script>
