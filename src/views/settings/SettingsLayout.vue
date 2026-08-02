<template>
  <main class="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pb-24 pt-8 sm:px-6 md:pt-16 md:pb-32 lg:px-8">
    <header class="mb-8 flex flex-col gap-5 border-b border-g-border pb-8 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 class="font-display text-3xl font-bold text-g-text">
          Settings
        </h1>
      </div>

      <Button variant="secondary" size="sm" @click="router.push('/dashboard')">
        Dashboard
      </Button>
    </header>

    <nav class="mb-8 flex flex-wrap gap-2">
      <router-link
        v-for="tab in tabs"
        :key="tab.name"
        :to="{ name: tab.name }"
        :class="[
          'inline-flex min-h-[44px] items-center rounded-full px-4 py-2 text-sm font-semibold transition-colors',
          isTabActive(tab)
            ? 'bg-g-primary text-g-primary-fg'
            : 'bg-transparent text-g-muted hover:bg-g-bg hover:text-g-text',
        ]"
      >
        {{ tab.label }}
      </router-link>
    </nav>

    <router-view />
  </main>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { SUPER_ADMIN_EMAIL } from '@/config/admin'
import Button from '@/components/ui/Button.vue'

const route = useRoute()
const router = useRouter()
const { getUser } = useAuth()

const isSuperAdmin = computed(() => getUser()?.email === SUPER_ADMIN_EMAIL)

interface SettingsTab {
  name: string
  label: string
  prefix?: string
}

const tabs = computed<SettingsTab[]>(() => {
  const items: SettingsTab[] = [
    { name: 'settings-security', label: 'Account Security' },
  ]
  if (isSuperAdmin.value) {
    items.push({ name: 'settings-org-management', label: 'Org Management', prefix: '/settings/org-management' })
  }
  return items
})

function isTabActive(tab: SettingsTab): boolean {
  if (tab.prefix) return route.path.startsWith(tab.prefix)
  return route.name === tab.name
}
</script>
