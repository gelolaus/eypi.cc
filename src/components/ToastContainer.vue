<template>
  <Toaster rich-colors position="top-center" />
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue'
import { toast as sonner } from 'vue-sonner'
import { Toaster } from '@/components/ui/sonner'
import { useToast, type Toast } from '@/composables/useToast'

// The store stays the source of truth (dedupe, cap, timers, pause/resume);
// vue-sonner only renders. Sonner never auto-closes: the store removes toasts.
const { toasts, dismiss, pause, resume } = useToast()
const shown = new Map<number, string>()

function show(t: Toast) {
  const id = `eypi-toast-${t.id}`
  const fn = t.type === 'success' ? sonner.success : t.type === 'error' ? sonner.error : sonner.info
  fn(t.message, {
    id,
    description: t.detail,
    duration: Infinity,
    class: id,
    onDismiss: () => dismiss(t.id),
  })
  shown.set(t.id, id)
}

watch(
  () => toasts.value.map((t) => t.id).join(','),
  () => {
    const live = new Set(toasts.value.map((t) => t.id))
    for (const t of toasts.value) if (!shown.has(t.id)) show(t)
    for (const [storeId, id] of shown) {
      if (live.has(storeId)) continue
      shown.delete(storeId)
      sonner.dismiss(id)
    }
  },
  { immediate: true, flush: 'sync' },
)

function toastIdFrom(target: EventTarget | null): number | null {
  const el = (target as Element | null)?.closest?.('[data-sonner-toast]')
  const match = el && /eypi-toast-(\d+)/.exec(el.className)
  return match ? Number(match[1]) : null
}

function onEnter(e: Event) {
  const id = toastIdFrom(e.target)
  if (id !== null) pause(id)
}
function onLeave(e: Event) {
  const id = toastIdFrom(e.target)
  if (id !== null) resume(id)
}

function onKeydown(e: KeyboardEvent) {
  if (e.key !== 'Escape' || e.defaultPrevented) return
  if (document.querySelector('[role="dialog"], [aria-modal="true"]')) return
  const top = toasts.value[toasts.value.length - 1]
  if (top) dismiss(top.id)
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  document.addEventListener('mouseover', onEnter)
  document.addEventListener('mouseout', onLeave)
  document.addEventListener('focusin', onEnter)
  document.addEventListener('focusout', onLeave)
  document.addEventListener('touchstart', onEnter, { passive: true })
  document.addEventListener('touchend', onLeave)
  document.addEventListener('touchcancel', onLeave)
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  document.removeEventListener('mouseover', onEnter)
  document.removeEventListener('mouseout', onLeave)
  document.removeEventListener('focusin', onEnter)
  document.removeEventListener('focusout', onLeave)
  document.removeEventListener('touchstart', onEnter)
  document.removeEventListener('touchend', onLeave)
  document.removeEventListener('touchcancel', onLeave)
})
</script>
