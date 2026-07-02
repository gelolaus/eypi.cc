<template>
  <header
    :class="[
      'pill-nav-wrapper',
      isScrolled ? 'pill-nav--scrolled' : '',
      !isNavVisible ? 'pill-nav--hidden' : '',
    ]"
  >
    <nav class="pill-nav" aria-label="Main navigation">
      <!-- Logo -->
      <router-link
        :to="isAuthPage ? '/dashboard' : '/'"
        class="pill-nav__logo"
        data-cursor="nav"
      >
        eypi.cc
      </router-link>

      <div class="pill-nav__sep" aria-hidden="true" />

      <!-- Right controls -->
      <div class="flex items-center gap-2">

        <!-- Active Org Selector (Only if user has orgs) -->
        <div v-if="isAuthPage && orgs.length > 0" class="relative inline-block font-mono text-[10px]">
          <div v-if="isOrgMenuOpen" class="fixed inset-0 z-40" @click="isOrgMenuOpen = false" />
          
          <button
            class="flex max-w-[min(100%,11rem)] items-center gap-1.5 border border-gray-300 dark:border-slate-700 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl px-2.5 py-1.5 rounded-lg font-mono uppercase tracking-wider text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
            :title="activeOrg?.org_name || 'Select Org'"
            data-cursor="nav"
            @click="isOrgMenuOpen = !isOrgMenuOpen"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 shrink-0 opacity-60 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <span class="line-clamp-2 text-left text-[10px] leading-tight">{{ activeOrg?.org_name || 'Select Org' }}</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-3 w-3 opacity-40 transition-transform duration-200"
              :class="isOrgMenuOpen ? 'rotate-180' : ''"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2.5"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <!-- Org Dropdown list -->
          <div v-if="isOrgMenuOpen" class="absolute left-0 mt-1.5 z-50 w-64 max-w-[min(90vw,16rem)] bg-white dark:bg-slate-950 border border-gray-300 dark:border-slate-800 rounded-xl shadow-xl py-1.5 text-left font-mono text-[10px] uppercase tracking-wider">
            <div class="px-3 py-1.5 text-[9px] text-gray-400 dark:text-slate-500 border-b border-gray-100 dark:border-slate-900 font-bold">
              Switch Org
            </div>
            <div class="max-h-48 overflow-y-auto py-1">
              <button
                v-for="org in orgs"
                :key="org.org_id"
                class="w-full text-left px-3 py-2 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-900 flex items-start justify-between gap-2 transition-colors cursor-pointer"
                :class="activeOrg?.org_id === org.org_id ? 'text-[#DEAC4B] dark:text-[#DEAC4B] font-bold' : ''"
                @click="selectOrg(org)"
              >
                <span class="break-words leading-snug pr-1">{{ org.org_name }}</span>
                <span v-if="activeOrg?.org_id === org.org_id" class="text-[9px] text-amber-500 font-bold">●</span>
              </button>
            </div>
          </div>
        </div>

        <!-- AUTHENTICATED: user menu -->
        <div v-if="isAuthPage" class="relative">
          <!-- Click-away backdrop -->
          <div v-if="isMenuOpen" class="fixed inset-0 z-40" @click="isMenuOpen = false" />

          <!-- User button -->
          <button
            class="pill-nav__user-btn"
            data-cursor="nav"
            @click="isMenuOpen = !isMenuOpen"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span>{{ userName }}</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-3 w-3 opacity-40 transition-transform duration-200"
              :class="isMenuOpen ? 'rotate-180' : ''"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2.5"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <!-- Dropdown -->
          <div v-if="isMenuOpen" class="pill-nav__dropdown">
            <div class="pill-nav__dropdown-header">
              <div class="pill-nav__dropdown-name">{{ userName }}</div>
              <div class="pill-nav__dropdown-email">{{ userEmail }}</div>
            </div>
            <div class="py-1.5">
              <router-link
                to="/dashboard"
                class="pill-nav__dropdown-item"
                data-cursor="nav"
                @click="isMenuOpen = false"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                Dashboard
              </router-link>
              <router-link
                to="/settings"
                class="pill-nav__dropdown-item"
                data-cursor="nav"
                @click="isMenuOpen = false"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Settings
              </router-link>
              <a
                href="#"
                class="pill-nav__dropdown-item pill-nav__dropdown-item--danger"
                data-cursor="nav"
                @click.prevent="handleLogout"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Logout
              </a>
            </div>
          </div>
        </div>

        <!-- PUBLIC: login + sign up -->
        <template v-else>
          <router-link to="/orgs" class="pill-nav__link" data-cursor="nav">
            Orgs
          </router-link>
          <router-link to="/login" class="pill-nav__link" data-cursor="nav">
            Log in
          </router-link>
          <router-link to="/login?tab=register" class="pill-nav__cta" data-cursor="cta">
            Sign up
          </router-link>
        </template>

        <!-- Dark mode toggle (always visible) -->
        <button
          class="pill-nav__toggle"
          aria-label="Toggle dark mode"
          data-cursor="nav"
          @click="toggleDark"
        >
          <!-- Moon (light mode) -->
          <svg v-if="!isDark" xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
          <!-- Sun (dark mode) -->
          <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        </button>

      </div>
    </nav>
  </header>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from '@/composables/useToast'
