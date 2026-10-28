<template>
  <Dialog
    :open="open"
    @update:open="emit('update:open', $event)"
  >
    <DialogContent
      :show-close-button="false"
      class="top-[15%] max-w-lg translate-y-0 gap-0 overflow-hidden p-0"
      @open-auto-focus="onOpenAutoFocus"
    >
      <DialogTitle class="sr-only">
        Search and jump
      </DialogTitle>
      <DialogDescription class="sr-only">
        Type to filter commands. Use the arrow keys to choose one and Enter to run it.
      </DialogDescription>

      <div class="flex items-center gap-2 border-b border-border px-3">
        <Search
          class="size-5 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          id="command-palette-input"
          ref="inputRef"
          v-model="query"
          type="text"
          role="combobox"
          aria-label="Search and jump"
          aria-autocomplete="list"
          aria-expanded="true"
          :aria-controls="listId"
          :aria-activedescendant="active ? optionId(activeIndex) : undefined"
          placeholder="Search and jump"
          autocomplete="off"
          spellcheck="false"
          class="h-11 w-full min-w-0 rounded-lg border border-transparent bg-transparent px-2 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          @keydown="onKeydown"
        >
      </div>

      <div
        :id="listId"
        role="listbox"
        aria-label="Commands"
        class="max-h-[min(60vh,20rem)] overflow-y-auto p-2"
      >
        <div
          v-for="group in grouped"
          :key="group.name"
          role="group"
          :aria-label="group.name"
        >
          <p
            class="px-2 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground"
            aria-hidden="true"
          >
            {{ group.name }}
          </p>
          <button
            v-for="entry in group.items"
            :id="optionId(entry.index)"
            :key="entry.command.id"
            type="button"
            role="option"
            tabindex="-1"
            :aria-selected="entry.index === activeIndex"
            class="flex min-h-11 w-full items-center rounded-lg px-3 text-left text-base"
            :class="entry.index === activeIndex ? 'bg-primary/15 text-foreground' : 'text-foreground hover:bg-muted'"
            @click="run(entry.command)"
          >
            {{ entry.command.label }}
          </button>
        </div>
        <p
          v-if="filtered.length === 0"
          class="px-3 py-6 text-center text-base text-muted-foreground"
        >
          No commands match "{{ query }}".
        </p>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Search } from 'lucide-vue-next'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { useActiveOrg } from '@/composables/useActiveOrg'
import { useSession } from '@/stores/session'
import { buildCommands, filterCommands, type CommandGroup, type Command } from '@/lib/commands'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const router = useRouter()
const session = useSession()
const { orgs, activeOrg, selectOrg } = useActiveOrg()

const listId = 'command-palette-list'
const query = ref('')
const commands = ref<Command[]>([])
const activeIndex = ref(0)
const inputRef = ref<HTMLInputElement | null>(null)

const filtered = computed(() => filterCommands(commands.value, query.value))
const active = computed(() => filtered.value[activeIndex.value] ?? null)
const grouped = computed(() => {
  const groups: { name: CommandGroup; items: { command: Command; index: number }[] }[] = []
  filtered.value.forEach((command, index) => {
    let group = groups.find((entry) => entry.name === command.group)
    if (!group) {
      group = { name: command.group, items: [] }
      groups.push(group)
    }
    group.items.push({ command, index })
  })
  return groups
})

function optionId(index: number): string {
  return `${listId}-option-${index}`
}

function close() {
  emit('update:open', false)
}

/** Snapshot the session and orgs when the palette opens; running a command never re-reads them. */
function snapshot() {
  const role = session.user.value?.role ?? 'user'
  commands.value = buildCommands({
    role,
    orgs: orgs.value.map((org) => ({ id: org.org_id, name: org.org_name })),
    activeOrgId: activeOrg.value?.org_id ?? null,
    go: (path) => { void router.push(path) },
    switchOrg: (id) => {
      const org = orgs.value.find((item) => item.org_id === id)
      if (org) selectOrg(org)
    },
  })
}

watch(() => props.open, (isOpen) => {
  if (!isOpen) {
    query.value = ''
    return
  }
  snapshot()
  query.value = ''
  activeIndex.value = 0
}, { immediate: true })

watch(query, () => {
  activeIndex.value = 0
})

watch(filtered, () => {
  activeIndex.value = Math.min(activeIndex.value, Math.max(0, filtered.value.length - 1))
})

function move(delta: number) {
  if (filtered.value.length === 0) return
  activeIndex.value = Math.min(Math.max(activeIndex.value + delta, 0), filtered.value.length - 1)
}

function run(command: Command | null) {
  if (!command) return
  close()
  command.run()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    move(1)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    move(-1)
  } else if (event.key === 'Enter') {
    event.preventDefault()
    run(active.value)
  }
}

function onOpenAutoFocus(event: Event) {
  event.preventDefault()
  void nextTick(() => inputRef.value?.focus())
}
</script>
