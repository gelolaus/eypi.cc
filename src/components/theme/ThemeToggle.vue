<template>
  <div class="flex flex-col items-center gap-3">
    <div
      role="radiogroup"
      aria-label="Theme"
      class="inline-flex gap-1 rounded-full border border-border bg-muted p-1"
    >
      <button
        v-for="(option, index) in options"
        :key="option.mode"
        :ref="(el) => (buttons[index] = el as HTMLButtonElement | null)"
        type="button"
        role="radio"
        :aria-checked="preference.mode === option.mode"
        :tabindex="preference.mode === option.mode ? 0 : -1"
        :class="cn(
          'inline-flex min-h-11 min-w-20 items-center justify-center rounded-full px-4 text-base outline-none transition focus-visible:ring-[3px] focus-visible:ring-ring/50',
          preference.mode === option.mode
            ? 'bg-primary font-semibold text-primary-foreground'
            : 'font-medium text-muted-foreground hover:text-foreground',
        )"
        @click="setMode(option.mode)"
        @keydown="onKeydown($event, index)"
      >
        {{ option.label }}
      </button>
    </div>

    <label
      v-if="isDark"
      for="theme-true-black"
      class="inline-flex min-h-11 cursor-pointer items-center gap-3 text-base text-foreground"
    >
      <Switch
        id="theme-true-black"
        :model-value="preference.black"
        @update:model-value="setBlack"
      />
      True black
    </label>
  </div>
</template>

<script setup lang="ts">
import { nextTick } from 'vue'
import { Switch } from '@/components/ui/switch'
import { useTheme } from '@/composables/useTheme'
import { cn } from '@/lib/cn'
import type { ThemeMode } from '@/theme/theme'

const { preference, isDark, setMode, setBlack } = useTheme()

const options: Array<{ mode: ThemeMode; label: string }> = [
  { mode: 'system', label: 'System' },
  { mode: 'light', label: 'Light' },
  { mode: 'dark', label: 'Dark' },
]

const buttons: Array<HTMLButtonElement | null> = []

const STEP: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }

function onKeydown(event: KeyboardEvent, index: number) {
  const step = STEP[event.key]
  if (!step) return
  event.preventDefault()
  const next = (index + step + options.length) % options.length
  setMode(options[next].mode)
  void nextTick(() => buttons[next]?.focus())
}
</script>
