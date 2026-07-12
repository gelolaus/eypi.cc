<template>
  <div>
    <!-- Thumbnail strip -->
    <p v-if="frames.length > 1" class="mb-2 text-xs font-medium text-gray-400 dark:text-slate-500">Drag to reorder</p>
    <div v-if="frames.length" class="mb-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
      <div
        v-for="(frame, i) in frames"
        :key="frame.id ?? i"
        class="group relative cursor-move rounded-xl transition-opacity"
        :class="[
          dragIndex === i ? 'opacity-40' : '',
          overIndex === i && dragIndex !== null && dragIndex !== i ? 'ring-2 ring-[#DEAC4B] ring-offset-2 ring-offset-transparent' : '',
        ]"
        draggable="true"
        @dragstart="onDragStart(i, $event)"
        @dragenter.prevent="overIndex = i"
        @dragover.prevent
        @drop.prevent="onDropThumb(i)"
        @dragend="onDragEnd"
      >
        <div class="dp-checker overflow-hidden rounded-xl border border-gray-200 dark:border-slate-700">
          <img :src="frame.src" alt="" draggable="false" class="block aspect-square w-full object-contain" />
        </div>
        <span class="pointer-events-none absolute left-1.5 top-1.5 rounded-md bg-black/60 px-1.5 py-0.5 font-mono text-[0.6rem] font-bold text-white">{{ i + 1 }}</span>
        <span class="pointer-events-none absolute bottom-1.5 left-1.5 flex items-center rounded-md bg-black/50 px-1 py-1 text-white" aria-hidden="true">
          <svg class="h-3 w-3" fill="currentColor" viewBox="0 0 24 24"><circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" /><circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" /><circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" /></svg>
        </span>
        <button
          type="button"
          :disabled="busyIndex === i"
          class="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 font-mono text-sm leading-none text-white transition-colors hover:bg-red-500 disabled:opacity-50"
          aria-label="Remove frame"
          @click="$emit('remove', i)"
        >{{ busyIndex === i ? '…' : '×' }}</button>
      </div>
    </div>

    <!-- Add drop-zone (hidden once at the cap) -->
    <div
      v-if="frames.length < max"
      class="dp-dropzone relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-5 text-center transition-colors"
      :class="dragging ? 'dp-dropzone--active' : ''"
      :aria-invalid="Boolean(uploadError)"
      :aria-describedby="uploadError ? 'frame-upload-error' : undefined"
      @click="fileInput?.click()"
      @dragover.prevent="dragging = true"
      @dragleave.prevent="dragging = false"
      @drop.prevent="onDrop"
    >
      <input ref="fileInput" type="file" accept="image/png, image/x-png, .png" multiple class="hidden" @change="onPicked" />
      <div class="mb-2 flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-gray-300 text-gray-400 dark:border-slate-600 dark:text-slate-500">
        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
      </div>
      <p class="text-sm font-medium text-gray-500 dark:text-slate-400">{{ frames.length ? 'Add another frame' : 'Drop your PNG frame(s) here' }}</p>
      <p class="mt-1 text-xs text-gray-400 dark:text-slate-500">transparent PNG · ≤2 MB each</p>
    </div>

    <p v-if="uploadError" id="frame-upload-error" class="mt-2 text-sm text-red-500">{{ uploadError }}</p>
    <p class="text-data mt-2 text-right text-xs text-gray-400 dark:text-slate-500">{{ frames.length }} / {{ max }} frames</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
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
  (e: 'add', dataUrl: string): void
  (e: 'remove', index: number): void
  /** Emitted when a frame is dragged from one position to another. */
  (e: 'reorder', from: number, to: number): void
}>()

const toast = useToast()
const fileInput = ref<HTMLInputElement | null>(null)
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

function readFiles(files: FileList | File[]) {
  uploadError.value = ''
  const list = Array.from(files)
  let remaining = max - props.frames.length
  for (const file of list) {
    if (remaining <= 0) { uploadError.value = `Remove a frame before adding more. The limit is ${max}.`; break }
    const fileType = file.type.toLowerCase()
    const isPng = fileType === 'image/png' || fileType === 'image/x-png' || (!fileType && file.name.toLowerCase().endsWith('.png'))
    if (!isPng) {
      uploadError.value = `Choose a transparent PNG instead of "${file.name}".`
      continue
    }
    if (file.size > DP_FRAME_MAX_BYTES) { uploadError.value = `Choose a file under 2 MB instead of "${file.name}".`; continue }
    remaining--
    const reader = new FileReader()
    reader.onload = () => emit('add', reader.result as string)
    reader.onerror = () => toast.error(`Could not read "${file.name}".`)
    reader.readAsDataURL(file)
  }
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

<style scoped>
.dp-dropzone { border-color: var(--color-border); cursor: pointer; }
.dp-dropzone:hover,
.dp-dropzone--active { border-color: #DEAC4B; }
.dp-checker {
  background-color: #ffffff;
  background-image:
    linear-gradient(45deg, #e9e9e9 25%, transparent 25%),
    linear-gradient(-45deg, #e9e9e9 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #e9e9e9 75%),
    linear-gradient(-45deg, transparent 75%, #e9e9e9 75%);
  background-size: 16px 16px;
  background-position: 0 0, 0 8px, 8px -8px, -8px 0;
}
:global(html.dark) .dp-checker {
  background-color: #0d0d0d;
  background-image:
    linear-gradient(45deg, #1c1c1c 25%, transparent 25%),
    linear-gradient(-45deg, #1c1c1c 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #1c1c1c 75%),
    linear-gradient(-45deg, transparent 75%, #1c1c1c 75%);
}
</style>
