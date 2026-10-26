<template>
  <AppPage title="Admin">
    <div class="-mt-2 mb-6 flex items-center gap-2">
      <nav
        class="flex min-w-0 flex-1 snap-x snap-mandatory gap-2 overflow-x-auto"
        aria-label="Admin sections"
      >
        <router-link
          v-for="tab in tabs"
          :key="tab.name"
          :to="{ name: tab.name }"
          :class="[
            'inline-flex min-h-11 shrink-0 snap-start items-center rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
            isActive(tab)
              ? 'bg-[#34418F] text-white dark:bg-slate-700 dark:text-slate-100'
              : 'bg-transparent text-gray-500 hover:text-[#34418F] dark:text-slate-400 dark:hover:text-slate-200',
          ]"
          :aria-current="isActive(tab) ? 'page' : undefined"
          data-cursor="nav"
        >
          {{ tab.label }}
        </router-link>
      </nav>
      <router-link to="/dashboard" class="btn-secondary shrink-0" data-cursor="nav">
        Dashboard
      </router-link>
    </div>

    <router-view />
  </AppPage>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import AppPage from '@/components/AppPage.vue'

interface AdminTab {
  name: string
  label: string
  prefix?: string
}

const tabs: AdminTab[] = [
  { name: 'admin-users', label: 'Users' },
  { name: 'admin-links', label: 'Links' },
  { name: 'admin-reports', label: 'Reports' },
  { name: 'admin-orgs', label: 'Orgs', prefix: '/admin/orgs' },
  { name: 'admin-audit', label: 'Audit log' },
]

const route = useRoute()

function isActive(tab: AdminTab): boolean {
  if (tab.prefix) return route.path.startsWith(tab.prefix)
  return route.name === tab.name
}
</script>
