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
                to="/settings"
                class="pill-nav__dropdown-item"
                data-cursor="nav"
                @click="isMenuOpen = false"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Account Settings
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

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { isDark, toggle: toggleDark } = useDarkMode()

const isMenuOpen = ref(false)
const userName = ref('Guest User')
const userEmail = ref('')

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

// Whether we're on an authenticated page
const isAuthPage = computed(() =>
  route.path === '/dashboard' || route.path === '/settings',
)

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
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      userName.value = formatDisplayName(payload)
      userEmail.value = payload.email || ''
    } catch (e) {
      console.error('Failed to parse user token', e)
    }
  } else {
    userName.value = 'Guest User'
    userEmail.value = ''
  }
}

onMounted(() => {
  loadUserFromToken()
  window.addEventListener('scroll', onScroll, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener('scroll', onScroll)
})

watch(
  () => route.path,
  (path) => {
    if (path === '/dashboard' || path === '/settings') {
      loadUserFromToken()
    }
  },
)

const handleLogout = () => {
  localStorage.removeItem('eypi_token')
  loadUserFromToken()
  isMenuOpen.value = false
  toast.success('Session terminated safely.')
  router.push('/login')
}
</script>
