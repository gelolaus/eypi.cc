<script setup lang="ts">
import { Button } from '@/components/ui/button'
import EmptyState from '@/components/EmptyState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'

defineProps<{
  status: 'loading' | 'error' | 'empty' | 'ready'
  title: string
  emptyBody?: string
  action?: { label: string; to: string }
}>()
defineEmits<{ retry: [] }>()
</script>

<template>
  <div>
    <div
      v-if="status === 'loading'"
      role="status"
      aria-busy="true"
      class="space-y-3"
    >
      <span class="sr-only">Loading {{ title }}</span>
      <Skeleton
        :h="120"
        :radius="16"
      />
    </div>
    <div
      v-else-if="status === 'error'"
      class="flex flex-col items-start gap-3 rounded-2xl border border-border bg-muted/40 p-4"
      role="alert"
    >
      <p class="text-base text-muted-foreground">
        {{ title }} couldn't load. Try again.
      </p>
      <Button
        type="button"
        variant="outline"
        class="min-h-11"
        @click="$emit('retry')"
      >
        Retry
      </Button>
    </div>
    <EmptyState
      v-else-if="status === 'empty'"
      :title="title"
      :body="emptyBody"
      :action="action ?? null"
    />
    <slot v-else-if="status === 'ready'" />
  </div>
</template>