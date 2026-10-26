<template>
  <div>
    <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <p class="text-sm text-g-muted">Create and manage every org on eypi.cc.</p>
      <router-link
        to="/admin/orgs/new"
 class="btn-gold inline-flex rounded-xl px-5 py-3 text-sm font-semibold transition-all hover:-translate-y-0.5 hover:opacity-90"
        data-cursor="cta"
      >
        New org
      </router-link>
    </div>

    <div v-if="loading" class="mica-card h-40 animate-pulse rounded-3xl" />

    <div v-else class="overflow-x-auto rounded-2xl border border-g-border">
      <div class="min-w-[640px]">
        <div class="grid grid-cols-12 border-b border-g-border bg-white/40 px-4 py-3 text-xs font-semibold text-g-muted dark:bg-mica-navy-header">
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
            <p class="text-sm font-semibold leading-snug text-g-text break-words">{{ item.org_name }}</p>
          </div>
          <div class="text-data col-span-3 hidden truncate text-xs text-g-muted sm:block">{{ item.owner_email }}</div>
          <div class="col-span-2 hidden text-sm md:block">
            {{ item.is_public_catalog ? 'Public' : 'Hidden' }}
          </div>
          <div class="col-span-8 text-right sm:col-span-3">
            <router-link
              :to="{ name: 'admin-orgs-edit', params: { orgId: item.org_id } }"
              class="text-sm font-semibold text-g-primary hover:text-g-accent"
              data-cursor="nav"
            >
              Edit
            </router-link>
          </div>
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
