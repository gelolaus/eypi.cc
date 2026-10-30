<template>
  <Dialog
    :open="open"
    @update:open="open = $event"
  >
    <DialogContent
      class="sm:max-w-md"
      @open-auto-focus.prevent="focusFirstEmpty"
    >
      <DialogHeader>
        <DialogTitle>Add your details</DialogTitle>
        <DialogDescription>
          Fill these in and your caption updates below. You can still change it in the caption afterwards.
        </DialogDescription>
      </DialogHeader>
      <div
        ref="fieldsRef"
        class="space-y-3"
      >
        <div
          v-for="(field, i) in fields"
          :key="field.key"
          class="space-y-1.5"
        >
          <Label :for="`caption-field-${i}`">{{ field.label }}</Label>
          <Input
            :id="`caption-field-${i}`"
            :model-value="answers[field.key] ?? ''"
            :placeholder="field.label"
            maxlength="200"
            @update:model-value="setAnswer(field.key, String($event ?? ''))"
          />
        </div>
      </div>
      <p
        data-caption-preview
        class="rounded-lg bg-muted p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground"
        v-text="preview"
      />
      <DialogFooter>
        <Button
          type="button"
          @click="open = false"
        >
          Done
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { fillCaption, listFields } from '@shared/captionFields'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const props = defineProps<{ template: string }>()
const open = defineModel<boolean>('open', { default: false })
const answers = defineModel<Record<string, string>>('answers', { default: () => ({}) })

const fieldsRef = ref<HTMLElement | null>(null)
const fields = computed(() => listFields(props.template))
const preview = computed(() => fillCaption(props.template, answers.value))

function setAnswer(key: string, value: string) {
  answers.value = { ...answers.value, [key]: value }
}

/** Opens with focus on the first field the visitor has not answered yet. */
function focusFirstEmpty() {
  const index = fields.value.findIndex((field) => !answers.value[field.key]?.trim())
  const inputs = fieldsRef.value?.querySelectorAll('input')
  inputs?.[index === -1 ? 0 : index]?.focus()
}
</script>
