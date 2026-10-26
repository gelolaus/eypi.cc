<template>
  <header
    class="sticky top-0 z-[9990] flex h-14 shrink-0 items-center justify-between gap-3 border-b border-g-border bg-g-bg px-4 sm:px-6"
    :class="appShell ? 'lg:hidden' : ''"
  >
    <router-link
      :to="isAuthenticated ? '/dashboard' : '/'"
      class="flex min-h-11 shrink-0 items-center text-[0.9375rem] font-bold tracking-tight text-g-primary dark:text-g-text"
     
    >
      eypi.cc
    </router-link>

    <div class="flex min-w-0 items-center gap-1">
      <div v-if="appShell" data-header-orgs class="min-w-0">
        <OrgSwitcher compact :auto-fetch="false" />
      </div>

      <nav v-else class="hidden items-center gap-1 sm:flex" aria-label="Main navigation">
        <router-link
          v-for="item in inlineItems"
          :key="item.to"
          :to="item.to"
          class="flex min-h-11 items-center rounded-xl px-3 text-sm font-medium"
          :class="item.cta ? 'btn-gold ml-1 font-semibold' : 'text-g-muted hover:text-g-text'"
         
        >
          {{ item.label }}
        </router-link>
      </nav>

      <ThemeToggle />

      <button
        v-if="!appShell"
        type="button"
        class="tap-scale relative flex size-11 items-center justify-center rounded-xl text-g-text sm:hidden"
        :aria-expanded="isOpen ? 'true' : 'false'"
        aria-controls="site-nav-sidebar"
        aria-haspopup="dialog"
        :aria-label="menuLabel"
       
        @click="toggle"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
          <path stroke-linecap="round" d="M4 7h16M4 12h16M4 17h16" />
        </svg>
        <span
          v-if="pendingInviteCount > 0"
          class="pointer-events-none absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#DEAC4B] px-1 text-[10px] font-semibold leading-none text-[#1a1a2e]"
        >
          {{ pendingInviteCount }}
        </span>
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import OrgSwitcher from '@/components/OrgSwitcher.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'
import { useNavDrawer } from '@/composables/useNavDrawer'
import { navItems, type NavItem } from '@/config/nav'
import { useSession } from '@/stores/session'

withDefaults(defineProps<{ appShell?: boolean }>(), { appShell: false })

const session = useSession()
const { isOpen, toggle } = useNavDrawer()

const isAuthenticated = computed(() => session.user.value !== null)
const pendingInviteCount = computed(() => session.pendingInviteCount.value)

const inlineItems = computed<NavItem[]>(() =>
  isAuthenticated.value
    ? [{ to: '/dashboard', label: 'Dashboard', icon: 'home', cta: true }]
    : navItems({ authenticated: false, admin: false }),
)

const menuLabel = computed(() => {
  const action = isOpen.value ? 'Close navigation menu' : 'Open navigation menu'
  const count = pendingInviteCount.value
  if (count < 1) return action
  const noun = count === 1 ? 'invite' : 'invites'
  return `${action}, ${count} pending ${noun}`
})
</script>
