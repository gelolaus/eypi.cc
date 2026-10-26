<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'
import { X } from 'lucide-vue-next'
import {
  DialogClose as RDialogClose,
  DialogContent as RDialogContent,
  DialogPortal as RDialogPortal,
  useForwardPropsEmits,
  type DialogContentEmits,
  type DialogContentProps,
} from 'reka-ui'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/button'
import DialogOverlay from './DialogOverlay.vue'

defineOptions({ inheritAttrs: false })

interface Props extends DialogContentProps {
  class?: HTMLAttributes['class']
  showCloseButton?: boolean
}

const props = withDefaults(defineProps<Props>(), { showCloseButton: true })
const emits = defineEmits<DialogContentEmits>()
const delegated = computed(() => {
  const { class: _class, showCloseButton: _show, ...rest } = props
  return rest
})
const forwarded = useForwardPropsEmits(delegated, emits)
const base = "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
</script>

<template>
  <RDialogPortal>
    <DialogOverlay />
    <RDialogContent
      data-slot="dialog-content"
      v-bind="{ ...forwarded, ...$attrs }"
      :class="cn(base, props.class)"
    >
      <slot />
      <RDialogClose
        v-if="props.showCloseButton"
        data-slot="dialog-close"
        as-child
      >
        <Button
          variant="ghost"
          class="absolute top-2 right-2"
          size="icon-sm"
        >
          <X />
          <span class="sr-only">Close</span>
        </Button>
      </RDialogClose>
    </RDialogContent>
  </RDialogPortal>
</template>
