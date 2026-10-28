<template>
  <div class="space-y-4">
    <p
      v-if="!questions.length"
      class="text-sm text-muted-foreground"
    >
      No questions. People register with their name and email only.
    </p>

    <ol
      v-if="questions.length"
      class="space-y-4"
    >
      <li
        v-for="(question, index) in questions"
        :key="question.id"
        data-question
        class="space-y-3 rounded-2xl border border-border p-4"
      >
        <div class="flex items-center justify-between gap-3">
          <h3 class="text-base font-semibold">
            Question {{ index + 1 }}
          </h3>
          <Button
            type="button"
            variant="outline"
            data-remove-question
            :aria-label="`Remove question ${index + 1}`"
            @click="remove(index)"
          >
            Remove
          </Button>
        </div>

        <div class="space-y-1.5">
          <Label :for="`q-label-${question.id}`">Label</Label>
          <Input
            :id="`q-label-${question.id}`"
            v-model="question.label"
            type="text"
            data-question-label
            placeholder="e.g. Student ID"
          />
        </div>

        <div class="space-y-1.5">
          <Label :for="`q-type-${question.id}`">Answer type</Label>
          <select
            :id="`q-type-${question.id}`"
            v-model="question.type"
            data-question-type
            :class="selectClass"
          >
            <option value="text">
              Short text
            </option>
            <option value="choice">
              Pick one
            </option>
            <option value="checkbox">
              Pick several
            </option>
          </select>
        </div>

        <div
          v-if="question.type !== 'text'"
          class="space-y-1.5"
        >
          <Label :for="`q-options-${question.id}`">Options, one per line</Label>
          <Textarea
            :id="`q-options-${question.id}`"
            :model-value="question.options.join('\n')"
            data-question-options
            rows="3"
            @update:model-value="(v: string | number | undefined) => (question.options = String(v ?? '').split('\n'))"
          />
        </div>

        <div class="flex min-h-11 items-center gap-3">
          <Switch
            :id="`q-required-${question.id}`"
            :model-value="question.required"
            @update:model-value="(v: boolean | 'indeterminate') => (question.required = v === true)"
          />
          <Label :for="`q-required-${question.id}`">Required</Label>
        </div>
      </li>
    </ol>

    <div class="flex flex-wrap items-center gap-3">
      <Button
        type="button"
        variant="outline"
        data-add-question
        :disabled="questions.length >= QUESTIONS_MAX"
        @click="add"
      >
        Add question
      </Button>
      <p class="text-sm text-muted-foreground">
        {{ questions.length }} of {{ QUESTIONS_MAX }} questions
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { QUESTIONS_MAX, newQuestion, type QuestionDraft } from '@/lib/tix/eventForm'

const questions = defineModel<QuestionDraft[]>({ required: true })

const selectClass = 'h-11 w-full min-w-0 rounded-xl border border-input bg-transparent px-3.5 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 [&>option]:bg-popover [&>option]:text-popover-foreground'

function add() {
  if (questions.value.length >= QUESTIONS_MAX) return
  questions.value = [...questions.value, newQuestion()]
}

function remove(index: number) {
  questions.value = questions.value.filter((_, i) => i !== index)
}
</script>
