<template>
  <DropdownMenuSub>
    <DropdownMenuSubTrigger class="min-h-11 rounded-xl px-3 py-3 text-base">
      <Palette aria-hidden="true" />
      Appearance
    </DropdownMenuSubTrigger>
    <DropdownMenuSubContent class="w-56 p-2">
      <DropdownMenuRadioGroup
        :model-value="preference.mode"
        aria-label="Theme"
        @update:model-value="onMode"
      >
        <DropdownMenuRadioItem
          v-for="option in options"
          :key="option.mode"
          :value="option.mode"
          class="min-h-11 rounded-xl px-3 py-3 text-base data-[state=checked]:font-semibold"
          @select.prevent
        >
          {{ option.label }}
        </DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
      <template v-if="isDark">
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          :model-value="preference.black"
          class="min-h-11 rounded-xl px-3 py-3 text-base data-[state=checked]:font-semibold"
          @update:model-value="setBlack(!!$event)"
          @select.prevent
        >
          True black
        </DropdownMenuCheckboxItem>
      </template>
    </DropdownMenuSubContent>
  </DropdownMenuSub>
</template>

<script setup lang="ts">
import { Palette } from 'lucide-vue-next'
import {
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu'
import { useTheme } from '@/composables/useTheme'
import type { ThemeMode } from '@/theme/theme'

const { preference, isDark, setMode, setBlack } = useTheme()

const options: Array<{ mode: ThemeMode; label: string }> = [
  { mode: 'system', label: 'System' },
  { mode: 'light', label: 'Light' },
  { mode: 'dark', label: 'Dark' },
]

function onMode(value: unknown) {
  if (value === 'system' || value === 'light' || value === 'dark') setMode(value)
}
</script>
