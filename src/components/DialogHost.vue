<template>
  <Teleport to="body">
    <Transition name="dialog-fade">
      <Dialog
        v-if="current"
        ref="dialogRef"
        :labelled-by="titleId"
        :described-by="bodyId"
        @backdrop="onBackdrop"
        @keydown="onPanelKeydown"
      >
        <h3 :id="titleId" class="mb-3 font-display text-xl font-bold text-g-text">
          {{ current.title }}
        </h3>
        <p :id="bodyId" class="whitespace-pre-line text-sm leading-relaxed text-g-muted">
          {{ current.body }}
        </p>

        <div v-if="current.requireText" class="mt-4">
          <label :for="inputId" class="mb-1.5 block text-sm font-medium text-g-muted">
            Type <span class="font-mono text-g-text">{{ current.requireText }}</span> to confirm
          </label>
          <Input
            :id="inputId"
            ref="inputRef"
            :value="typed"
            type="text"
            autocomplete="off"
            className="font-mono text-sm"
            @input="onTypedInput"
            @keydown.enter.prevent="tryConfirm"
          />
        </div>

        <div
          class="mt-6 flex gap-2"
          :class="current.kind === 'info' ? 'flex-col' : ''"
        >
          <template v-if="current.kind === 'info'">
            <Button
              ref="primaryRef"
              variant="primary"
              className="w-full"
              @click="confirmAction"
            >
              {{ current.confirmLabel }}
            </Button>
          </template>
          <template v-else>
            <Button
              variant="secondary"
              className="flex-1"
              @click="abort"
            >
              {{ current.abortLabel }}
            </Button>
            <Button
              ref="primaryRef"
              variant="destructive"
              className="flex-1"
              :disabled="!canConfirm"
              @click="tryConfirm"
            >
              {{ current.confirmLabel }}
            </Button>
          </template>
        </div>
      </Dialog>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import Dialog from '@/components/ui/Dialog.vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import { matchesRequireText, useDialog } from '@/composables/useDialog'

const { current, confirmAction, abort } = useDialog()

const dialogRef = ref<{ panelRef: HTMLElement | null } | null>(null)
const inputRef = ref<{ $el?: HTMLInputElement } | null>(null)
const primaryRef = ref<{ $el?: HTMLButtonElement } | null>(null)
const typed = ref('')
const titleId = 'eypi-dialog-title'
const bodyId = 'eypi-dialog-body'
const inputId = 'eypi-dialog-confirm-text'

const canConfirm = computed(() => {
  if (!current.value || current.value.kind === 'info') return true
  return matchesRequireText(typed.value, current.value.requireText)
})

function onTypedInput(e: Event) {
  typed.value = (e.target as HTMLInputElement).value
}

function onBackdrop() {
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

function panelEl(): HTMLElement | null {
  return dialogRef.value?.panelRef ?? null
}

function onPanelKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    onBackdrop()
    return
  }
  const panel = panelEl()
  if (e.key !== 'Tab' || !panel) return

  const focusable = panel.querySelectorAll<HTMLElement>(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )
  if (focusable.length === 0) return
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault()
    first.focus()
  }
}

watch(
  current,
  async (dialog) => {
    typed.value = ''
    if (!dialog) return
    await nextTick()
    if (dialog.requireText && inputRef.value?.$el) {
      inputRef.value.$el.focus()
      return
    }
    primaryRef.value?.$el?.focus()
  },
)
</script>

<style>
/* Transition classes target Dialog root (child SFC); keep unscoped. */
.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 0.3s ease;
}
.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .dialog-fade-enter-active,
  .dialog-fade-leave-active {
    transition-duration: 0.01ms;
  }
}
</style>
