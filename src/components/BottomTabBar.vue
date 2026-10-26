<template>
  <nav
    class="safe-bottom fixed inset-x-0 bottom-0 z-[9990] border-t border-g-border bg-g-bg lg:hidden"
    aria-label="Primary"
  >
    <div data-tab-grid class="grid h-[4.5rem] grid-cols-5">
      <router-link
        v-for="item in tabs"
        :key="item.to"
        :to="item.to"
        class="flex min-w-0 flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium"
        :class="isNavActive(item, route.path) ? 'text-primary' : 'text-g-muted hover:text-g-text'"
        :aria-current="isNavActive(item, route.path) ? 'page' : undefined"
      >
        <NavIcon :name="item.icon" />
        <span class="max-w-full truncate">{{ item.label }}</span>
      </router-link>

      <button
        type="button"
        class="relative flex min-w-0 flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium"
        :class="moreOpen || moreActive ? 'text-primary' : 'text-g-muted hover:text-g-text'"
        :aria-label="moreLabel"
        :aria-expanded="moreOpen ? 'true' : 'false'"
        aria-controls="site-nav-sidebar"
        aria-haspopup="dialog"
        :aria-current="moreActive ? 'page' : undefined"
        @click="$emit('more')"
      >
        <span class="relative">
          <NavIcon name="more" />
          <span
            v-if="inviteCount > 0"
            class="pointer-events-none absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#DEAC4B] px-1 text-[10px] font-semibold leading-none text-[#1a1a2e]"
            aria-hidden="true"
          >
            {{ inviteCount }}
          </span>
        </span>
        <span>More</span>
      </button>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import NavIcon from '@/components/NavIcon.vue'
import { isNavActive, tabItems, type NavItem } from '@/config/nav'

const props = defineProps<{
  items: NavItem[]
  moreOpen: boolean
  inviteCount: number
}>()

defineEmits<{ more: [] }>()

const route = useRoute()
const tabs = computed(() => tabItems(props.items))
const moreActive = computed(
  () =>
    !tabs.value.some((item) => isNavActive(item, route.path))
    && props.items.some((item) => isNavActive(item, route.path)),
)

const moreLabel = computed(() => {
  const count = props.inviteCount
  if (count < 1) return 'More'
  return `More, ${count} pending ${count === 1 ? 'invite' : 'invites'}`
})
</script>
