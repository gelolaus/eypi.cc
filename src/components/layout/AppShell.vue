<template>
  <!-- Signed-in app: fixed-height shell; only the content pane scrolls. -->
  <div v-if="appShell" data-app-shell class="flex h-dvh flex-col bg-background">
    <LocalDevBanner />
    <div data-shell-body class="flex min-h-0 flex-1 flex-col lg:flex-row">
      <aside class="sticky top-0 hidden h-full w-56 shrink-0 flex-col border-r border-border bg-background/95 lg:flex">
        <div class="flex h-16 shrink-0 items-center border-b border-border px-4">
          <BrandLogo to="/dashboard" />
        </div>

        <nav class="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2" aria-label="App modules">
          <router-link
            v-for="entry in entries"
            :key="entry.to"
            :to="entry.to"
            class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-base font-medium transition"
            :class="isActive(entry)
              ? 'bg-primary/15 text-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'"
            :aria-current="isActive(entry) ? 'page' : undefined"
          >
            <component :is="entry.icon" class="size-5 shrink-0" :class="isActive(entry) ? 'text-primary' : ''" aria-hidden="true" />
            <span class="min-w-0 flex-1 truncate">{{ entry.label }}</span>
            <Badge
              v-if="entry.to === '/invites' && inviteCount > 0"
              :aria-label="`${inviteCount} pending ${inviteCount === 1 ? 'invite' : 'invites'}`"
            >
              {{ inviteCount }}
            </Badge>
          </router-link>
        </nav>

        <div class="flex shrink-0 flex-col gap-2 border-t border-border p-3">
          <OrgSwitcher block placement="up" :auto-fetch="false" />
          <AccountMenu variant="sidebar" />
        </div>
      </aside>

      <div class="flex min-h-0 min-w-0 flex-1 flex-col">
        <header
          class="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-background/90 px-4 backdrop-blur-md lg:hidden"
        >
          <BrandLogo to="/dashboard" class="min-w-0" />
          <div class="flex min-w-0 items-center gap-2">
            <div data-header-orgs class="min-w-0">
              <OrgSwitcher compact :auto-fetch="false" />
            </div>
            <AccountMenu variant="header" :overflow="overflow" />
          </div>
        </header>

        <main
          id="app-content"
          ref="paneRef"
          class="relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0"
        >
          <div class="flex flex-1 flex-col">
            <slot />
          </div>
        </main>

        <nav
          class="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
          aria-label="Primary"
        >
          <div data-tab-grid class="grid h-[4.5rem] grid-cols-4">
            <router-link
              v-for="entry in tabs"
              :key="entry.to"
              :to="entry.to"
              class="flex min-w-0 flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium transition"
              :class="isActive(entry) ? 'text-primary' : 'text-muted-foreground hover:text-foreground'"
              :aria-current="isActive(entry) ? 'page' : undefined"
            >
              <component :is="entry.icon" class="size-5" aria-hidden="true" />
              <span class="max-w-full truncate">{{ entry.label }}</span>
            </router-link>
          </div>
        </nav>
      </div>
    </div>
  </div>

  <!-- Public pages: top bar only, normal document scroll. -->
  <div v-else class="flex min-h-dvh flex-col">
    <LocalDevBanner />
    <MarketingHeader />
    <main id="app-content" class="relative z-10 flex min-h-0 flex-1 flex-col">
      <slot />
    </main>
    <MarketingFooter />
  </div>

  <SiteNavSheet />
  <ScrollTop :with-tab-bar="appShell" />
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BrandLogo from '@/components/brand/BrandLogo.vue'
import LocalDevBanner from '@/components/LocalDevBanner.vue'
import OrgSwitcher from '@/components/OrgSwitcher.vue'
import ScrollTop from '@/components/ScrollTop.vue'
import MarketingFooter from '@/components/marketing/MarketingFooter.vue'
import MarketingHeader from '@/components/marketing/MarketingHeader.vue'
import { Badge } from '@/components/ui/badge'
import { useActiveOrg } from '@/composables/useActiveOrg'
import { installPaneScroll } from '@/composables/paneScroll'
import { useScrollContainer } from '@/composables/useScrollContainer'
import { isAppShellRoute } from '@/config/nav'
import { useSession } from '@/stores/session'
import AccountMenu from './AccountMenu.vue'
import { appNav, isAppNavEntryActive, overflowEntries, tabEntries, type AppNavEntry } from './appNav'
import SiteNavSheet from './SiteNavSheet.vue'

const route = useRoute()
const router = useRouter()
const session = useSession()
const { container } = useScrollContainer()
const { orgs, activeOrg, fetchOrgs } = useActiveOrg()

const paneRef = ref<HTMLElement | null>(null)

const isAuthenticated = computed(() => session.user.value !== null)
const isAdmin = computed(() => session.user.value?.role === 'admin')
const inviteCount = computed(() => session.pendingInviteCount.value)
const entries = computed(() => appNav({ admin: isAdmin.value }))
const tabs = computed(() => tabEntries(entries.value))
const overflow = computed(() => overflowEntries(entries.value))
const appShell = computed(() =>
  isAppShellRoute({
    authenticated: isAuthenticated.value,
    path: route.path,
    requiresAuth: route.matched.some((record) => record.meta.requiresAuth === true),
  }),
)

function isActive(entry: AppNavEntry): boolean {
  return isAppNavEntryActive(entry, route.path)
}

// The pane, not the window, scrolls inside the app shell.
watch(paneRef, (pane) => {
  container.value = pane
}, { flush: 'post' })

// Pane scroll save/restore/reset lives in installPaneScroll.
const disposePaneScroll = installPaneScroll(router, () => paneRef.value)

watch(isAuthenticated, (signedIn) => {
  if (signedIn) {
    fetchOrgs()
  } else {
    orgs.value = []
    activeOrg.value = null
  }
})

onMounted(() => {
  container.value = paneRef.value
  if (isAuthenticated.value) fetchOrgs()
})

onUnmounted(() => {
  disposePaneScroll()
  container.value = null
})
</script>
