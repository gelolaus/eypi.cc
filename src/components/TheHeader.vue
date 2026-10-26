<template>
  <header
    :class="[
      'pill-nav-wrapper',
      isScrolled ? 'pill-nav--scrolled' : '',
      !isNavVisible ? 'pill-nav--hidden' : '',
    ]"
  >
    <nav class="pill-nav" aria-label="Main navigation">
      <router-link
        :to="isAuthPage ? '/dashboard' : '/'"
        class="pill-nav__logo tap-scale"
        data-cursor="nav"
      >
        eypi.cc
      </router-link>

      <div class="pill-nav__controls">
        <button
          type="button"
          class="pill-nav__menu-btn tap-scale relative"
          :class="isSidebarOpen ? 'pill-nav__menu-btn--open' : ''"
          :aria-expanded="isSidebarOpen"
          aria-controls="site-nav-sidebar"
          :aria-label="menuLabel"
          data-cursor="nav"
          @click="toggleSidebar"
        >
          <span class="pill-nav__menu-icon" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span
            v-if="pendingInviteCount > 0"
            class="pointer-events-none absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#DEAC4B] px-1 text-[10px] font-semibold leading-none text-[#1a1a2e]"
          >
            {{ pendingInviteCount }}
          </span>
        </button>

        <button
          type="button"
          class="pill-nav__toggle tap-scale"
          aria-label="Toggle dark mode"
          :aria-pressed="isDark ? 'true' : 'false'"
          data-cursor="nav"
          @click="toggleDark"
        >
          <svg v-if="!isDark" xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        </button>
      </div>
    </nav>

    <NavSidebar
      :is-open="isSidebarOpen"
      :is-authenticated="isAuthPage"
      :user-name="userName"
      :user-email="userEmail"
      :orgs="orgs"
      :active-org="activeOrg"
      @close="closeSidebar"
      @select-org="handleSelectOrg"
      @logout="handleLogout"
    />
  </header>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from '@/composables/useToast'
import { useDarkMode } from '@/composables/useDarkMode'
import { useActiveOrg } from '@/composables/useActiveOrg'
import { useSession } from '@/stores/session'
import type { OrgListItem } from '@/types/orgs'
import NavSidebar from '@/components/NavSidebar.vue'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { isDark, toggle: toggleDark } = useDarkMode()
const { orgs, activeOrg, fetchOrgs, selectOrg } = useActiveOrg()
const session = useSession()

const isSidebarOpen = ref(false)
const isAuthenticated = computed(() => session.user.value !== null)
const userEmail = computed(() => session.user.value?.email ?? '')
const userName = computed(() => {
  const current = session.user.value
  if (!current) return 'Guest User'
  return formatDisplayName(current)
})

function handleSelectOrg(org: OrgListItem) {
  closeSidebar()
  selectOrg(org)
}

const isScrolled = ref(false)
const isNavVisible = ref(true)
let lastScrollY = 0

function onScroll() {
  const y = window.scrollY
  isScrolled.value = y > 20
  isNavVisible.value = y < lastScrollY || y < 50
  lastScrollY = y
}

const isAuthPage = isAuthenticated
const pendingInviteCount = computed(() => session.pendingInviteCount.value)
const menuLabel = computed(() => {
  const action = isSidebarOpen.value ? 'Close navigation menu' : 'Open navigation menu'
  const count = pendingInviteCount.value
  if (count < 1) return action
  const noun = count === 1 ? 'invite' : 'invites'
  return `${action}, ${count} pending ${noun}`
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

function toggleSidebar() {
  isSidebarOpen.value = !isSidebarOpen.value
}

function closeSidebar() {
  isSidebarOpen.value = false
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') closeSidebar()
}

function setBodyScrollLock(locked: boolean) {
  document.documentElement.classList.toggle('nav-scroll-lock', locked)
  document.body.classList.toggle('nav-scroll-lock', locked)
}

async function handleLogout() {
  await session.logout()
  orgs.value = []
  activeOrg.value = null
  closeSidebar()
  toast.success('Signed out.')
  await router.push('/login')
}

onMounted(() => {
  if (isAuthenticated.value) fetchOrgs()
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('keydown', onKeydown)
  setBodyScrollLock(false)
})

watch(
  () => route.path,
  () => {
    closeSidebar()
  },
)

watch(isAuthenticated, (newVal) => {
  if (newVal) {
    fetchOrgs()
  } else {
    orgs.value = []
    activeOrg.value = null
  }
})

watch(isSidebarOpen, (open) => {
  setBodyScrollLock(open)
})
</script>
