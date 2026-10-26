<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'
import {
  SliderRange as RSliderRange,
  SliderRoot as RSliderRoot,
  SliderThumb as RSliderThumb,
  SliderTrack as RSliderTrack,
  useForwardPropsEmits,
  type SliderRootEmits,
  type SliderRootProps,
} from 'reka-ui'
import { cn } from '@/lib/cn'

interface Props extends SliderRootProps {
  class?: HTMLAttributes['class']
}

const props = withDefaults(defineProps<Props>(), { min: 0, max: 100 })
const emits = defineEmits<SliderRootEmits>()
const delegated = computed(() => {
  const { class: _class, ...rest } = props
  return rest
})
const forwarded = useForwardPropsEmits(delegated, emits)
const values = computed(() =>
  Array.isArray(props.modelValue)
    ? props.modelValue
    : Array.isArray(props.defaultValue)
      ? props.defaultValue
      : [props.min, props.max],
)
const base = "relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-vertical:h-full data-vertical:min-h-40 data-vertical:w-auto data-vertical:flex-col data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-40 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col"
const track = "relative grow overflow-hidden rounded-full bg-muted data-horizontal:h-1 data-horizontal:w-full data-vertical:h-full data-vertical:w-1 data-[orientation=horizontal]:h-1 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1"
const range = "absolute bg-primary select-none data-horizontal:h-full data-vertical:w-full data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full"
const thumb = "relative block size-3 shrink-0 rounded-full border border-ring bg-white ring-ring/50 transition-[color,box-shadow] select-none after:absolute after:-inset-2 hover:ring-3 focus-visible:ring-3 focus-visible:outline-hidden active:ring-3 disabled:pointer-events-none disabled:opacity-50"
</script>

<template>
  <RSliderRoot data-slot="slider" v-bind="forwarded" :class="cn(base, props.class)">
    <RSliderTrack data-slot="slider-track" :class="track">
      <RSliderRange data-slot="slider-range" :class="range" />
    </RSliderTrack>
    <RSliderThumb v-for="(_, index) in values" :key="index" data-slot="slider-thumb" :class="thumb" />
  </RSliderRoot>
</template>
