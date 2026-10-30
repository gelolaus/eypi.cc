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
        class="pointer-events-none absolute inset-0 overflow-hidden rounded-lg border border-transparent px-2.5 py-2 font-mono text-base break-words whitespace-pre-wrap text-foreground md:text-sm"
      >
        <div :style="{ transform: `translateY(-${scrollTop}px)` }">
          <template
            v-for="(segment, i) in segments"
            :key="i"
          >
            <mark
              v-if="segment.type === 'field'"
              class="rounded-sm bg-primary/20 text-foreground underline decoration-primary decoration-2 underline-offset-2"
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
        class="relative resize-y bg-transparent font-mono text-transparent caret-foreground"
      />
    </div>
    <p
      class="text-xs"
      :class="fieldError ? 'text-destructive' : 'text-muted-foreground'"
    >
      <template v-if="fieldError">
        {{ fieldError }}
      </template>
      <template v-else>
        Use <code v-text="'{{Name}}'" /> to ask visitors for their details. Up to {{ MAX_CAPTION_FIELDS }} fields.
      </template>
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Textarea } from '@/components/ui/textarea'
import { captionFieldError, MAX_CAPTION_FIELDS, parseCaption } from '@shared/captionFields'

defineOptions({ inheritAttrs: false })

const model = defineModel<string>({ default: '' })
const textareaRef = ref<{ $el: HTMLTextAreaElement } | null>(null)
const scrollTop = ref(0)
const ZERO_WIDTH_SPACE = '​'

const segments = computed(() => parseCaption(model.value))
const fieldError = computed(() => captionFieldError(model.value))

function syncScroll() {
  scrollTop.value = textareaRef.value?.$el.scrollTop ?? 0
}
</script>
