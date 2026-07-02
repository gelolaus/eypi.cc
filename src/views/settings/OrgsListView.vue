<template>
  <div>
    <div v-if="loading" class="mica-card h-40 animate-pulse rounded-3xl" />

    <div
      v-else-if="orgs.length === 0"
      class="mica-card rounded-3xl p-8 text-center font-mono text-xs uppercase tracking-[0.14em] text-g-muted"
    >
      You are not in any org yet.
    </div>

    <section v-else class="space-y-4">
      <p class="font-mono text-sm leading-relaxed text-g-muted">
        Select an org to edit its public profile, manage members, or leave.
      </p>

      <div class="grid gap-4 md:grid-cols-2">
        <router-link
          v-for="org in orgs"
          :key="org.org_id"
          :to="{ name: 'settings-org-detail', params: { orgId: org.org_id } }"
          class="mica-card group flex items-center justify-between rounded-3xl border border-g-border p-5 transition-all hover:-translate-y-0.5 hover:border-g-accent/40"
          data-cursor="nav"
        >
          <div class="min-w-0">
            <h2 class="truncate font-mono text-base font-bold uppercase tracking-[0.08em] text-g-text group-hover:text-g-accent">
              {{ org.org_name }}
            </h2>
            <p class="mt-1 font-mono text-[0.65rem] uppercase tracking-[0.12em] text-g-muted">
              /orgs/{{ org.org_id }}
            </p>
          </div>
          <span
            class="ml-3 shrink-0 rounded-full border px-3 py-1 font-mono text-[0.65rem] font-bold uppercase tracking-[0.1em]"
            :class="org.is_owner === 1
              ? 'border-g-accent/40 bg-g-accent/10 text-g-accent'
              : 'border-g-border text-g-muted'"
          >
            {{ org.is_owner === 1 ? 'Owner' : 'Member' }}
          </span>
        </router-link>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { API_BASE_URL } from '@/config/api'
import { useAuth } from '@/composables/useAuth'
import { useToast } from '@/composables/useToast'
import type { OrgListItem } from '@/types/orgs'

const { authHeaders } = useAuth()
const toast = useToast()

const orgs = ref<OrgListItem[]>([])
const loading = ref(true)

onMounted(async () => {
  try {
    const res = await fetch(`${API_BASE_URL}/api/orgs`, { headers: authHeaders() })
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
