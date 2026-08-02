<template>
  <div class="relative" data-account-menu>
    <button
      type="button"
      :class="
        compact
          ? 'rounded-full outline-none'
          : 'flex w-full items-center gap-3 rounded-2xl p-2 text-left outline-none hover:bg-g-bg'
      "
      :aria-expanded="open"
      aria-haspopup="menu"
      @click.stop="open = !open"
    >
      <Avatar :name="userName" :class-name="compact ? 'h-9 w-9' : 'h-11 w-11'" />
      <span v-if="!compact" class="min-w-0 flex-1">
        <span class="line-clamp-2 text-base font-semibold leading-snug tracking-tight text-g-text">
          {{ userName }}
        </span>
      </span>
      <span v-else class="sr-only">{{ userName }}</span>
    </button>

    <div
      v-if="open"
      :class="
        cn(
          'absolute z-50 min-w-64 rounded-2xl border border-g-border bg-g-surface p-2 shadow-xl',
          menuSide === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
          align === 'end' || compact ? 'right-0' : 'left-0',
        )
      "
      role="menu"
    >
      <div class="flex items-center gap-3 px-2 py-3">
        <Avatar :name="userName" class-name="h-12 w-12" />
        <div class="min-w-0">
          <p class="truncate text-base font-semibold tracking-tight text-g-text">
            {{ userName }}
          </p>
          <p v-if="userEmail" class="truncate text-sm text-g-muted">{{ userEmail }}</p>
        </div>
      </div>

      <div v-if="orgs.length > 0" class="border-t border-g-border py-2">
        <p class="px-2 pb-1 text-xs font-medium uppercase tracking-wide text-g-muted">
          Organization
        </p>
        <button
          v-for="org in orgs"
          :key="org.org_id"
          type="button"
          class="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-sm hover:bg-g-bg"
          role="menuitem"
          @click="selectOrg(org)"
        >
          <OrgLogo :logo-url="org.logo_url" :name="org.org_name" size="sm" />
          <span
            class="min-w-0 flex-1 truncate"
            :class="
              activeOrg?.org_id === org.org_id
                ? 'font-semibold text-g-primary'
                : 'text-g-text'
            "
          >
            {{ org.org_name }}
          </span>
        </button>
      </div>

      <div class="border-t border-g-border py-1">
        <router-link
          to="/settings"
          class="block rounded-xl px-3 py-3 text-base text-g-text hover:bg-g-bg"
          role="menuitem"
          @click="open = false"
        >
          Settings
        </router-link>
        <div class="flex items-center justify-between rounded-xl px-3 py-2">
          <span class="text-base text-g-text">Theme</span>
          <ThemeToggle />
        </div>
        <button
          type="button"
          class="w-full rounded-xl px-3 py-3 text-left text-base text-g-destructive hover:bg-g-bg"
          role="menuitem"
          @click="logout"
        >
          Sign out
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import Avatar from '@/components/ui/Avatar.vue'
import ThemeToggle from '@/components/ui/ThemeToggle.vue'
import OrgLogo from '@/components/OrgLogo.vue'
import { cn } from '@/lib/cn'
import type { OrgListItem } from '@/types/orgs'

withDefaults(
  defineProps<{
    userName: string
    userEmail: string
    orgs: OrgListItem[]
    activeOrg: OrgListItem | null
    compact?: boolean
    /** Where the menu opens relative to the trigger. */
    menuSide?: 'top' | 'bottom'
    align?: 'start' | 'end'
  }>(),
  {
    compact: false,
    menuSide: 'top',
    align: 'start',
  },
)

const emit = defineEmits<{
  selectOrg: [org: OrgListItem]
  logout: []
}>()

const open = ref(false)

function selectOrg(org: OrgListItem) {
  open.value = false
  emit('selectOrg', org)
}

function logout() {
  open.value = false
  emit('logout')
}

function onDocClick(event: MouseEvent) {
  const target = event.target as HTMLElement | null
  if (!target?.closest('[data-account-menu]')) open.value = false
}

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') open.value = false
}

onMounted(() => {
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onKey)
})

onUnmounted(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onKey)
})
</script>
