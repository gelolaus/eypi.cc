<template>
  <div>
    <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <p class="text-sm text-g-muted">Create and manage every org on eypi.cc.</p>
      <Button @click="router.push('/settings/org-management/new')">
        New org
      </Button>
    </div>

    <Card v-if="loading" className="h-40 animate-pulse" />

    <Card v-else className="!p-0 overflow-x-auto md:!p-0">
      <div class="min-w-[640px]">
        <div class="grid grid-cols-12 border-b border-g-border bg-g-bg px-4 py-3 text-xs font-semibold text-g-muted">
          <div class="col-span-4">Org</div>
          <div class="col-span-3 hidden sm:block">Owner</div>
          <div class="col-span-2 hidden md:block">Directory</div>
          <div class="col-span-8 text-right sm:col-span-3">Actions</div>
        </div>
        <div
          v-for="item in orgs"
          :key="item.org_id"
          class="grid grid-cols-12 items-center border-b border-g-border px-4 py-4 last:border-0 hover:bg-g-bg"
        >
          <div class="col-span-4 min-w-0">
            <p class="break-words text-sm font-semibold leading-snug text-g-text">{{ item.org_name }}</p>
          </div>
          <div class="text-data col-span-3 hidden truncate text-xs text-g-muted sm:block">{{ item.owner_email }}</div>
          <div class="col-span-2 hidden text-sm text-g-text md:block">
            {{ item.is_public_catalog ? 'Public' : 'Hidden' }}
          </div>
          <div class="col-span-8 text-right sm:col-span-3">
            <router-link
              :to="{ name: 'settings-org-management-edit', params: { orgId: item.org_id } }"
              class="text-sm font-semibold text-g-primary hover:text-g-accent"
            >
              Edit
            </router-link>
          </div>
        </div>
      </div>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { API_BASE_URL } from '@/config/api'
import { useAuth } from '@/composables/useAuth'
import { useToast } from '@/composables/useToast'
import type { AdminOrgListItem } from '@/config/admin'
import Card from '@/components/ui/Card.vue'
import Button from '@/components/ui/Button.vue'

const router = useRouter()
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
