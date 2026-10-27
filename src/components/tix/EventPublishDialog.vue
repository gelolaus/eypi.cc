<template>
  <Dialog
    :open="open"
    @update:open="(v: boolean) => emit('update:open', v)"
  >
    <DialogContent class="max-h-[90dvh] overflow-y-auto sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Publish this event?</DialogTitle>
        <DialogDescription>
          {{ importMode ? 'People join through your attendee list, not a registration page.' : 'Anyone with the link can open the event page and register.' }}
        </DialogDescription>
      </DialogHeader>

      <dl
        class="space-y-3 text-sm"
        data-publish-summary
      >
        <div
          v-for="row in rows"
          :key="row.label"
        >
          <dt class="text-muted-foreground">
            {{ row.label }}
          </dt>
          <dd class="mt-0.5 break-words font-medium">
            {{ row.value }}
          </dd>
        </div>
      </dl>

      <DialogFooter class="gap-2">
        <Button
          type="button"
          variant="outline"
          data-cancel-publish
          :disabled="busy"
          @click="emit('update:open', false)"
        >
          Keep editing
        </Button>
        <Button
          type="button"
          data-confirm-publish
          :disabled="busy"
          @click="emit('confirm')"
        >
          {{ busy ? 'PUBLISHING...' : 'Publish' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

defineProps<{
  open: boolean
  busy: boolean
  importMode?: boolean
  rows: { label: string; value: string }[]
}>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  confirm: []
}>()
</script>
