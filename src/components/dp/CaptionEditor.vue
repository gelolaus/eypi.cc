<template>
  <div class="space-y-1.5">
    <div
      class="relative"
      @scroll.capture="syncScroll"
    >
      <!-- Mirror: same text, font and padding as the textarea, so each field's brackets can be highlighted behind it -->
      <div
        data-caption-mirror
        aria-hidden="true"
        class="pointer-events-none absolute inset-0 overflow-hidden rounded-lg border border-transparent px-2.5 py-2 font-mono text-base break-words whitespace-pre-wrap text-transparent [scrollbar-gutter:stable] md:text-sm"
      >
        <div :style="{ transform: `translateY(-${scrollTop}px)` }">
          <template
            v-for="(segment, i) in segments"
            :key="i"
          >
            <mark
              v-if="segment.type === 'field'"
              class="rounded-sm bg-primary/20 underline decoration-primary decoration-2 underline-offset-2"
            >{{ segment.raw }}</mark>
            <template v-else>
              {{ segment.text }}
            </template>
          </template>
          <!-- A trailing newline needs a character after it to take up its line -->
          <span
            v-if="model.endsWith('\n')"
            v-text="ZERO_WIDTH_SPACE"
          />
        </div>
      </div>
      <!-- eslint-disable-next-line vuejs-accessibility/form-control-has-label -- the caller passes id through $attrs and owns the Label -->
      <Textarea
        ref="textareaRef"
        v-model="model"
        v-bind="$attrs"
        :aria-describedby="hintId"
        :aria-invalid="fieldError ? 'true' : undefined"
        class="relative resize-y bg-transparent font-mono [scrollbar-gutter:stable]"
      />
    </div>
    <p
      :id="hintId"
      data-caption-hint
      aria-live="polite"
      class="flex items-start gap-2 rounded-lg border px-3 py-2 text-sm"
      :class="fieldError ? 'border-destructive/30 bg-destructive/10 text-destructive' : 'border-primary/30 bg-primary/10 text-foreground'"
    >
      <Braces
        class="mt-0.5 size-4 shrink-0"
        :class="fieldError ? 'text-destructive' : 'text-primary'"
        aria-hidden="true"
      />
      <span v-if="fieldError">{{ fieldError }}</span>
      <span v-else>Use <code
        class="rounded bg-primary/20 px-1.5 py-0.5 font-mono text-xs font-semibold"
        v-text="'{{Name}}'"
      /> to ask visitors for their details. Up to {{ MAX_CAPTION_FIELDS }} fields.</span>
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { Braces } from 'lucide-vue-next'
import { Textarea } from '@/components/ui/textarea'
import { captionFieldError, MAX_CAPTION_FIELDS, parseCaption } from '@shared/captionFields'

defineOptions({ inheritAttrs: false })

const model = defineModel<string>({ default: '' })
const textareaRef = ref<{ $el: HTMLTextAreaElement } | null>(null)
const scrollTop = ref(0)
const hintId = useId()
const ZERO_WIDTH_SPACE = '​'

const segments = computed(() => parseCaption(model.value))
const fieldError = computed(() => captionFieldError(model.value))

function syncScroll() {
  scrollTop.value = textareaRef.value?.$el.scrollTop ?? 0
}
</script>
