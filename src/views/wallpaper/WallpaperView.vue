<template>
  <AppPage
    title="Wallpaper"
    description="Turn your class schedule into a phone wallpaper."
  >
    <div class="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-start">
      <section class="space-y-3 lg:col-start-1 lg:row-start-1">
        <Label for="wallpaper-schedule">Your schedule</Label>
        <Textarea
          id="wallpaper-schedule"
          v-model="text"
          :maxlength="MAX_PASTE_LENGTH"
          rows="6"
          placeholder="Paste your class schedule here"
          class="min-h-40"
        />
        <p class="text-sm text-muted-foreground">
          In RAMS, open My Class Schedules/Assessments. Select the whole page, copy, and paste it here.
        </p>
        <p class="text-sm text-muted-foreground sm:hidden">
          Tip: tap and hold, choose Select all, then Copy.
        </p>
        <div class="flex flex-wrap gap-2">
          <Button
            v-if="canReadClipboard"
            type="button"
            variant="outline"
            @click="pasteFromClipboard"
          >
            Paste from clipboard
          </Button>
          <Button
            type="button"
            variant="ghost"
            :disabled="!text"
            @click="text = ''"
          >
            Clear
          </Button>
        </div>
      </section>

      <section class="space-y-4 max-lg:contents lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-stretch">
        <div
          role="status"
          class="space-y-1 text-sm"
        >
          <template v-if="hasSchedule && parsed.warnings.length > 0">
            <p class="font-medium">
              Some rows could not be read:
            </p>
            <ul class="list-disc space-y-0.5 pl-5 text-muted-foreground">
              <li
                v-for="warning in parsed.warnings"
                :key="warning"
              >
                {{ warning }}
              </li>
            </ul>
          </template>
        </div>
        <div
          v-if="hasSchedule"
          data-test="pinned-preview"
          class="sticky top-0 z-30 -mx-4 bg-background/90 px-4 py-2 backdrop-blur-md [--preview-max-h:30svh] sm:-mx-6 sm:px-6 lg:top-6 lg:mx-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none lg:[--preview-max-h:calc(100svh-9rem)]"
        >
          <Button
            type="button"
            variant="ghost"
            size="sm"
            data-test="toggle-preview"
            class="mb-1 w-full lg:hidden"
            aria-controls="wallpaper-preview"
            :aria-expanded="previewOpen"
            @click="previewOpen = !previewOpen"
          >
            {{ previewOpen ? 'Hide preview' : 'Show preview' }}
          </Button>
          <div
            id="wallpaper-preview"
            :class="!previewOpen && 'max-lg:hidden'"
          >
            <WallpaperPreview :input="renderInput" />
          </div>
        </div>
        <p
          v-else-if="!text.trim()"
          class="rounded-2xl border border-dashed border-border p-6 text-center text-muted-foreground"
        >
          Paste your schedule to see your wallpaper.
        </p>
        <p
          v-else-if="!pending"
          class="rounded-2xl border border-dashed border-border p-6 text-center text-muted-foreground"
        >
          We could not find a class schedule in that text. Copy the whole page from RAMS and paste it again.
        </p>
      </section>

      <section class="lg:col-start-1 lg:row-start-2">
        <WallpaperControls
          v-model:layout="layout"
          v-model:theme="theme"
          v-model:dim="dim"
          v-model:size="size"
          :photo-name="photoName"
          :photo-notice="photoNotice"
          :photo-error="photoError"
          @photo="onPhoto"
          @clear-photo="onClearPhoto"
        />
        <div class="mt-6 flex flex-wrap gap-2">
          <Button
            type="button"
            :disabled="!hasSchedule || exporting"
            @click="download"
          >
            Download PNG
          </Button>
          <Button
            v-if="canShareFiles"
            type="button"
            variant="outline"
            :disabled="!hasSchedule || exporting"
            @click="share"
          >
            Share
          </Button>
        </div>
      </section>
    </div>
    <WallpaperIntro />
  </AppPage>
</template>

