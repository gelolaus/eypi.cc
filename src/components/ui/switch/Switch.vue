<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'
import {
  SwitchRoot as RSwitchRoot,
  SwitchThumb as RSwitchThumb,
  useForwardPropsEmits,
  type SwitchRootEmits,
  type SwitchRootProps,
} from 'reka-ui'
import { cn } from '@/lib/cn'

interface Props extends SwitchRootProps {
  class?: HTMLAttributes['class']
  size?: 'sm' | 'default'
}

const props = withDefaults(defineProps<Props>(), { size: 'default' })
const emits = defineEmits<SwitchRootEmits>()
const delegated = computed(() => {
  const { class: _class, size: _size, ...rest } = props
  return rest
})
const forwarded = useForwardPropsEmits(delegated, emits)
const base = "peer group/switch relative inline-flex shrink-0 items-center rounded-full border border-transparent transition-all outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-[size=default]:h-[18.4px] data-[size=default]:w-[32px] data-[size=sm]:h-[14px] data-[size=sm]:w-[24px] dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-checked:bg-primary data-unchecked:bg-input dark:data-unchecked:bg-input/80 data-disabled:cursor-not-allowed data-disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input dark:data-[state=unchecked]:bg-input/80"
const thumb = "pointer-events-none block rounded-full bg-background ring-0 transition-transform group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 group-data-[size=default]/switch:data-checked:translate-x-[calc(100%-2px)] group-data-[size=sm]/switch:data-checked:translate-x-[calc(100%-2px)] dark:data-checked:bg-primary-foreground group-data-[size=default]/switch:data-unchecked:translate-x-0 group-data-[size=sm]/switch:data-unchecked:translate-x-0 dark:data-unchecked:bg-foreground group-data-[size=default]/switch:data-[state=checked]:translate-x-[calc(100%-2px)] group-data-[size=sm]/switch:data-[state=checked]:translate-x-[calc(100%-2px)] dark:data-[state=checked]:bg-primary-foreground group-data-[size=default]/switch:data-[state=unchecked]:translate-x-0 group-data-[size=sm]/switch:data-[state=unchecked]:translate-x-0 dark:data-[state=unchecked]:bg-foreground"
</script>

<template>
  <RSwitchRoot data-slot="switch" :data-size="props.size" v-bind="forwarded" :class="cn(base, props.class)">
    <RSwitchThumb data-slot="switch-thumb" :class="thumb" />
  </RSwitchRoot>
</template>
