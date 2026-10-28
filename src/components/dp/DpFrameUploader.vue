<template>
  <div>
    <!-- Thumbnail strip -->
    <p
      v-if="frames.length > 1"
      class="mb-2 text-sm font-medium text-muted-foreground"
    >
      Drag to reorder or use the arrows
    </p>
    <div
      v-if="frames.length"
      class="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4"
    >
      <!-- eslint-disable-next-line vuejs-accessibility/no-static-element-interactions -- pointer drag reorder; remove stays a button -->
      <div
        v-for="(frame, i) in frames"
        :key="frame.id ?? i"
        class="group relative cursor-move rounded-xl transition-opacity"
        :class="[
          dragIndex === i ? 'opacity-40' : '',
          overIndex === i && dragIndex !== null && dragIndex !== i ? 'ring-2 ring-ring ring-offset-2 ring-offset-background' : '',
        ]"
        draggable="true"
        @dragstart="onDragStart(i, $event)"
        @dragenter.prevent="overIndex = i"
        @dragover.prevent
        @drop.prevent="onDropThumb(i)"
        @dragend="onDragEnd"
      >
        <div class="overflow-hidden rounded-xl border border-border bg-muted bg-dot-grid">
          <AppImage
            :src="frame.src"
            :meta="frame.meta"
            sizes="(min-width: 768px) 25vw, (min-width: 640px) 33vw, 50vw"
            alt=""
            draggable="false"
            class="block aspect-square w-full object-contain"
          />
        </div>
        <span class="pointer-events-none absolute left-1.5 top-1.5 rounded-md bg-background/80 px-1.5 py-0.5 font-mono text-xs font-bold text-foreground">{{ i + 1 }}</span>
        <span
          class="pointer-events-none absolute left-1.5 top-9 hidden items-center rounded-md bg-background/70 px-1 py-1 text-foreground sm:flex"
          aria-hidden="true"
        >
          <svg
            class="h-3 w-3"
            fill="currentColor"
            viewBox="0 0 24 24"
          ><circle
            cx="9"
            cy="6"
            r="1.5"
          /><circle
            cx="15"
            cy="6"
            r="1.5"
          /><circle
            cx="9"
            cy="12"
            r="1.5"
          /><circle
            cx="15"
            cy="12"
            r="1.5"
          /><circle
            cx="9"
            cy="18"
            r="1.5"
          /><circle
            cx="15"
            cy="18"
            r="1.5"
          /></svg>
        </span>
        <div class="mt-1 flex items-center justify-between gap-1">
          <Button
            type="button"
            variant="outline"
            class="min-w-11 px-2 font-mono text-xs font-bold"
            :disabled="i === 0"
            aria-label="Move up"
            @click.stop="$emit('reorder', i, i - 1)"
          >
            Up
          </Button>
          <Button
            type="button"
            variant="outline"
            class="min-w-11 px-2 font-mono text-xs font-bold"
            :disabled="i === frames.length - 1"
            aria-label="Move down"
            @click.stop="$emit('reorder', i, i + 1)"
          >
            Down
          </Button>
          <Button
            type="button"
            variant="destructive"
            class="min-w-11 px-2 font-mono text-lg leading-none"
            :disabled="busyIndex === i"
            aria-label="Remove frame"
            @click="$emit('remove', i)"
          >
            {{ busyIndex === i ? '…' : '×' }}
          </Button>
        </div>
      </div>
    </div>

    <!-- Add drop-zone (hidden once at the cap) -->
    <div
      v-if="frames.length < max"
      class="relative flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-dot-grid p-5 text-center outline-none transition-colors hover:border-ring focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      :class="dragging ? 'border-ring ring-3 ring-ring/50' : ''"
      :data-dragging="dragging ? 'true' : 'false'"
      role="button"
      tabindex="0"
      aria-label="Add PNG frames"
      :aria-invalid="Boolean(uploadError)"
      :aria-describedby="uploadError ? 'frame-upload-error' : undefined"
      @click="fileInput?.click()"
      @keydown.enter.prevent="fileInput?.click()"
      @keydown.space.prevent="fileInput?.click()"
      @dragover.prevent="dragging = true"
      @dragleave.prevent="dragging = false"
      @drop.prevent="onDrop"
    >
      <input
        ref="fileInput"
        type="file"
        accept="image/png, image/x-png, .png"
        multiple
        class="hidden"
        aria-hidden="true"
        tabindex="-1"
        @change="onPicked"
      >
      <div class="mb-2 flex size-10 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground">
        <svg
          class="h-5 w-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        ><path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 4v16m8-8H4"
        /></svg>
      </div>
      <p class="text-sm font-medium text-foreground">
        {{ frames.length ? 'Add another frame' : 'Drop your PNG frame(s) here' }}
      </p>
      <p class="mt-1 text-xs text-muted-foreground">
        transparent PNG, up to 10 MB
      </p>
    </div>

    <p
      v-if="uploadError"
      id="frame-upload-error"
      role="alert"
      class="mt-2 text-sm text-destructive"
    >
      {{ uploadError }}
    </p>
    <p class="mt-2 text-right font-mono text-xs text-muted-foreground">
      {{ frames.length }} / {{ max }} frames
    </p>
  </div>
