<script setup lang="ts">
import type { TrendRange } from '@/lib/queries'
import { Button } from '@/components/ui/button'

defineProps<{ modelValue: TrendRange }>()
const emit = defineEmits<{ 'update:modelValue': [value: TrendRange] }>()

const OPTIONS: { value: TrendRange; label: string }[] = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
]
</script>

<template>
  <div
    role="group"
    aria-label="Period"
    class="inline-flex flex-wrap gap-2"
  >
    <Button
      v-for="opt in OPTIONS"
      :key="opt.value"
      type="button"
      class="min-h-11"
      :variant="modelValue === opt.value ? 'default' : 'outline'"
      :aria-pressed="modelValue === opt.value"
      @click="emit('update:modelValue', opt.value)"
    >
      {{ opt.label }}
    </Button>
  </div>
</template>