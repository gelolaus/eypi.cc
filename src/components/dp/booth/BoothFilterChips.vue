<template>
  <div class="flex flex-col gap-2">
    <div
      role="group"
      aria-label="Filter"
      class="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
    >
      <Button
        v-for="option in BOOTH_FILTERS"
        :key="option.id"
        type="button"
        size="sm"
        :variant="option.id === modelValue ? 'default' : 'outline'"
        :aria-pressed="option.id === modelValue ? 'true' : 'false'"
        :disabled="disabled"
        class="min-h-11 shrink-0 rounded-full px-4"
        @click="emit('update:modelValue', option.id)"
      >
        {{ option.label }}
      </Button>
    </div>
    <p
      class="sr-only"
      aria-live="polite"
      data-booth-filter-status
    >
      Filter: {{ activeLabel }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import { BOOTH_FILTERS, type BoothFilterId } from '@/lib/booth/filters'

const props = defineProps<{ modelValue: BoothFilterId; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: BoothFilterId] }>()

const activeLabel = computed(() => BOOTH_FILTERS.find((f) => f.id === props.modelValue)?.label ?? 'Normal')
</script>
