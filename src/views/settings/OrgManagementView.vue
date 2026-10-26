<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <p class="text-sm text-muted-foreground">
        Create and manage every org on eypi.cc.
      </p>
      <Button as-child>
        <router-link to="/admin/orgs/new">
          New org
        </router-link>
      </Button>
    </div>

    <div
      v-if="loading"
      role="status"
      aria-busy="true"
      class="h-40 rounded-3xl bg-muted motion-safe:animate-pulse"
    >
      <span class="sr-only">Loading</span>
    </div>

    <div
      v-else
      class="space-y-3 md:space-y-0 md:overflow-hidden md:rounded-2xl md:border md:border-border"
    >
      <div class="hidden grid-cols-12 border-b border-border bg-card px-4 py-3 text-xs font-semibold text-muted-foreground md:grid">
        <div class="col-span-4">
          Org
        </div>
        <div class="col-span-3">
          Owner
        </div>
        <div class="col-span-2">
          Directory
        </div>
        <div class="col-span-3 text-right">
          Actions
        </div>
      </div>
      <div
        v-for="item in orgs"
        :key="item.org_id"
        data-org-row
        class="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 md:grid md:grid-cols-12 md:items-center md:gap-0 md:rounded-none md:border-0 md:border-b md:bg-transparent md:py-4 md:last:border-0 md:hover:bg-muted/40"
      >
        <div class="min-w-0 md:col-span-4">
          <p class="break-words text-base font-semibold leading-snug md:text-sm">
            {{ item.org_name }}
          </p>
          <p class="mt-1 truncate font-mono text-xs text-muted-foreground md:hidden">
            {{ item.owner_email }}
          </p>
        </div>
        <div class="hidden min-w-0 truncate font-mono text-xs text-muted-foreground md:col-span-3 md:block">
          {{ item.owner_email }}
        </div>
        <div class="text-sm md:col-span-2">
          <span class="text-muted-foreground md:hidden">Directory: </span>{{ item.is_public_catalog ? 'Public' : 'Hidden' }}
        </div>
        <div class="md:col-span-3 md:text-right">
          <Button
            as-child
            variant="outline"
            class="w-full text-sm md:w-auto"
          >
            <router-link :to="{ name: 'admin-orgs-edit', params: { orgId: item.org_id } }">
              Edit
            </router-link>
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Button } from '@/components/ui/button'
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
