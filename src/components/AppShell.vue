<template>
  <!-- Signed-in app: fixed-height shell; only the content pane scrolls. -->
  <div v-if="appShell" data-app-shell class="flex h-dvh flex-col">
    <LocalDevBanner />
    <div data-shell-body class="flex min-h-0 flex-1 flex-col lg:flex-row">
      <SideRail :items="items" :invite-count="inviteCount" @logout="handleLogout" />

      <div class="flex min-h-0 min-w-0 flex-1 flex-col">
        <TheHeader app-shell />
        <main
          id="app-content"
          ref="paneRef"
          class="relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0"
        >
          <div class="flex flex-1 flex-col">
            <slot />
          </div>
          <TheFooter />
        </main>
        <BottomTabBar :items="items" :more-open="drawer.isOpen.value" :invite-count="inviteCount" @more="drawer.toggle" />
      </div>
    </div>
  </div>

  <!-- Public pages: top bar only, normal document scroll. -->
  <div v-else class="flex min-h-dvh flex-col">
    <LocalDevBanner />
    <TheHeader />
    <main id="app-content" class="relative z-10 flex min-h-0 flex-1 flex-col">
      <slot />
    </main>
    <TheFooter />
  </div>

  <NavSidebar
    :is-open="drawer.isOpen.value"
    :is-authenticated="isAuthenticated"
    :user-name="userName"
    :user-email="userEmail"
    :orgs="orgs"
    :active-org="activeOrg"
    @close="drawer.close"
    @select-org="handleSelectOrg"
    @logout="handleLogout"
  />
  <ScrollTop :with-tab-bar="appShell" />
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BottomTabBar from '@/components/BottomTabBar.vue'
import LocalDevBanner from '@/components/LocalDevBanner.vue'
import NavSidebar from '@/components/NavSidebar.vue'
import ScrollTop from '@/components/ScrollTop.vue'
import SideRail from '@/components/SideRail.vue'
import TheFooter from '@/components/TheFooter.vue'
import TheHeader from '@/components/TheHeader.vue'
import { useActiveOrg } from '@/composables/useActiveOrg'
import { useNavDrawer } from '@/composables/useNavDrawer'
import { useScrollContainer } from '@/composables/useScrollContainer'
import { useToast } from '@/composables/useToast'
import { isAppShellRoute, navItems } from '@/config/nav'
import { useSession } from '@/stores/session'
import type { OrgListItem } from '@/types/orgs'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const session = useSession()
const drawer = useNavDrawer()
const { container } = useScrollContainer()
const { orgs, activeOrg, fetchOrgs, selectOrg } = useActiveOrg()

const paneRef = ref<HTMLElement | null>(null)

const isAuthenticated = computed(() => session.user.value !== null)
const isAdmin = computed(() => session.user.value?.role === 'admin')
const inviteCount = computed(() => session.pendingInviteCount.value)
const items = computed(() => navItems({ authenticated: isAuthenticated.value, admin: isAdmin.value }))
const appShell = computed(() =>
  isAppShellRoute({
    authenticated: isAuthenticated.value,
    path: route.path,
    requiresAuth: route.matched.some((record) => record.meta.requiresAuth === true),
  }),
)

const userEmail = computed(() => session.user.value?.email ?? '')
const userName = computed(() => {
  const current = session.user.value
  if (!current) return 'Guest User'
  return formatDisplayName(current)
})

function formatDisplayName(payload: { name?: string | null; email?: string }): string {
  const emailPrefix = payload.email ? payload.email.split('@')[0] : ''
  const capitalize = (s: string) =>
    s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : 'Student'
  const trimmedName = payload.name?.trim()
  if (trimmedName && trimmedName.toLowerCase() !== emailPrefix.toLowerCase()) {
    return trimmedName
  }
  return emailPrefix ? capitalize(emailPrefix) : 'Student'
}

function handleSelectOrg(org: OrgListItem) {
  drawer.close()
  selectOrg(org)
}

async function handleLogout() {
  await session.logout()
  orgs.value = []
  activeOrg.value = null
  drawer.close()
  toast.success('Signed out.')
  await router.push('/login')
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') drawer.close()
}

function setBodyScrollLock(locked: boolean) {
  document.documentElement.classList.toggle('nav-scroll-lock', locked)
  document.body.classList.toggle('nav-scroll-lock', locked)
}

// The pane, not the window, scrolls inside the app shell.
watch(paneRef, (pane) => {
  container.value = pane
}, { flush: 'post' })

watch(
  () => route.path,
  () => {
    drawer.close()
    if (paneRef.value) paneRef.value.scrollTop = 0
  },
)

watch(isAuthenticated, (signedIn) => {
  if (signedIn) {
    fetchOrgs()
  } else {
    orgs.value = []
    activeOrg.value = null
  }
})

watch(drawer.isOpen, setBodyScrollLock)

onMounted(() => {
  container.value = paneRef.value
  if (isAuthenticated.value) fetchOrgs()
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  drawer.close()
  setBodyScrollLock(false)
  container.value = null
})
</script>
