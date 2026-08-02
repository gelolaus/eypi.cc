<template>
  <div :class="['flex min-h-screen flex-col', IS_LOCAL_DEV ? 'local-dev' : '']">
    <a href="#app-content" class="skip-link">Skip to content</a>
    <LocalDevBanner />

    <AppLoader />
    <AppTransition ref="appTransitionRef" />
    <ScrollTop />

    <!-- Authenticated suite: Wantap AppShell -->
    <AppShell
      v-if="isAppShell"
      :user-name="userName"
      :user-email="userEmail"
      :has-org-tools="hasOrgTools"
      :orgs="orgs"
      :active-org="activeOrg"
      @select-org="handleSelectOrg"
      @logout="handleLogout"
    >
      <router-view v-slot="{ Component }">
        <component :is="Component" />
      </router-view>
    </AppShell>

    <!-- Marketing / auth chrome -->
    <template v-else-if="isPublicMarketing">
      <MarketingHeader />
      <main
        id="app-content"
        :class="[
          'relative z-10 flex min-h-0 flex-1 flex-col',
          IS_LOCAL_DEV ? 'pt-[1.75rem]' : '',
        ]"
      >
        <router-view v-slot="{ Component }">
          <component :is="Component" />
        </router-view>
      </main>
      <TheFooter />
    </template>

    <!-- Public frames/tix/orgs & misc: minimal chrome (no AppShell tabs) -->
    <template v-else-if="!isRedirect">
      <PublicHeader />
      <main
        id="app-content"
        :class="[
          'relative z-10 flex min-h-0 flex-1 flex-col',
          IS_LOCAL_DEV ? 'pt-[1.75rem]' : '',
        ]"
      >
        <router-view v-slot="{ Component }">
          <component :is="Component" />
        </router-view>
      </main>
    </template>

    <!-- Short-link redirect: no chrome -->
    <main v-else id="app-content" class="flex-1">
      <router-view v-slot="{ Component }">
        <component :is="Component" />
      </router-view>
    </main>

    <ToastContainer />
    <DialogHost />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, provide, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppShell from '@/components/layout/AppShell.vue'
import MarketingHeader from '@/components/layout/MarketingHeader.vue'
import PublicHeader from '@/components/layout/PublicHeader.vue'
import TheFooter from '@/components/TheFooter.vue'
import ToastContainer from '@/components/ToastContainer.vue'
import DialogHost from '@/components/DialogHost.vue'
import ScrollTop from '@/components/ScrollTop.vue'
import AppLoader from '@/components/AppLoader.vue'
import AppTransition from '@/components/AppTransition.vue'
import LocalDevBanner from '@/components/LocalDevBanner.vue'
import { IS_LOCAL_DEV } from '@/config/api'
import { useKeyboardNav } from '@/composables/useKeyboardNav'
import { useAuth } from '@/composables/useAuth'
import { useActiveOrg } from '@/composables/useActiveOrg'
import { useOrgMembership } from '@/composables/useOrgMembership'
import { useToast } from '@/composables/useToast'
import type { OrgListItem } from '@/types/orgs'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { getUser } = useAuth()
const { orgs, activeOrg, fetchOrgs, selectOrg } = useActiveOrg()
const { checkOrgMembership, clearOrgMembershipCache } = useOrgMembership()

const appTransitionRef = ref<InstanceType<typeof AppTransition> | null>(null)
const userName = ref('Guest User')
const userEmail = ref('')
const hasOrgTools = ref(false)

provide('appTransition', appTransitionRef)
useKeyboardNav()

const isPublicMarketing = computed(() =>
  ['home', 'privacy', 'terms', 'contact', 'login', 'verify', 'reset-password'].includes(
    String(route.name),
  ),
)

const isPublicOrgSurface = computed(() =>
  ['org-catalog', 'org-profile'].includes(String(route.name)),
)

const isRedirect = computed(() => route.name === 'redirect')

const isAppShell = computed(
  () =>
    Boolean(route.meta.requiresAuth) ||
    ['dashboard', 'links'].includes(String(route.name)) ||
    // Authenticated suite stays in AppShell on public org catalog/profile;
    // unauthenticated visitors keep minimal public chrome.
    (isPublicOrgSurface.value && Boolean(getUser())),
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

function loadUser() {
  const user = getUser()
  if (!user) {
    userName.value = 'Guest User'
    userEmail.value = ''
    return false
  }
  userName.value = formatDisplayName(user)
  userEmail.value = user.email || ''
  return true
}

async function refreshShellAuth() {
  const authed = loadUser()
  if (!authed) {
    hasOrgTools.value = false
    orgs.value = []
    activeOrg.value = null
    return
  }
  await fetchOrgs()
  hasOrgTools.value = await checkOrgMembership()
}

function handleSelectOrg(org: OrgListItem) {
  selectOrg(org)
}

function handleLogout() {
  localStorage.removeItem('eypi_token')
  localStorage.removeItem('active_org_id')
  clearOrgMembershipCache()
  userName.value = 'Guest User'
  userEmail.value = ''
  hasOrgTools.value = false
  orgs.value = []
  activeOrg.value = null
  toast.success('Signed out.')
  router.push('/login')
}

onMounted(() => {
  if (isAppShell.value) refreshShellAuth()
  else loadUser()
})

watch(isAppShell, (shell) => {
  if (shell) refreshShellAuth()
})

watch(
  () => route.path,
  () => {
    loadUser()
  },
)
</script>
