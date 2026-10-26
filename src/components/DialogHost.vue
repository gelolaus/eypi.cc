<template>
  <Teleport to="body">
    <Transition name="dialog-fade">
      <div
        v-if="current"
        class="fixed inset-0 z-[10000] flex items-end justify-center bg-slate-900/20 backdrop-blur-sm sm:items-center sm:p-4 dark:bg-slate-900/80"
        role="presentation"
        @mousedown.self="onBackdrop"
      >
        <!-- eslint-disable-next-line vuejs-accessibility/no-static-element-interactions -- dialog handles focus and Escape -->
        <div
          ref="panelRef"
          class="mica-card max-h-[90dvh] w-full max-w-none sm:max-w-md overflow-y-auto rounded-t-3xl border border-g-border bg-g-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-left shadow-2xl sm:rounded-3xl sm:p-8"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          :aria-describedby="bodyId"
          tabindex="-1"
          @keydown="onPanelKeydown"
        >
          <h3 :id="titleId" class="mb-3 text-xl font-bold text-g-text">
            {{ current.title }}
          </h3>
          <p :id="bodyId" class="text-sm leading-relaxed text-g-muted whitespace-pre-line">
            {{ current.body }}
          </p>

          <div v-if="current.requireText" class="mt-4">
            <label :for="inputId" class="mb-1.5 block text-sm font-medium text-g-muted">
              Type <span class="font-mono text-g-text">{{ current.requireText }}</span> to confirm
            </label>
            <input
              :id="inputId"
              ref="inputRef"
              v-model="typed"
              type="text"
              autocomplete="off"
              class="w-full h-11 rounded-xl border border-g-border bg-white/70 px-3 font-mono text-base text-g-text outline-none focus:border-g-primary dark:bg-mica-navy-input"
              @keydown.enter.prevent="tryConfirm"
            />
          </div>

          <div
            data-dialog-footer
            class="mt-6 flex flex-col-reverse gap-2 sm:flex-row"
          >
            <template v-if="current.kind === 'info'">
              <button
                ref="primaryRef"
                type="button"
 class="btn-gold min-h-11 w-full rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200 hover:brightness-110"
                @click="confirmAction"
              >
                {{ current.confirmLabel }}
              </button>
            </template>
            <template v-else>
              <button
                type="button"
                class="min-h-11 flex-1 rounded-xl border border-g-border bg-white/60 px-4 py-3 text-sm font-semibold text-g-text transition-colors hover:bg-white dark:bg-mica-navy-input"
                @click="abort"
              >
                {{ current.abortLabel }}
              </button>
              <button
                ref="primaryRef"
                type="button"
                class="min-h-11 flex-1 rounded-xl bg-red-500 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-55"
                :disabled="!canConfirm"
                @click="tryConfirm"
              >
                {{ current.confirmLabel }}
              </button>
            </template>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useDialog } from '@/composables/useDialog'
import { useFocusTrap } from '@/composables/useFocusTrap'

const { current, confirmAction, abort } = useDialog()

const panelRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)
const primaryRef = ref<HTMLButtonElement | null>(null)
const typed = ref('')
const titleId = 'eypi-dialog-title'
const bodyId = 'eypi-dialog-body'
const inputId = 'eypi-dialog-confirm-text'

const canConfirm = computed(() => {
  if (!current.value || current.value.kind === 'info') return true
  if (!current.value.requireText) return true
  return typed.value === current.value.requireText
})

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

const { activate, release } = useFocusTrap(panelRef)

function onPanelKeydown(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  e.preventDefault()
  e.stopPropagation()
  onBackdrop()
}

watch(
  current,
  async (dialog) => {
    typed.value = ''
    if (!dialog) {
      release()
      return
    }
    await nextTick()
    const preferred = dialog.requireText && inputRef.value ? inputRef.value : primaryRef.value
    activate(preferred)
  },
)
</script>

<style scoped>
.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 0.3s ease;
}
.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}
.dialog-fade-enter-active [role='dialog'],
.dialog-fade-leave-active [role='dialog'] {
  transition: transform 0.3s cubic-bezier(0.2, 1, 0.3, 1);
}
@media (max-width: 639px) {
  .dialog-fade-enter-from [role='dialog'],
  .dialog-fade-leave-to [role='dialog'] {
    transform: translateY(100%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .dialog-fade-enter-active,
  .dialog-fade-leave-active,
  .dialog-fade-enter-active [role='dialog'],
  .dialog-fade-leave-active [role='dialog'] {
    transition-duration: 0.01ms;
  }
}
</style>
