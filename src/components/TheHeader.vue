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
          class="pill-nav__menu-btn tap-scale"
          :class="isSidebarOpen ? 'pill-nav__menu-btn--open' : ''"
          :aria-expanded="isSidebarOpen"
          aria-controls="site-nav-sidebar"
          :aria-label="isSidebarOpen ? 'Close navigation menu' : 'Open navigation menu'"
          data-cursor="nav"
          @click="toggleSidebar"
        >
          <span class="pill-nav__menu-icon" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </button>

        <button
          class="pill-nav__toggle tap-scale"
          aria-label="Toggle dark mode"
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
      @select-org="selectOrg"
      @logout="handleLogout"
    />
  </header>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from '@/composables/useToast'
import { useDarkMode } from '@/composables/useDarkMode'
import { useAuth } from '@/composables/useAuth'
import { API_BASE_URL } from '@/config/api'
import NavSidebar from '@/components/NavSidebar.vue'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { isDark, toggle: toggleDark } = useDarkMode()
const { authHeaders } = useAuth()

const isSidebarOpen = ref(false)
const userName = ref('Guest User')
const userEmail = ref('')
const isAuthenticated = ref(false)

const orgs = ref<any[]>([])
const activeOrg = ref<any>(null)

async function fetchUserOrgs() {
  if (!isAuthenticated.value) return
  try {
    const res = await fetch(`${API_BASE_URL}/api/orgs`, {
      headers: authHeaders(),
    })
    const data = (await res.json()) as { orgs?: { org_id: string; org_name: string }[] }
    if (res.ok) {
      orgs.value = data.orgs || []
      const savedActiveOrgId = localStorage.getItem('active_org_id')
      let selected = orgs.value.find((o) => o.org_id === savedActiveOrgId)
      if (!selected && orgs.value.length > 0) {
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
  closeSidebar()
  toast.success(`Active context: ${org.org_name}`)
  window.location.reload()
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
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      localStorage.removeItem('eypi_token')
      userName.value = 'Guest User'
      userEmail.value = ''
      isAuthenticated.value = false
      return
    }
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
  document.body.style.overflow = locked ? 'hidden' : ''
}

const handleLogout = () => {
  localStorage.removeItem('eypi_token')
  localStorage.removeItem('active_org_id')
  loadUserFromToken()
  orgs.value = []
  activeOrg.value = null
  closeSidebar()
  toast.success('Session terminated safely.')
  router.push('/login')
}

onMounted(() => {
  loadUserFromToken()
  fetchUserOrgs()
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
    loadUserFromToken()
    closeSidebar()
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

watch(isSidebarOpen, (open) => {
  setBodyScrollLock(open)
})
</script>
