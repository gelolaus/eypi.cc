<template>
  <Dialog
    :open="open"
    @update:open="open = $event"
  >
    <DialogContent class="sm:max-w-md">
      <form
        class="grid grid-cols-1 gap-4"
        @submit.prevent="submit"
      >
        <DialogHeader>
          <DialogTitle>Get your photo by email</DialogTitle>
          <DialogDescription>
            Enter your email and we will send your photo to it. We do not store your email.
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-1.5">
          <Label for="preview-email">Email</Label>
          <Input
            id="preview-email"
            v-model="email"
            type="email"
            autocomplete="email"
            placeholder="you@example.com"
            maxlength="200"
            aria-required="true"
            :aria-invalid="invalid ? 'true' : undefined"
            :aria-describedby="invalid ? 'preview-email-error' : undefined"
          />
          <p
            v-if="invalid"
            id="preview-email-error"
            role="alert"
            class="text-sm text-destructive"
          >
            Enter a valid email address.
          </p>
        </div>
        <DialogFooter>
          <Button type="submit">
            Download
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const emit = defineEmits<{ submit: [email: string] }>()
const open = defineModel<boolean>('open', { default: false })

const email = ref('')
const invalid = ref(false)
watch(open, (isOpen) => { if (isOpen) invalid.value = false })

function submit() {
  const value = email.value.trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) { invalid.value = true; return }
  emit('submit', value)
  open.value = false
}
</script>
