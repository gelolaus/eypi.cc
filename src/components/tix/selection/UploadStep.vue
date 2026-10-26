<template>
  <div class="mica-card relative rounded-3xl border border-gray-200 p-5 sm:p-8 dark:border-slate-600">
    <PageShell />

    <h2 class="mb-1 text-sm font-semibold text-[#34418F] dark:text-slate-300">Upload Spreadsheet</h2>
    <p class="mb-6 font-mono text-xs text-gray-500 dark:text-slate-400">Upload your respondents spreadsheet (.xlsx). Any column layout is accepted — you'll map the columns next.</p>

    <!-- eslint-disable-next-line vuejs-accessibility/no-static-element-interactions -- file drop target; keyboard users use Browse -->
    <div
      class="flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-10 text-center transition-colors"
      :class="fileName
        ? 'border-emerald-400 bg-emerald-50/50 dark:border-emerald-600 dark:bg-emerald-900/10'
        : 'border-gray-300 bg-white/40 hover:border-[#34418F] dark:border-slate-600 dark:bg-mica-navy-input dark:hover:border-slate-500'"
      @dragover.prevent
      @drop.prevent="onDrop"
    >
      <p v-if="fileName" class="text-sm font-medium text-emerald-600 dark:text-emerald-400">
        {{ fileName }} — {{ rowCount }} rows, {{ columnCount }} columns
      </p>
      <template v-else>
        <p class="text-sm text-gray-500 dark:text-slate-400">Drop .xlsx or click to upload</p>
      </template>
      <input ref="fileInput" type="file" accept=".xlsx,.XLSX" class="hidden" aria-hidden="true" tabindex="-1" @change="onFileChange" />
      <button
        type="button"
        class="btn-secondary mt-3"
        @click="fileInput?.click()"
      >
        {{ fileName ? 'Change file' : 'Browse' }}
      </button>
    </div>
    <p v-if="error" class="mt-2 text-xs font-medium text-red-500">{{ error }}</p>

    <button
      type="button"
      :disabled="!fileName || !rowCount || uploading"
      :class="[
        'mt-6 min-h-11 w-full rounded-xl bg-[#34418F] px-4 text-base font-semibold text-white transition-all duration-200 dark:bg-slate-700',
        (!fileName || !rowCount || uploading) ? 'cursor-not-allowed opacity-50' : 'hover:-translate-y-0.5 hover:brightness-110',
      ]"
      @click="emit('upload')"
    >
      {{ uploading ? 'Uploading…' : 'Upload Spreadsheet & Continue →' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import PageShell from '@/components/PageShell.vue'

defineProps<{
  fileName: string
  rowCount: number
  columnCount: number
  error: string
  uploading: boolean
}>()

const emit = defineEmits<{
  file: [file: File]
  upload: []
}>()

const fileInput = ref<HTMLInputElement | null>(null)

function onDrop(event: DragEvent) {
  const file = event.dataTransfer?.files[0]
  if (file) emit('file', file)
}

function onFileChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) emit('file', file)
}
</script>
