<template>
  <p class="whitespace-pre-wrap font-mono text-sm leading-relaxed text-muted-foreground">
    <template
      v-for="(segment, i) in segments"
      :key="i"
    >
      <input
        v-if="segment.type === 'field'"
        type="text"
        :value="answerFor(answers, segment.key)"
        :placeholder="nameOf(segment.key, segment.label)"
        :aria-label="nameOf(segment.key, segment.label)"
        :aria-required="isOptional(segment.key) ? undefined : 'true'"
        :style="{ minWidth: `${Math.max(nameOf(segment.key, segment.label).length, 4)}ch` }"
        maxlength="200"
        class="mx-0.5 inline-block rounded-md border border-input bg-background px-1.5 py-0.5 font-mono text-base text-foreground field-sizing-content md:text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        @input="setAnswer(segment.key, ($event.target as HTMLInputElement).value)"
      >
      <span
        v-else
        v-text="segment.text"
      />
    </template>
  </p>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { answerFor, listFields, parseCaption } from '@shared/captionFields'

const props = defineProps<{ template: string }>()
const answers = defineModel<Record<string, string>>('answers', { default: () => ({}) })

const segments = computed(() => parseCaption(props.template))
// A label is optional only when every occurrence is, so look it up from the merged field list.
const optionalKeys = computed(() => new Set(listFields(props.template).filter((field) => field.optional).map((field) => field.key)))

const isOptional = (key: string) => optionalKeys.value.has(key)
const nameOf = (key: string, label: string) => (isOptional(key) ? `${label} (optional)` : label)

function setAnswer(key: string, value: string) {
  answers.value = { ...answers.value, [key]: value }
}
</script>
