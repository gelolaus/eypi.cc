<template>
  <header
    class="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-background/90 px-4 backdrop-blur-md sm:px-6"
  >
    <BrandLogo :to="isAuthenticated ? '/dashboard' : '/'" class="min-h-11" />

    <div class="flex min-w-0 items-center gap-1">
      <nav class="hidden items-center gap-1 sm:flex" aria-label="Main navigation">
        <template v-for="item in inlineItems" :key="item.to">
          <Button v-if="item.cta" as-child class="ml-1 h-11 px-4 font-semibold">
            <router-link :to="item.to">{{ item.label }}</router-link>
          </Button>
          <router-link
            v-else
            :to="item.to"
            class="flex min-h-11 items-center rounded-xl px-3 text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            {{ item.label }}
          </router-link>
        </template>
      </nav>

      <button
        type="button"
        class="relative flex size-11 items-center justify-center rounded-xl text-foreground transition hover:bg-muted sm:hidden"
        :aria-expanded="isOpen ? 'true' : 'false'"
        aria-controls="site-nav-sidebar"
        aria-haspopup="dialog"
        :aria-label="menuLabel"
        @click="toggle"
      >
        <Menu class="size-5" aria-hidden="true" />
        <Badge
          v-if="pendingInviteCount > 0"
          class="pointer-events-none absolute right-0 top-0 h-4 min-w-4 px-1 text-[10px]"
        >
          {{ pendingInviteCount }}
        </Badge>
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Menu } from 'lucide-vue-next'
import BrandLogo from '@/components/brand/BrandLogo.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useNavDrawer } from '@/composables/useNavDrawer'
import { navItems, type NavItem } from '@/config/nav'
import { useSession } from '@/stores/session'

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
