<template>
  <div
    data-empty-state
    class="flex flex-col items-center justify-center px-4 py-10 text-center"
  >
    <div class="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
      <slot name="icon">
        <Inbox
          class="size-7"
          aria-hidden="true"
        />
      </slot>
    </div>
    <p class="mt-4 text-base font-semibold text-foreground">
      {{ title }}
    </p>
    <p
      v-if="body"
      class="mt-1 max-w-md text-base leading-relaxed text-muted-foreground"
    >
      {{ body }}
    </p>
    <template v-if="action">
      <Button
        v-if="action.onClick"
        type="button"
        class="mt-5"
        @click="action.onClick"
      >
        {{ action.label }}
      </Button>
      <Button
        v-else-if="action.to && isExternal"
        as-child
        class="mt-5"
      >
        <a
          :href="action.to"
          target="_blank"
          rel="noopener noreferrer"
        >{{ action.label }}</a>
      </Button>
      <Button
        v-else-if="action.to"
        as-child
        class="mt-5"
      >
        <router-link :to="action.to">
          {{ action.label }}
        </router-link>
      </Button>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Inbox } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'

const props = defineProps<{
  title: string
  body?: string
  action?: { label: string; to?: string; onClick?: () => void } | null
}>()

const isExternal = computed(() => /^https?:\/\//i.test(props.action?.to ?? ''))
</script>
