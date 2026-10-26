<template>
  <Card class="gap-0 rounded-3xl p-5 sm:p-8">
    <h2 class="mb-1 font-heading text-xl font-semibold tracking-tight text-foreground">
      Upload Spreadsheet
    </h2>
    <p class="mb-6 font-mono text-xs text-muted-foreground">
      Upload your respondents spreadsheet (.xlsx). Any column layout is accepted — you'll map the columns next.
    </p>

    <!-- eslint-disable-next-line vuejs-accessibility/no-static-element-interactions -- file drop target; keyboard users use Browse -->
    <div
      class="flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-10 text-center transition-colors"
      :class="fileName
        ? 'border-primary bg-primary/10'
        : 'border-border hover:border-ring'"
      @dragover.prevent
      @drop.prevent="onDrop"
    >
      <p
        v-if="fileName"
        class="text-sm font-medium text-primary"
      >
        {{ fileName }} — {{ rowCount }} rows, {{ columnCount }} columns
      </p>
      <template v-else>
        <p class="text-sm text-muted-foreground">
          Drop .xlsx or click to upload
        </p>
      </template>
      <input
        ref="fileInput"
        type="file"
        accept=".xlsx,.XLSX"
        class="hidden"
        aria-hidden="true"
        tabindex="-1"
        @change="onFileChange"
      >
      <Button
        type="button"
        variant="outline"
        class="mt-3"
        @click="fileInput?.click()"
      >
        {{ fileName ? 'Change file' : 'Browse' }}
      </Button>
    </div>
    <p
      v-if="error"
      class="mt-2 text-xs font-medium text-destructive"
    >
      {{ error }}
    </p>

    <Button
      type="button"
      size="lg"
      class="mt-6 w-full"
      :disabled="!fileName || !rowCount || uploading"
      @click="emit('upload')"
    >
      {{ uploading ? 'Uploading…' : 'Upload Spreadsheet & Continue →' }}
    </Button>
  </Card>
</template>

<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ref } from 'vue'

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