import { useDarkMode } from '@/composables/useDarkMode'
import { useAuth } from '@/composables/useAuth'
import { API_BASE_URL } from '@/config/api'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { isDark, toggle: toggleDark } = useDarkMode()
const { authHeaders } = useAuth()

const isMenuOpen = ref(false)
const userName = ref('Guest User')
const userEmail = ref('')
const isAuthenticated = ref(false)

// Active Organization Switcher State
const orgs = ref<any[]>([])
const activeOrg = ref<any>(null)
const isOrgMenuOpen = ref(false)

async function fetchUserOrgs() {
  if (!isAuthenticated.value) return
  try {
    const res = await fetch(`${API_BASE_URL}/api/orgs`, {
      headers: authHeaders()
    })
    const data = await res.json()
    if (res.ok) {
      orgs.value = data.orgs || []
      // Find currently selected active org or set default
      const savedActiveOrgId = localStorage.getItem('active_org_id')
      let selected = orgs.value.find(o => o.org_id === savedActiveOrgId)
      if (!selected && orgs.value.length > 0) {
        // Fallback to first org (e.g. owner or first member org)
        selected = orgs.value[0]
        localStorage.setItem('active_org_id', selected.org_id)
      }
      activeOrg.value = selected || null
    }
  } catch (err) {
    console.error('Error fetching orgs for header:', err)
  }
}

function selectOrg(org: any) {
  localStorage.setItem('active_org_id', org.org_id)
  activeOrg.value = org
  isOrgMenuOpen.value = false
  toast.success(`Active context: ${org.org_name}`)
  // Reload the current page to refresh the context data
  window.location.reload()
}

// Scroll-reactive pill nav state
const isScrolled = ref(false)
const isNavVisible = ref(true)
let lastScrollY = 0

function onScroll() {
  const y = window.scrollY
  isScrolled.value = y > 20
  isNavVisible.value = y < lastScrollY || y < 50
  lastScrollY = y
}

// Show the authenticated UI (user menu) whenever a valid session token exists,
// across every suite module — not just specific paths.
const isAuthPage = computed(() => isAuthenticated.value)

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

function loadUserFromToken() {
  const token = localStorage.getItem('eypi_token')
  if (!token) {
    userName.value = 'Guest User'
    userEmail.value = ''
    isAuthenticated.value = false
    return
  }
  try {
    const parts = token.split('.')
    if (parts.length !== 3) throw new Error('malformed')
    // base64url → base64 before decoding
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      localStorage.removeItem('eypi_token')
      userName.value = 'Guest User'
      userEmail.value = ''
      isAuthenticated.value = false
      return
    }
    // Decoded only for display — never used for access-control decisions
    userName.value = formatDisplayName(payload)
    userEmail.value = payload.email || ''
    isAuthenticated.value = true
  } catch {
    localStorage.removeItem('eypi_token')
    userName.value = 'Guest User'
    userEmail.value = ''
    isAuthenticated.value = false
  }
}

onMounted(() => {
  loadUserFromToken()
  fetchUserOrgs()
  window.addEventListener('scroll', onScroll, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener('scroll', onScroll)
})

watch(
  () => route.path,
  () => {
    // Re-evaluate session on every navigation so the user menu stays correct
    // across all suite modules (links, forms, events, manage, …).
    loadUserFromToken()
  },
)

watch(isAuthenticated, (newVal) => {
  if (newVal) {
    fetchUserOrgs()
  } else {
    orgs.value = []
    activeOrg.value = null
  }
})

const handleLogout = () => {
  localStorage.removeItem('eypi_token')
  localStorage.removeItem('active_org_id')
  loadUserFromToken()
  orgs.value = []
  activeOrg.value = null
  isMenuOpen.value = false
  toast.success('Session terminated safely.')
  router.push('/login')
}
</script>