</template>

<script setup lang="ts">
import { getCurrentInstance, ref } from 'vue'
import AppImage from '@/components/AppImage.vue'
import { Button } from '@/components/ui/button'
import { useToast } from '@/composables/useToast'
import { DP_MAX_FRAMES, DP_FRAME_MAX_BYTES, type DpUploaderFrame } from '@/types/dp'

const props = defineProps<{
  frames: DpUploaderFrame[]
  /** Index currently being persisted/removed (shows a spinner, disables its button). */
  busyIndex?: number | null
  max?: number
}>()

const emit = defineEmits<{
  /** Emitted with a fresh PNG data-URL for each accepted file. */
  (e: 'add', dataUrl: string, file?: File): void
  (e: 'remove', index: number): void
  /** Emitted when a frame is dragged from one position to another. */
  (e: 'reorder', from: number, to: number): void
}>()

const toast = useToast()
const instance = getCurrentInstance()
const fileInput = ref<HTMLInputElement | null>(null)
let addQueue: Promise<void> = Promise.resolve()
const dragging = ref(false)
const uploadError = ref('')
const max = props.max ?? DP_MAX_FRAMES

// Drag-to-reorder state (thumbnail-to-thumbnail; distinct from file drops).
const dragIndex = ref<number | null>(null)
const overIndex = ref<number | null>(null)

function onDragStart(i: number, e: DragEvent) {
  dragIndex.value = i
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(i)) // some browsers require data to drag
  }
}
function onDropThumb(i: number) {
  const from = dragIndex.value
  if (from !== null && from !== i) emit('reorder', from, i)
  dragIndex.value = null
  overIndex.value = null
}
function onDragEnd() {
  dragIndex.value = null
  overIndex.value = null
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('read'))
    reader.readAsDataURL(file)
  })
}

async function emitAdd(dataUrl: string, file: File) {
  const raw = instance?.vnode.props?.onAdd as
    | ((value: string, file?: File) => unknown)
    | Array<(value: string, file?: File) => unknown>
    | undefined
  const handlers = Array.isArray(raw) ? raw : raw ? [raw] : []
  if (handlers.length === 0) {
    emit('add', dataUrl, file)
    return
  }
  await Promise.all(handlers.map((handler) => handler(dataUrl, file)))
}

async function addSerial(list: File[]) {
  uploadError.value = ''
  for (const file of list) {
    if (props.frames.length >= max) {
      uploadError.value = `Remove a frame before adding more. The limit is ${max}.`
      break
    }
    const fileType = file.type.toLowerCase()
    const isPng = fileType === 'image/png' || fileType === 'image/x-png' || (!fileType && file.name.toLowerCase().endsWith('.png'))
    if (!isPng) {
      uploadError.value = `Choose a transparent PNG instead of "${file.name}".`
      continue
    }
    if (file.size > DP_FRAME_MAX_BYTES) {
      uploadError.value = `Choose a file under 10 MB instead of "${file.name}".`
      continue
    }
    try {
      const dataUrl = await readFile(file)
      await emitAdd(dataUrl, file)
    } catch {
      toast.error(`Could not read "${file.name}".`)
    }
  }
}

function readFiles(files: FileList | File[]) {
  const list = Array.from(files)
  addQueue = addQueue.then(() => addSerial(list)).catch(() => {})
}

function onPicked(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files?.length) readFiles(input.files)
  input.value = '' // allow re-selecting the same file
}

function onDrop(e: DragEvent) {
  dragging.value = false
  if (e.dataTransfer?.files?.length) readFiles(e.dataTransfer.files)
}
</script>

