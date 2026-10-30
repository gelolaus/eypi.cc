<template>
  <Dialog
    :open="open"
    @update:open="open = $event"
  >
    <DialogContent class="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>QR code for {{ title }}</DialogTitle>
        <DialogDescription>Anyone who scans this opens the frame page.</DialogDescription>
      </DialogHeader>
      <div class="flex flex-col items-center gap-3">
        <img
          v-if="picture"
          :src="picture"
          :alt="`QR code for ${url}`"
          class="size-56 rounded-xl border border-border bg-white p-2"
        >
        <p
          v-else-if="failed"
          role="alert"
          class="text-sm text-destructive"
        >
          Could not make the QR code.
        </p>
        <div
          v-else
          class="size-56 animate-pulse rounded-xl bg-muted"
          aria-hidden="true"
        />
        <p class="font-mono text-xs break-all text-muted-foreground">
          {{ url }}
        </p>
      </div>
      <DialogFooter>
        <Button
          type="button"
          :disabled="!picture"
          @click="download"
        >
          Download PNG
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { DEFAULT_LINK_QR_CONFIG } from '@shared/linkQrConfig'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/composables/useToast'
import { frameUrl } from '@/lib/frameUrl'
import { downloadLinkQrPng, renderLinkQrCanvas } from '@/utils/renderLinkQr'

const props = defineProps<{ title: string; slug: string }>()
const open = defineModel<boolean>('open', { default: false })
const toast = useToast()

const PREVIEW_SIZE = 512
const EXPORT_SIZE = 1024
const ERROR = 'Could not make the QR code.'

const url = computed(() => frameUrl(props.slug))
const picture = ref('')
const failed = ref(false)

// Drawn when the dialog opens, so closed dialogs on a long list cost nothing.
watch([open, url], async ([isOpen]) => {
  if (!isOpen) return
  picture.value = ''
  failed.value = false
  const wanted = url.value
  try {
    const canvas = await renderLinkQrCanvas(PREVIEW_SIZE, wanted, DEFAULT_LINK_QR_CONFIG, 'white')
    if (wanted === url.value) picture.value = canvas.toDataURL('image/png')
  } catch {
    failed.value = true
  }
}, { immediate: true })

async function download() {
  try {
    await downloadLinkQrPng(EXPORT_SIZE, url.value, DEFAULT_LINK_QR_CONFIG, `eypi-frame-${props.slug}-qr.png`, 'transparent')
  } catch {
    toast.error(ERROR)
  }
}
</script>
