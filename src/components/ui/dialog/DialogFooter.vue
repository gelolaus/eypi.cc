<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { DialogClose as RDialogClose } from 'reka-ui'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/button'

const props = withDefaults(defineProps<{ class?: HTMLAttributes['class']; showCloseButton?: boolean }>(), {
  showCloseButton: false,
})
</script>

<template>
  <div
    data-slot="dialog-footer"
    :class="
      cn(
        '-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end',
        props.class,
      )
    "
  >
    <slot />
    <RDialogClose v-if="props.showCloseButton" as-child>
      <Button variant="outline">Close</Button>
    </RDialogClose>
  </div>
</template>
