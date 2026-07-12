<template>
  <section class="relative mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-5xl flex-col px-4 py-8 sm:px-6 md:py-16 lg:px-8">
    <header class="reveal mb-8 flex flex-col gap-4 border-b border-g-border pb-8 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 class="text-page-title" data-cursor="text">
          Orgs
        </h1>
        <p class="mt-3 max-w-2xl text-base leading-relaxed text-g-muted">
          APC student organizations
        </p>
      </div>
      <div v-if="isAuthenticated && activeOrg" class="flex flex-wrap items-center gap-3">
        <router-link
          :to="`/orgs/modify/${activeOrg.org_id}`"
          class="tap-scale inline-flex items-center gap-2 rounded-xl bg-[#DEAC4B] px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:scale-105 dark:bg-eypi-gold-dark dark:text-slate-100 dark:hover:bg-eypi-gold-hover"
          data-cursor="cta"
        >
          Modify {{ activeOrg.org_name }}
        </router-link>
      </div>
    </header>

    <template v-if="!loading && orgs.length > 0">
      <input
        v-model="searchQuery"
        type="search"
        placeholder="Search organizations..."
        class="reveal delay-1 mb-4 w-full rounded-2xl border-2 border-g-border bg-g-surface px-6 py-4 text-base text-g-text outline-none transition-colors placeholder:text-g-muted focus:border-g-accent"
      />

      <div class="reveal delay-1 mb-6 flex flex-wrap gap-2">
        <button
          v-for="option in typeFilterOptions"
          :key="option.value ?? 'all'"
          type="button"
          class="rounded-full border px-4 py-2 text-sm font-medium transition-colors"
          :class="
            selectedOrgType === option.value
              ? 'border-g-accent bg-g-accent text-white dark:bg-eypi-gold-dark dark:text-slate-100'
              : 'border-g-border bg-g-surface text-g-muted hover:border-g-accent/40 hover:text-g-text'
          "
          data-cursor="nav"
          @click="selectedOrgType = option.value"
        >
          {{ option.label }}
        </button>
      </div>
    </template>

    <div v-if="loading" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div v-for="i in 6" :key="i" class="h-48 animate-pulse rounded-3xl bg-gray-200 dark:bg-slate-800/60" />
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
      <div class="absolute left-3 top-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
      <div class="absolute right-3 top-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
      <div class="absolute bottom-3 left-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
      <div class="absolute bottom-3 right-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
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
        data-cursor="card"
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
            class="mt-2 inline-flex w-fit items-center rounded-full bg-g-accent px-4 py-1.5 text-xs font-semibold text-white dark:bg-eypi-gold-dark dark:text-slate-100"
          >
            {{ orgTypeLabel(org.orgType) }}
          </span>
        </div>
      </router-link>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { API_BASE_URL } from '@/config/api'
import { useReveal } from '@/composables/useReveal'
import { useAuth } from '@/composables/useAuth'
import { useActiveOrg } from '@/composables/useActiveOrg'
import { orgInitials, type PublicOrgCatalogItem } from '@/types/orgs'
import { ORG_TYPE_OPTIONS, orgTypeLabel, type OrgType } from '@/constants/orgTypes'

useReveal()

const { getUser } = useAuth()
const { activeOrg, fetchOrgs } = useActiveOrg()

const orgs = ref<PublicOrgCatalogItem[]>([])
const loading = ref(true)
const error = ref('')
const searchQuery = ref('')
const selectedOrgType = ref<OrgType | null>(null)

const isAuthenticated = computed(() => !!getUser())

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
    const res = await fetch(`${API_BASE_URL}/api/orgs/public`)
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to load organizations.')
    orgs.value = data.orgs ?? []
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load organizations.'
  } finally {
    loading.value = false
  }
})
</script>
