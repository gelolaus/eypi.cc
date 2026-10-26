<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'
import {
  SelectContent as RSelectContent,
  SelectPortal as RSelectPortal,
  SelectViewport as RSelectViewport,
  useForwardPropsEmits,
  type SelectContentEmits,
  type SelectContentProps,
} from 'reka-ui'
import { cn } from '@/lib/cn'
import SelectScrollUpButton from './SelectScrollUpButton.vue'
import SelectScrollDownButton from './SelectScrollDownButton.vue'

defineOptions({ inheritAttrs: false })

interface Props extends SelectContentProps {
  class?: HTMLAttributes['class']
}

const props = withDefaults(defineProps<Props>(), { position: 'item-aligned', align: 'center' })
const emits = defineEmits<SelectContentEmits>()
const delegated = computed(() => {
  const { class: _class, ...rest } = props
  return rest
})
const forwarded = useForwardPropsEmits(delegated, emits)
const base = "relative z-50 max-h-(--reka-select-content-available-height) min-w-36 origin-(--reka-select-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-[align-trigger=true]:animate-none data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
const popper = 'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1'
const viewport = "data-[position=popper]:h-(--reka-select-trigger-height) data-[position=popper]:w-full data-[position=popper]:min-w-(--reka-select-trigger-width)"
</script>

<template>
  <RSelectPortal>
    <RSelectContent
      data-slot="select-content"
      :data-align-trigger="props.position === 'item-aligned'"
      v-bind="{ ...forwarded, ...$attrs }"
      :class="cn(base, props.position === 'popper' && popper, props.class)"
    >
      <SelectScrollUpButton />
      <RSelectViewport
        :data-position="props.position"
        :class="viewport"
      >
        <slot />
      </RSelectViewport>
      <SelectScrollDownButton />
    </RSelectContent>
  </RSelectPortal>
</template>
