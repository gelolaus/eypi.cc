<template>
  <div class="space-y-6">
    <section class="space-y-2">
      <h2 class="text-sm font-medium">
        Layout
      </h2>
      <Tabs v-model="layout">
        <TabsList aria-label="Layout">
          <TabsTrigger value="grid">
            Grid
          </TabsTrigger>
          <TabsTrigger value="agenda">
            Agenda
          </TabsTrigger>
          <TabsTrigger value="cards">
            Cards
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </section>

    <section class="space-y-2">
      <h2 class="text-sm font-medium">
        Theme
      </h2>
      <Tabs v-model="theme">
        <TabsList aria-label="Theme">
          <TabsTrigger value="light">
            Light
          </TabsTrigger>
          <TabsTrigger value="dark">
            Dark
          </TabsTrigger>
          <TabsTrigger value="black">
            True black
          </TabsTrigger>
          <TabsTrigger value="apc">
            APC
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </section>

    <section class="space-y-2">
      <h2 class="text-sm font-medium">
        Photo background
      </h2>
      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        class="sr-only"
        tabindex="-1"
        aria-label="Photo background file"
        @change="onFile"
      >
      <div class="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          @click="fileInput?.click()"
        >
          Choose photo
        </Button>
        <Button
          v-if="photoName"
          type="button"
          variant="ghost"
          @click="emit('clearPhoto')"
        >
          Remove photo
        </Button>
        <span
          v-if="photoName"
          class="min-w-0 truncate text-sm text-muted-foreground"
        >{{ photoName }}</span>
      </div>
      <p
        v-if="photoError"
        class="text-sm text-destructive"
        role="alert"
      >
        {{ photoError }}
      </p>
      <p
        v-if="photoNotice"
        class="text-sm text-muted-foreground"
      >
        {{ photoNotice }}
      </p>
      <div class="space-y-2 pt-1">
        <div class="flex items-center justify-between text-sm">
          <span class="font-medium">Dimming</span>
          <span class="tabular-nums text-muted-foreground">{{ Math.round(dim * 100) }}%</span>
        </div>
        <Slider
          :model-value="[Math.round(dim * 100)]"
          :min="0"
          :max="80"
          :step="5"
          thumb-label="Photo dimming"
          @update:model-value="onDim"
        />
      </div>
    </section>

    <section class="space-y-2">
      <h2 class="text-sm font-medium">
        Size
      </h2>
      <!-- eslint-disable-next-line vuejs-accessibility/form-control-has-label -- the trigger inside carries the aria-label -->
      <Select
        :model-value="sizeChoice"
        @update:model-value="onSizeChoice"
      >
        <SelectTrigger
          class="w-full"
          aria-label="Wallpaper size"
        >
          <SelectValue placeholder="Choose a size" />
        </SelectTrigger>
        <SelectContent position="popper">
          <SelectItem
            v-for="preset in PRESETS"
            :key="preset.id"
            :value="preset.id"
          >
            {{ preset.label }}
          </SelectItem>
          <SelectItem value="custom">
            Custom
          </SelectItem>
        </SelectContent>
      </Select>
      <div
        v-if="sizeChoice === 'custom'"
        class="grid grid-cols-2 gap-3"
      >
        <div class="space-y-1.5">
          <Label for="wallpaper-width">Width (px)</Label>
          <Input
            id="wallpaper-width"
            v-model="widthText"
            type="number"
            inputmode="numeric"
            @blur="commitCustom"
          />
        </div>
        <div class="space-y-1.5">
          <Label for="wallpaper-height">Height (px)</Label>
          <Input
            id="wallpaper-height"
            v-model="heightText"
            type="number"
            inputmode="numeric"
            @blur="commitCustom"
          />
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PRESETS, clampSize } from '@/lib/wallpaper/sizes'
import type { Size } from '@/lib/wallpaper/sizes'
import type { LayoutId, ThemeName } from '@/lib/wallpaper/types'

defineProps<{
  photoName: string | null
  photoNotice: string | null
  photoError: string | null
}>()
const emit = defineEmits<{ photo: [file: File]; clearPhoto: [] }>()

const layout = defineModel<LayoutId>('layout', { required: true })
const theme = defineModel<ThemeName>('theme', { required: true })
const dim = defineModel<number>('dim', { required: true })
const size = defineModel<Size>('size', { required: true })

const fileInput = ref<HTMLInputElement | null>(null)
const custom = ref(false)
const widthText = ref(String(size.value.width))
const heightText = ref(String(size.value.height))

const matchingPreset = computed(() => PRESETS.find((p) => p.width === size.value.width && p.height === size.value.height))
const sizeChoice = computed(() => (custom.value || !matchingPreset.value ? 'custom' : matchingPreset.value.id))

watch(size, (value) => {
  widthText.value = String(value.width)
  heightText.value = String(value.height)
})

function onSizeChoice(value: unknown) {
  if (value === 'custom') {
    custom.value = true
    return
  }
  const preset = PRESETS.find((p) => p.id === value)
  if (!preset) return
  custom.value = false
  size.value = { width: preset.width, height: preset.height }
}

function commitCustom() {
  size.value = clampSize({ width: Number(widthText.value), height: Number(heightText.value) })
}

function onDim(value: number[] | undefined) {
  if (value?.length) dim.value = value[0] / 100
}

function onFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) emit('photo', file)
  input.value = ''
}
</script>
