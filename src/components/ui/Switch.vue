<template>
  <button
    type="button"
    role="switch"
    :aria-checked="model"
    :disabled="disabled"
    :class="switchClasses({ checked: model, className })"
    v-bind="attrsWithoutClass"
    @click="toggle"
  >
    <span :class="switchThumbClasses({ checked: model })" aria-hidden="true" />
  </button>
</template>

<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import { switchClasses, switchThumbClasses } from '@/lib/ui/switchClasses'

defineOptions({ inheritAttrs: false })

const model = defineModel<boolean>({ default: false })

withDefaults(
  defineProps<{
    disabled?: boolean
    className?: string
  }>(),
  { disabled: false },
)

const attrs = useAttrs()
const attrsWithoutClass = computed(() => {
  const { class: _c, ...rest } = attrs as Record<string, unknown>
  return rest
})

function toggle() {
  model.value = !model.value
}
</script>
