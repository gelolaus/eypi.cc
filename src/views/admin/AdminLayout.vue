<template>
  <AppPage title="Admin">
    <div class="-mt-2 mb-6 flex items-center gap-2">
      <nav
        class="flex min-w-0 flex-1 snap-x snap-mandatory gap-2 overflow-x-auto"
        aria-label="Admin sections"
      >
        <Button
          v-for="tab in tabs"
          :key="tab.name"
          as-child
          :variant="isActive(tab) ? 'secondary' : 'ghost'"
          class="shrink-0 snap-start"
        >
          <router-link
            :to="{ name: tab.name }"
            :aria-current="isActive(tab) ? 'page' : undefined"
          >
            {{ tab.label }}
          </router-link>
        </Button>
      </nav>
      <Button
        as-child
        variant="outline"
        class="shrink-0"
      >
        <router-link to="/dashboard">
          Dashboard
        </router-link>
      </Button>
    </div>

    <router-view />
  </AppPage>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import { Button } from '@/components/ui/button'
import AppPage from '@/components/layout/AppPage.vue'

interface AdminTab {
  name: string
  label: string
  prefix?: string
}

const tabs: AdminTab[] = [
  { name: 'admin-overview', label: 'Overview' },
  { name: 'admin-users', label: 'Users' },
  { name: 'admin-links', label: 'Links' },
  { name: 'admin-reports', label: 'Reports' },
  { name: 'admin-orgs', label: 'Orgs', prefix: '/admin/orgs' },
  { name: 'admin-speed', label: 'Speed' },
  { name: 'admin-maintenance', label: 'Maintenance' },
  { name: 'admin-audit', label: 'Audit log' },
]

const route = useRoute()

function isActive(tab: AdminTab): boolean {
  if (tab.prefix) return route.path.startsWith(tab.prefix)
  return route.name === tab.name
}
</script>
