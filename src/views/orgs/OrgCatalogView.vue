<template>
  <AppPage title="Orgs" description="APC student organizations">
    <div v-if="isAuthenticated && activeOrg" class="mb-6">
      <router-link
        :to="`/orgs/modify/${activeOrg.org_id}`"
        class="btn-gold tap-scale inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-5 text-base font-semibold shadow-md transition-all sm:w-auto"
       
      >
        Modify {{ activeOrg.org_name }}
      </router-link>
    </div>

    <template v-if="!loading && orgs.length > 0">
      <input
        v-model="searchQuery"
        type="search"
        placeholder="Search organizations..."
        aria-label="Search organizations"
        class="control mb-4 w-full"
      />

      <div class="mb-6 flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible">
        <button
          v-for="option in typeFilterOptions"
          :key="option.value ?? 'all'"
          type="button"
          class="min-h-11 shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors"
          :class="
            selectedOrgType === option.value
              ? 'btn-gold border-g-accent'
              : 'border-g-border bg-g-surface text-g-muted hover:border-g-accent/40 hover:text-g-text'
          "
         
          @click="selectedOrgType = option.value"
        >
          {{ option.label }}
        </button>
      </div>
    </template>

    <div v-if="loading" role="status" aria-busy="true" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <span class="sr-only">Loading</span>
      <div v-for="i in 6" :key="i" class="h-48 rounded-3xl bg-g-border motion-safe:animate-pulse" aria-hidden="true" />
    </div>

    <div
      v-else-if="error"
      class="mica-card rounded-3xl border border-g-border p-12 text-center"
    >
      <p class="font-mono text-sm uppercase tracking-widest text-red-500">{{ error }}</p>
    </div>

    <div
      v-else-if="orgs.length === 0"
      class="mica-card relative rounded-3xl border border-g-border p-12 text-center"
    >
      <p class="font-mono text-sm uppercase tracking-widest text-g-muted">No organizations in the directory yet</p>
      <p class="mt-3 font-mono text-xs leading-relaxed text-g-muted">
        Org officers can opt in from Settings → Org Management.
      </p>
    </div>

    <div
      v-else-if="!filteredOrgs.length"
      class="mica-card rounded-3xl border border-g-border p-12 text-center"
    >
      <p class="font-mono text-sm uppercase tracking-widest text-g-muted">No matching organizations</p>
      <p class="mt-3 font-mono text-xs leading-relaxed text-g-muted">
        {{ searchQuery.trim() || selectedOrgType ? 'Try another search term or filter.' : 'Try another search term.' }}
      </p>
    </div>

    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <router-link
        v-for="(org, index) in filteredOrgs"
        :key="org.slug"
        :to="`/orgs/${org.slug}`"
        :class="['reveal mica-card group flex h-full flex-col rounded-3xl border border-g-border p-6 transition-all hover:-translate-y-0.5 hover:border-g-accent/40', `delay-${Math.min(index + 1, 4)}`]"
       
      >
        <div class="mb-4 flex flex-col items-start gap-4">
          <div
            v-if="org.logoUrl"
            class="h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-g-border bg-white/50 dark:bg-slate-900/40"
          >
            <img :src="org.logoUrl" :alt="`${org.name} logo`" class="h-full w-full object-cover" />
          </div>
          <div
            v-else
            class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-g-border bg-[#34418F]/10 font-mono text-sm font-bold uppercase tracking-wider text-[#34418F] dark:bg-slate-800 dark:text-slate-200"
          >
            {{ orgInitials(org.name) }}
          </div>
          <div class="w-full">
            <h2 class="text-card-title leading-snug text-g-text group-hover:text-g-accent break-words">
              {{ org.name }}
            </h2>
          </div>
        </div>
        <div class="flex flex-1 flex-col">
          <p
            v-if="org.tagline"
            class="line-clamp-2 text-sm leading-relaxed text-g-muted"
          >
            {{ org.tagline }}
          </p>
          <span
            v-if="orgTypeLabel(org.orgType)"
 class="btn-gold mt-2 inline-flex w-fit items-center rounded-full px-4 py-1.5 text-xs font-semibold"
          >
            {{ orgTypeLabel(org.orgType) }}
          </span>
        </div>
      </router-link>
    </div>
  </AppPage>
</template>

<script setup lang="ts">
import AppPage from '@/components/layout/AppPage.vue'
import { api } from '@/lib/api'
import { ref, computed, onMounted } from 'vue'
import { useReveal } from '@/composables/useReveal'
import { useSession } from '@/stores/session'
import { useActiveOrg } from '@/composables/useActiveOrg'
import { orgInitials, type PublicOrgCatalogItem } from '@/types/orgs'
import { ORG_TYPE_OPTIONS, orgTypeLabel, type OrgType } from '@/constants/orgTypes'

useReveal()

const session = useSession()
const { activeOrg, fetchOrgs } = useActiveOrg()

const orgs = ref<PublicOrgCatalogItem[]>([])
const loading = ref(true)
const error = ref('')
const searchQuery = ref('')
const selectedOrgType = ref<OrgType | null>(null)

const isAuthenticated = computed(() => session.user.value !== null)

const typeFilterOptions = computed(() => [
  { value: null as OrgType | null, label: 'All' },
  ...ORG_TYPE_OPTIONS,
])

const filteredOrgs = computed(() => {
  let list = orgs.value

  if (selectedOrgType.value) {
    list = list.filter((org) => org.orgType === selectedOrgType.value)
  }

  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return list

  return list.filter((org) =>
    org.name.toLowerCase().includes(q)
    || org.slug.toLowerCase().includes(q)
    || (org.tagline?.toLowerCase().includes(q) ?? false)
    || (orgTypeLabel(org.orgType)?.toLowerCase().includes(q) ?? false),
  )
})

onMounted(async () => {
  if (isAuthenticated.value) {
    fetchOrgs()
  }

  try {
    const res = await api.raw(`/api/orgs/public`)
    const data = await res.json() as { error?: string; orgs?: PublicOrgCatalogItem[] }
    if (!res.ok) throw new Error(data.error || 'Failed to load organizations.')
    orgs.value = data.orgs ?? []
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load organizations.'
  } finally {
    loading.value = false
  }
})
</script>
