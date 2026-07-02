<template>
  <div>
    <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <p class="font-mono text-sm text-g-muted">Provision and manage all orgs on the platform.</p>
      <router-link
        to="/settings/org-management/new"
        class="inline-flex rounded-xl bg-g-accent px-5 py-3 font-mono text-xs font-bold uppercase tracking-wider text-white transition-all hover:-translate-y-0.5 hover:opacity-90"
        data-cursor="cta"
      >
        New org
      </router-link>
    </div>

    <div v-if="loading" class="mica-card h-40 animate-pulse rounded-3xl" />

    <div v-else class="overflow-hidden rounded-2xl border border-g-border">
      <div class="grid grid-cols-12 border-b border-g-border bg-white/40 px-4 py-3 font-mono text-[0.65rem] font-bold uppercase tracking-widest text-g-muted dark:bg-mica-navy-header">
        <div class="col-span-4">Org</div>
        <div class="col-span-3 hidden sm:block">Owner</div>
        <div class="col-span-2 hidden md:block">Directory</div>
        <div class="col-span-8 sm:col-span-3 text-right">Actions</div>
      </div>
      <div
        v-for="item in orgs"
        :key="item.org_id"
        class="grid grid-cols-12 items-center border-b border-g-border px-4 py-4 last:border-0 hover:bg-white/30 dark:hover:bg-mica-navy-row-hover"
      >
        <div class="col-span-4 min-w-0">
          <p class="truncate font-mono text-sm font-bold text-g-text">{{ item.org_name }}</p>
          <p class="font-mono text-[0.65rem] text-g-muted">/orgs/{{ item.org_id }}</p>
        </div>
        <div class="col-span-3 hidden truncate font-mono text-xs text-g-muted sm:block">{{ item.owner_email }}</div>
        <div class="col-span-2 hidden font-mono text-xs uppercase md:block">
          {{ item.is_public_catalog ? 'Public' : 'Hidden' }}
        </div>
        <div class="col-span-8 text-right sm:col-span-3">
          <router-link
            :to="{ name: 'settings-org-management-edit', params: { orgId: item.org_id } }"
            class="font-mono text-xs font-bold uppercase tracking-wider text-g-primary hover:text-g-accent"
            data-cursor="nav"
          >
            Edit
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { API_BASE_URL } from '@/config/api'
import { useAuth } from '@/composables/useAuth'
import { useToast } from '@/composables/useToast'
import type { AdminOrgListItem } from '@/config/admin'

const { authHeaders } = useAuth()
const toast = useToast()

const orgs = ref<AdminOrgListItem[]>([])
const loading = ref(true)

onMounted(async () => {
  try {
    const res = await fetch(`${API_BASE_URL}/api/orgs/admin`, { headers: authHeaders() })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to load orgs.')
    orgs.value = data.orgs ?? []
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Failed to load orgs.')
  } finally {
    loading.value = false
  }
})
</script>
