<template>
  <Teleport to="body">
    <Transition name="dialog-fade">
      <div
        v-if="current"
        class="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/20 p-4 backdrop-blur-sm dark:bg-slate-900/80"
        role="presentation"
        @mousedown.self="onBackdrop"
      >
        <div
          ref="panelRef"
          class="mica-card w-full max-w-md rounded-2xl border border-g-border bg-g-surface p-8 text-left shadow-2xl"
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
              class="w-full rounded-xl border border-g-border bg-white/70 px-3 py-2.5 font-mono text-sm text-g-text outline-none focus:border-g-primary dark:bg-mica-navy-input"
              @keydown.enter.prevent="tryConfirm"
            />
          </div>

          <div
            class="mt-6 flex gap-2"
            :class="current.kind === 'info' ? 'flex-col' : ''"
          >
            <template v-if="current.kind === 'info'">
              <button
                ref="primaryRef"
                type="button"
                class="w-full rounded-xl bg-g-accent px-4 py-3 text-sm font-semibold text-white transition-all duration-200 hover:brightness-110 dark:bg-eypi-gold-dark dark:text-slate-100 dark:hover:bg-eypi-gold-hover"
                @click="confirmAction"
              >
                {{ current.confirmLabel }}
              </button>
            </template>
            <template v-else>
              <button
                type="button"
                class="flex-1 rounded-xl border border-g-border bg-white/60 px-4 py-3 text-sm font-semibold text-g-text transition-colors hover:bg-white dark:bg-mica-navy-input"
                @click="abort"
              >
                {{ current.abortLabel }}
              </button>
              <button
                ref="primaryRef"
                type="button"
                class="flex-1 rounded-xl bg-red-500 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-55"
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

function onPanelKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    onBackdrop()
    return
  }
  if (e.key !== 'Tab' || !panelRef.value) return

  const focusable = panelRef.value.querySelectorAll<HTMLElement>(
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
    if (dialog.requireText && inputRef.value) {
      inputRef.value.focus()
      return
    }
    primaryRef.value?.focus()
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

@media (prefers-reduced-motion: reduce) {
  .dialog-fade-enter-active,
  .dialog-fade-leave-active {
    transition-duration: 0.01ms;
  }
}
</style>
