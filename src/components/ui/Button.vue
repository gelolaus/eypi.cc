<template>
  <button
    :type="type"
    :class="buttonVariants({ variant, size, className })"
    :disabled="disabled"
    v-bind="attrsWithoutClass"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import { buttonVariants, type ButtonSize, type ButtonVariant } from '@/lib/ui/buttonVariants'

defineOptions({ inheritAttrs: false })

withDefaults(
  defineProps<{
    variant?: ButtonVariant
    size?: ButtonSize
    type?: 'button' | 'submit' | 'reset'
    disabled?: boolean
    className?: string
  }>(),
  { variant: 'primary', size: 'default', type: 'button', disabled: false },
)

const attrs = useAttrs()
const attrsWithoutClass = computed(() => {
  const { class: _c, ...rest } = attrs as Record<string, unknown>
  return rest
})
</script>
