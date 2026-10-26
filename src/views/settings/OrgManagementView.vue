<template>
  <div>
    <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <p class="text-sm text-g-muted">Create and manage every org on eypi.cc.</p>
      <router-link
        to="/admin/orgs/new"
        class="btn-gold inline-flex min-h-11 items-center justify-center rounded-xl px-5 text-base font-semibold transition-all hover:opacity-90"
       
      >
        New org
      </router-link>
    </div>

    <div v-if="loading" role="status" aria-busy="true" class="mica-card h-40 rounded-3xl motion-safe:animate-pulse">
      <span class="sr-only">Loading</span>
    </div>

    <div v-else class="space-y-3 md:space-y-0 md:overflow-hidden md:rounded-2xl md:border md:border-g-border">
      <div class="hidden grid-cols-12 border-b border-g-border bg-g-surface px-4 py-3 text-xs font-semibold text-g-muted md:grid">
        <div class="col-span-4">Org</div>
        <div class="col-span-3">Owner</div>
        <div class="col-span-2">Directory</div>
        <div class="col-span-3 text-right">Actions</div>
      </div>
      <div
        v-for="item in orgs"
        :key="item.org_id"
        data-org-row
        class="flex flex-col gap-3 rounded-2xl border border-g-border bg-g-surface p-4 md:grid md:grid-cols-12 md:items-center md:gap-0 md:rounded-none md:border-0 md:border-b md:bg-transparent md:py-4 md:last:border-0 md:hover:bg-white/30 dark:md:hover:bg-mica-navy-row-hover"
      >
        <div class="min-w-0 md:col-span-4">
          <p class="break-words text-base font-semibold leading-snug text-g-text md:text-sm">{{ item.org_name }}</p>
          <p class="text-data mt-1 truncate text-xs text-g-muted md:hidden">{{ item.owner_email }}</p>
        </div>
        <div class="text-data hidden min-w-0 truncate text-xs text-g-muted md:col-span-3 md:block">{{ item.owner_email }}</div>
        <div class="text-sm md:col-span-2">
          <span class="text-g-muted md:hidden">Directory: </span>{{ item.is_public_catalog ? 'Public' : 'Hidden' }}
        </div>
        <div class="md:col-span-3 md:text-right">
          <router-link
            :to="{ name: 'admin-orgs-edit', params: { orgId: item.org_id } }"
            class="btn-secondary w-full text-sm md:inline-flex md:w-auto"
           
          >
            Edit
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { api } from '@/lib/api'
import { ref, onMounted } from 'vue'
import { useToast } from '@/composables/useToast'
interface AdminOrgListItem {
  org_id: string
  org_name: string
  owner_email: string
  is_public_catalog: number
  created_at: string
}

const toast = useToast()

const orgs = ref<AdminOrgListItem[]>([])
const loading = ref(true)

onMounted(async () => {
  try {
    const res = await api.raw(`/api/orgs/admin`)
    const data = await res.json() as { error?: string; orgs?: AdminOrgListItem[] }
    if (!res.ok) throw new Error(data.error || 'Failed to load orgs.')
    orgs.value = data.orgs ?? []
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Failed to load orgs.')
  } finally {
    loading.value = false
  }
})
</script>
