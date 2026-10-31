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
        class="grid grid-cols-1 gap-4"
        @submit.prevent="submit"
      >
        <DialogHeader>
          <DialogTitle>Add your details</DialogTitle>
          <DialogDescription>
            {{ preview ? 'This is what visitors see. Nothing is copied or saved.' : 'We will copy your finished caption when you are done. You can still change it in the caption afterwards.' }}
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
            <Label :for="`caption-field-${i}`">
              {{ field.label }}<span
                v-if="field.optional"
                class="font-normal text-muted-foreground"
              > (optional)</span>
            </Label>
            <Input
              :id="`caption-field-${i}`"
              :model-value="answerFor(answers, field.key)"
              :placeholder="field.label"
              :aria-required="field.optional ? undefined : 'true'"
              :aria-invalid="flagged.has(field.key) ? 'true' : undefined"
              :aria-describedby="flagged.has(field.key) ? `caption-field-${i}-error` : undefined"
              maxlength="200"
              @update:model-value="setAnswer(field.key, String($event ?? ''))"
            />
            <p
              v-if="flagged.has(field.key)"
              :id="`caption-field-${i}-error`"
              role="alert"
              class="text-sm text-destructive"
            >
              {{ field.label }} is required.
            </p>
          </div>
        </div>
        <p
          v-if="preview"
          data-caption-result
          class="rounded-lg bg-muted p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground"
          v-text="result"
        />
        <DialogFooter>
          <Button type="submit">
            {{ preview ? 'Done' : 'Copy caption' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { answerFor, fillCaption, listFields, missingRequired } from '@shared/captionFields'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/** `preview` is the owner's trial run: it shows the filled caption and the button only closes. */
const props = defineProps<{ template: string; preview?: boolean }>()
const emit = defineEmits<{ submit: [] }>()
const open = defineModel<boolean>('open', { default: false })
const answers = defineModel<Record<string, string>>('answers', { default: () => ({}) })

const fieldsRef = ref<HTMLElement | null>(null)
const fields = computed(() => listFields(props.template))
const result = computed(() => fillCaption(props.template, answers.value))

function setAnswer(key: string, value: string) {
  answers.value = { ...answers.value, [key]: value }
}

// Required fields are only flagged after a failed submit, and unflag as soon as they are answered.
const attempted = ref(false)
const flagged = computed(() => new Set(attempted.value && !props.preview ? missingRequired(props.template, answers.value).map((field) => field.key) : []))
watch(open, (isOpen) => { if (isOpen) attempted.value = false })

/** Submitting (the button or Enter) hands the answers to the page to copy, then closes. A missing required field stops it. */
function submit() {
  if (!props.preview) {
    attempted.value = true
    const missing = missingRequired(props.template, answers.value)
    if (missing.length) {
      const index = fields.value.findIndex((field) => field.key === missing[0]!.key)
      fieldsRef.value?.querySelectorAll('input')[index]?.focus()
      return
    }
  }
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
