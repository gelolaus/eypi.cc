<script setup lang="ts">
import { computed, toRef } from 'vue'
import { Check } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useGetStarted } from '@/composables/useGetStarted'

const props = defineProps<{
  linkCount: number | null
  pendingInvites: number
}>()

const linkCount = toRef(props, 'linkCount')
const pendingInvites = toRef(props, 'pendingInvites')
const { steps, visible, dismiss } = useGetStarted({ linkCount, pendingInvites })

const doneCount = computed(() => steps.value.filter((s) => s.done).length)
</script>

<template>
  <Card
    v-if="visible"
    data-get-started
    class="space-y-4 p-5"
  >
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 class="text-base font-semibold text-foreground">
          Get started
        </h3>
        <p class="text-base text-muted-foreground">
          {{ doneCount }} of {{ steps.length }} done
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        class="min-h-11"
        @click="dismiss"
      >
        Dismiss
      </Button>
    </div>
    <ul class="space-y-2">
      <li
        v-for="step in steps"
        :key="step.id"
      >
        <router-link
          :to="step.to"
          class="flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-base text-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Check
            class="size-5 shrink-0"
            :class="step.done ? 'text-primary' : 'text-muted-foreground/40'"
            aria-hidden="true"
          />
          <span>{{ step.label }}</span>
          <span class="sr-only">{{ step.done ? 'done' : 'to do' }}</span>
        </router-link>
      </li>
    </ul>
  </Card>
</template>