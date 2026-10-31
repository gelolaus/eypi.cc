<template>
  <!-- Below sm: a modal sheet teleported to body. From sm: the slot inline as an anchored popover. -->
  <Teleport
    to="body"
    :disabled="!isPhone"
  >
    <template v-if="open">
      <button
        type="button"
        data-sheet-backdrop
        class="fixed inset-0 z-[10000] cursor-default border-0 bg-black/50 p-0 sm:z-40 sm:bg-transparent"
        :aria-label="closeLabel"
        tabindex="-1"
        @click="close"
      />
      <div
        :id="panelId"
        ref="panelRef"
        v-bind="passthrough($attrs)"
        :role="isPhone ? 'dialog' : undefined"
        :aria-modal="isPhone ? 'true' : undefined"
        :aria-label="isPhone ? title : undefined"
        :class="isPhone ? PHONE_PANEL : [DESKTOP_PANEL, $attrs.class]"
      >
        <template v-if="isPhone">
          <div
            class="mx-auto mb-2 h-1.5 w-10 rounded-full bg-border"
            aria-hidden="true"
          />
          <p class="px-3 pb-2 text-sm font-semibold text-muted-foreground">
            {{ title }}
          </p>
        </template>
        <slot />
      </div>
    </template>
  </Teleport>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useId, watch, type Ref } from 'vue'
import { useFocusTrap } from '@/composables/useFocusTrap'

/** Tailwind `sm` is 640px, so a phone is anything narrower. */
const PHONE_QUERY = '(max-width: 639px)'

function useIsPhone(): Ref<boolean> {
  const isPhone = ref(false)
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return isPhone

  const mql = window.matchMedia(PHONE_QUERY)
  const sync = () => {
    isPhone.value = mql.matches
  }
  sync()
  mql.addEventListener?.('change', sync)
  onBeforeUnmount(() => mql.removeEventListener?.('change', sync))
  return isPhone
}

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    open: boolean
    title: string
    /** Id of the panel, so a trigger can point `aria-controls` at it. */
    id?: string
    /** Accessible name of the backdrop button. */
    closeLabel?: string
    /** Move focus back to the opener after close. Turn off when another dialog is taking focus. */
    restoreFocus?: boolean
  }>(),
  { closeLabel: 'Close', restoreFocus: true },
)

const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const PHONE_PANEL =
  'fixed inset-x-0 bottom-0 z-[10001] max-h-[80dvh] overflow-y-auto rounded-t-3xl bg-popover px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 text-left text-popover-foreground shadow-2xl ring-1 ring-foreground/10'
// The caller adds positioning (`absolute`, `z-50`, width, side) through `class`.
const DESKTOP_PANEL = 'rounded-lg bg-popover py-1.5 text-left text-popover-foreground shadow-md ring-1 ring-foreground/10'

const generatedId = useId()
const panelId = props.id ?? generatedId
const isPhone = useIsPhone()
const panelRef = ref<HTMLElement | null>(null)
const trap = useFocusTrap(panelRef)
let opener: HTMLElement | null = null

/** Everything except `class`, which only styles the desktop popover. */
function passthrough(attrs: Record<string, unknown>) {
  const { class: _class, ...rest } = attrs
  return rest
}

function close() {
  emit('update:open', false)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') close()
}

watch(
  () => props.open,
  (open, wasOpen) => {
    if (open) {
      const active = document.activeElement
      opener = active instanceof HTMLElement && active !== document.body ? active : null
      window.addEventListener('keydown', onKeydown)
      // The phone sheet is modal: move focus in and keep Tab inside it.
      if (isPhone.value) void nextTick(() => trap.activate())
    } else if (wasOpen) {
      window.removeEventListener('keydown', onKeydown)
      trap.release()
      const target = opener
      const shouldRestore = props.restoreFocus
      opener = null
      void nextTick(() => {
        if (shouldRestore && target?.isConnected) target.focus()
      })
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>