<script setup lang="ts">
import { saveAs } from 'file-saver'
import { markWallpaperMade } from '@/composables/useGetStarted'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { MAX_PASTE_LENGTH } from '@shared/schedule/parseRams'
import WallpaperIntro from '@/components/wallpaper/WallpaperIntro.vue'
import WallpaperControls from '@/components/wallpaper/WallpaperControls.vue'
import WallpaperPreview from '@/components/wallpaper/WallpaperPreview.vue'
import AppPage from '@/components/layout/AppPage.vue'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/composables/useToast'
import { useWallpaper } from '@/composables/useWallpaper'
import { renderToBlob, wallpaperFilename } from '@/lib/wallpaper/render'
import type { RenderInput } from '@/lib/wallpaper/types'

const toast = useToast()
const { text, parsed, layout, theme, size, photo, dim, photoNotice, photoError, hasSchedule, pending, setPhoto, clearPhoto } = useWallpaper()

const photoName = ref<string | null>(null)
/** Phones can fold the pinned preview away to see more of the options. */
const previewOpen = ref(true)

const renderInput = computed<RenderInput>(() => ({
  schedule: parsed.value,
  width: size.value.width,
  height: size.value.height,
  theme: theme.value,
  layout: layout.value,
  photo: photo.value,
  dim: dim.value,
}))

// The paste button only exists where the browser lets a page read the clipboard (iOS does not).
const canReadClipboard = typeof navigator !== 'undefined' && typeof navigator.clipboard?.readText === 'function'

async function pasteFromClipboard() {
  try {
    text.value = (await navigator.clipboard.readText()).slice(0, MAX_PASTE_LENGTH)
  } catch {
    toast.error('Could not read the clipboard. Paste into the box instead.')
  }
}

async function onPhoto(file: File) {
  await setPhoto(file)
  if (!photoError.value) photoName.value = file.name
}

const exporting = ref(false)

// Share needs a fresh tap, and a full-size render can outlast it on a phone, so the png is prepared ahead
// of time (only where Share exists) and used when it still matches the current options.
let prepared: { input: RenderInput; blob: Blob } | null = null
let prepareTimer: ReturnType<typeof setTimeout> | undefined

async function makePng(): Promise<{ blob: Blob; filename: string } | null> {
  const input = renderInput.value
  const filename = wallpaperFilename(parsed.value)
  if (prepared?.input === input) return { blob: prepared.blob, filename }
  try {
    return { blob: await renderToBlob(input), filename }
  } catch {
    toast.error('Could not render the image. Try again.')
    return null
  }
}

async function download() {
  exporting.value = true
  try {
    const png = await makePng()
    if (!png) return
    saveAs(png.blob, png.filename)
    markWallpaperMade()
    toast.success('Downloaded. Set it as your lock screen.')
  } finally {
    exporting.value = false
  }
}

// Offered only where the browser can share a png file (mostly phones); decided once on load.
const canShareFiles = ref(false)

onMounted(() => {
  try {
    const probe = new File([], 'schedule.png', { type: 'image/png' })
    canShareFiles.value = typeof navigator.share === 'function' && navigator.canShare?.({ files: [probe] }) === true
  } catch {
    canShareFiles.value = false
  }
})

watch(renderInput, (input) => {
  clearTimeout(prepareTimer)
  prepared = null
  if (!canShareFiles.value || !hasSchedule.value) return
  prepareTimer = setTimeout(() => {
    renderToBlob(input)
      .then((blob) => { if (renderInput.value === input) prepared = { input, blob } })
      .catch(() => {})
  }, 400)
})
onBeforeUnmount(() => clearTimeout(prepareTimer))

async function share() {
  exporting.value = true
  try {
    const png = await makePng()
    if (!png) return
    await navigator.share({ files: [new File([png.blob], png.filename, { type: 'image/png' })] })
  } catch (err: unknown) {
    // Closing the share sheet is a choice, not an error.
    if (err instanceof DOMException && err.name === 'AbortError') return
    toast.error('Could not share. Try Download instead.')
  } finally {
    exporting.value = false
  }
}

function onClearPhoto() {
  clearPhoto()
  photoName.value = null
}
</script>
