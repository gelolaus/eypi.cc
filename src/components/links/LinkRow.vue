<template>
  <Card class="min-w-0 flex-col gap-3 p-4 md:flex-row md:items-center md:gap-4">
    <label
      data-select-hit
      class="flex size-11 shrink-0 cursor-pointer items-center justify-center"
    >
      <input
        class="size-5 rounded accent-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        type="checkbox"
        :aria-label="`Select ${link.slug}`"
        :checked="selected"
        @change="onToggle"
      >
    </label>
    <div class="min-w-0 flex-1">
      <div class="flex min-w-0 flex-wrap items-center gap-2">
        <span class="min-w-0 max-w-full truncate font-mono text-base font-semibold text-foreground">
          eypi.cc/{{ link.slug }}
        </span>
        <Badge
          v-for="badge in badges"
          :key="badge"
          variant="outline"
        >
          {{ badge }}
        </Badge>
      </div>
      <p
        class="truncate font-mono text-sm text-muted-foreground"
        :title="link.url"
      >
        {{ host }}
      </p>
      <p class="mt-1 text-sm text-muted-foreground">
        {{ link.clicks }} clicks
        <span v-if="created"> · {{ created }}</span>
      </p>
    </div>
    <div
      data-row-actions
      class="flex shrink-0 flex-wrap items-center gap-1"
    >
      <Button
        aria-label="Copy link"
        size="icon"
        variant="ghost"
        type="button"
        @click="emit('copy')"
      >
        <Copy />
      </Button>
      <Button
        aria-label="Analytics"
        size="icon"
        variant="ghost"
        type="button"
        @click="emit('analytics')"
      >
        <BarChart3 />
      </Button>
      <Button
        aria-label="Edit"
        size="icon"
        variant="ghost"
        type="button"
        @click="emit('edit')"
      >
        <Pencil />
      </Button>
      <Button
        v-if="!moderatorLocked"
        class="hidden md:inline-flex"
        size="icon"
        variant="ghost"
        type="button"
        :aria-label="link.disabledAt ? `Enable ${link.slug}` : `Disable ${link.slug}`"
        @click="link.disabledAt ? emit('enable') : emit('disable')"
      >
        <Play v-if="link.disabledAt" />
        <Pause v-else />
      </Button>
      <Button
        class="hidden md:inline-flex"
        aria-label="Delete"
        size="icon"
        variant="destructive"
        type="button"
        @click="emit('delete')"
      >
        <Trash2 />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button
            class="md:hidden"
            :aria-label="`More actions for ${link.slug}`"
            size="icon"
            variant="ghost"
            type="button"
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          class="min-w-44 p-1"
        >
          <DropdownMenuItem
            v-if="!moderatorLocked"
            class="min-h-11 rounded-lg px-3 text-base"
            @select="link.disabledAt ? emit('enable') : emit('disable')"
          >
            <Play
              v-if="link.disabledAt"
              aria-hidden="true"
            />
            <Pause
              v-else
              aria-hidden="true"
            />
            {{ link.disabledAt ? 'Enable' : 'Disable' }}
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            class="min-h-11 rounded-lg px-3 text-base"
            @select="emit('delete')"
          >
            <Trash2 aria-hidden="true" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </Card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { BarChart3, Copy, MoreHorizontal, Pause, Pencil, Play, Trash2 } from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { linkBadges, type LinkListItem } from '@/composables/useLinks'

const props = defineProps<{
  link: LinkListItem
  selected: boolean
}>()

const emit = defineEmits<{
  toggle: [checked: boolean]
  copy: []
  analytics: []
  edit: []
  delete: []
  disable: []
  enable: []
}>()

const badges = computed(() => linkBadges(props.link))
const moderatorLocked = computed(() =>
  props.link.disabledReason === 'admin' || props.link.disabledReason === 'abuse',
)

const host = computed(() => {
  try {
    return new URL(props.link.url).host
  } catch {
    return props.link.url
  }
})

const created = computed(() => {
  if (!props.link.createdAt) return ''
  const date = new Date(props.link.createdAt)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
})

function onToggle(event: Event) {
  const target = event.target
  if (!(target instanceof HTMLInputElement)) return
  emit('toggle', target.checked)
}
</script>
