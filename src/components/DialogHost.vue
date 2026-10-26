<template>
  <Dialog :open="current !== null" @update:open="onOpenChange">
    <DialogContent
      v-if="current"
      :show-close-button="false"
      @open-auto-focus="onOpenAutoFocus"
    >
      <DialogHeader>
        <DialogTitle>{{ current.title }}</DialogTitle>
        <DialogDescription class="whitespace-pre-line">
          {{ current.body }}
        </DialogDescription>
      </DialogHeader>

      <div v-if="current.requireText" class="grid gap-1.5">
        <label :for="inputId" class="text-sm font-medium text-muted-foreground">
          Type <span class="font-mono text-foreground">{{ current.requireText }}</span> to confirm
        </label>
        <Input
          :id="inputId"
          v-model="typed"
          type="text"
          autocomplete="off"
          class="font-mono"
          @keydown.enter.prevent="tryConfirm"
        />
      </div>

      <DialogFooter data-dialog-footer>
        <template v-if="current.kind === 'info'">
          <Button id="eypi-dialog-primary" class="w-full" @click="confirmAction">
            {{ current.confirmLabel }}
          </Button>
        </template>
        <template v-else>
          <Button variant="outline" class="flex-1" @click="abort">
            {{ current.abortLabel }}
          </Button>
          <Button
            id="eypi-dialog-primary"
            variant="destructive"
            class="flex-1"
            :disabled="!canConfirm"
            @click="tryConfirm"
          >
            {{ current.confirmLabel }}
          </Button>
        </template>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useDialog } from '@/composables/useDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const { current, confirmAction, abort } = useDialog()

const typed = ref('')
const primaryId = 'eypi-dialog-primary'
const inputId = 'eypi-dialog-confirm-text'

const canConfirm = computed(() => {
  if (!current.value || current.value.kind === 'info') return true
  if (!current.value.requireText) return true
  return typed.value === current.value.requireText
})

// Esc, backdrop click and the close signal all dismiss: info resolves as
// acknowledged, confirm aborts.
function onOpenChange(open: boolean) {
  if (open) return
  if (current.value?.kind === 'info') {
    confirmAction()
    return
  }
  abort()
}

function tryConfirm() {
  if (!canConfirm.value) return
  confirmAction()
}

function focusTarget() {
  const target = document.getElementById(current.value?.requireText ? inputId : primaryId)
  target?.focus()
}

function onOpenAutoFocus(e: Event) {
  e.preventDefault()
  focusTarget()
}

// A queued dialog replaces the current one without closing the Dialog, so
// open-auto-focus does not fire again: refocus here.
watch(current, async (next, prev) => {
  typed.value = ''
  if (!next || !prev) return
  await nextTick()
  focusTarget()
})
</script>
