<template>
  <main class="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-24 pt-8 sm:px-6 md:pt-16 md:pb-32 lg:px-8">
    <header class="reveal mb-8 flex flex-col gap-5 border-b border-g-border pb-8 md:flex-row md:items-end md:justify-between">
      <h1 class="text-page-title">
        Admin
      </h1>

      <router-link
        to="/dashboard"
        class="inline-flex items-center justify-center rounded-full border border-g-border px-4 py-2 text-sm font-semibold text-g-muted transition-all hover:-translate-y-0.5 hover:border-g-accent hover:text-g-text"
        data-cursor="nav"
      >
        Dashboard
      </router-link>
    </header>

    <nav class="reveal delay-1 mb-8 flex flex-wrap gap-2" aria-label="Admin sections">
      <router-link
        v-for="tab in tabs"
        :key="tab.name"
        :to="{ name: tab.name }"
        :class="[
          'inline-flex min-h-[44px] items-center rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
          isActive(tab)
            ? 'bg-[#34418F] text-white dark:bg-slate-700 dark:text-slate-100'
            : 'bg-transparent text-gray-400 hover:text-[#34418F] dark:text-slate-400 dark:hover:text-slate-200',
        ]"
        :aria-current="isActive(tab) ? 'page' : undefined"
        data-cursor="nav"
      >
        {{ tab.label }}
      </router-link>
    </nav>

    <router-view />
  </main>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import { useReveal } from '@/composables/useReveal'

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
useReveal()

function isActive(tab: AdminTab): boolean {
  if (tab.prefix) return route.path.startsWith(tab.prefix)
  return route.name === tab.name
}
</script>
