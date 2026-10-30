<template>
  <Dialog
    :open="open"
    @update:open="open = $event"
  >
    <DialogContent
      class="sm:max-w-md"
      @open-auto-focus.prevent="focusFirstEmpty"
    >
      <form
        class="grid gap-4"
        @submit.prevent="submit"
      >
        <DialogHeader>
          <DialogTitle>Add your details</DialogTitle>
          <DialogDescription>
            We will copy your finished caption when you are done. You can still change it in the caption afterwards.
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
              :model-value="answerFor(answers, field.key)"
              :placeholder="field.label"
              maxlength="200"
              @update:model-value="setAnswer(field.key, String($event ?? ''))"
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit">
            Copy caption
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { answerFor, listFields } from '@shared/captionFields'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const props = defineProps<{ template: string }>()
const emit = defineEmits<{ submit: [] }>()
const open = defineModel<boolean>('open', { default: false })
const answers = defineModel<Record<string, string>>('answers', { default: () => ({}) })

const fieldsRef = ref<HTMLElement | null>(null)
const fields = computed(() => listFields(props.template))

function setAnswer(key: string, value: string) {
  answers.value = { ...answers.value, [key]: value }
}

/** Submitting (the button or Enter) hands the answers to the page to copy, then closes. */
function submit() {
  emit('submit')
  open.value = false
}

/** Opens with focus on the first field the visitor has not answered yet. */
function focusFirstEmpty() {
  const index = fields.value.findIndex((field) => !answerFor(answers.value, field.key).trim())
  const inputs = fieldsRef.value?.querySelectorAll('input')
  inputs?.[index === -1 ? 0 : index]?.focus()
}
</script>
