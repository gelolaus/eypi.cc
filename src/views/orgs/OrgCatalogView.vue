<template>
  <section class="relative mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-5xl flex-col px-4 py-8 sm:px-6 md:py-16 lg:px-8">
    <header class="reveal mb-8 flex flex-col gap-4 border-b border-g-border pb-8 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 class="font-display text-3xl font-bold tracking-tight text-g-text sm:text-4xl">
          Orgs
        </h1>
        <p class="mt-3 max-w-2xl text-base leading-relaxed text-g-muted">
          APC student organizations
        </p>
      </div>
      <div v-if="isAuthenticated && activeOrg" class="flex flex-wrap items-center gap-3">
        <router-link
          :to="`/orgs/modify/${activeOrg.org_id}`"
          :class="buttonVariants({ variant: 'primary' })"
        >
          Modify {{ activeOrg.org_name }}
        </router-link>
      </div>
    </header>

    <template v-if="!loading && orgs.length > 0">
      <Input
        :value="searchQuery"
        type="search"
        placeholder="Search organizations..."
        className="reveal delay-1 mb-4"
        @input="onSearchInput"
      />

      <div class="reveal delay-1 mb-6 flex flex-wrap gap-2">
        <button
          v-for="option in typeFilterOptions"
          :key="option.value ?? 'all'"
          type="button"
          class="rounded-full border px-4 py-2 text-sm font-medium transition-colors"
          :class="
            selectedOrgType === option.value
              ? 'border-g-primary bg-g-primary text-g-primary-fg'
              : 'border-g-border bg-g-surface text-g-muted hover:border-g-primary/40 hover:text-g-text'
          "
          @click="selectedOrgType = option.value"
        >
          {{ option.label }}
        </button>
      </div>
    </template>

    <div v-if="loading" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div v-for="i in 6" :key="i" class="h-48 animate-pulse rounded-2xl bg-g-border" />
    </div>

    <Card v-else-if="error" className="text-center">
      <p class="text-sm font-semibold text-g-destructive">{{ error }}</p>
    </Card>

    <Card v-else-if="orgs.length === 0" className="text-center">
      <EmptyState
        title="No organizations in the directory yet"
        description="Org officers can opt in from Settings → Org Management."
      />
    </Card>

    <Card v-else-if="!filteredOrgs.length" className="text-center">
      <EmptyState
        title="No matching organizations"
        :description="searchQuery.trim() || selectedOrgType ? 'Try another search term or filter.' : 'Try another search term.'"
      />
    </Card>

    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <router-link
        v-for="(org, index) in filteredOrgs"
        :key="org.slug"
        :to="`/orgs/${org.slug}`"
        :class="['reveal group flex h-full flex-col rounded-2xl border border-g-border bg-g-surface p-6 transition-all hover:-translate-y-0.5 hover:border-g-primary/40', `delay-${Math.min(index + 1, 4)}`]"
      >
        <div class="mb-4 flex flex-col items-start gap-4">
          <div
            v-if="org.logoUrl"
            class="h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-g-border bg-g-bg"
          >
            <img :src="org.logoUrl" :alt="`${org.name} logo`" class="h-full w-full object-cover" />
          </div>
          <div
            v-else
            class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-g-border bg-g-brand/10 font-display text-sm font-bold uppercase tracking-wider text-g-brand"
          >
            {{ orgInitials(org.name) }}
          </div>
          <div class="w-full">
            <h2 class="text-card-title leading-snug text-g-text group-hover:text-g-primary break-words">
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
          <Badge
            v-if="orgTypeLabel(org.orgType)"
            tone="brand"
            className="mt-2"
          >
            {{ orgTypeLabel(org.orgType) }}
          </Badge>
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
import Card from '@/components/ui/Card.vue'
import Input from '@/components/ui/Input.vue'
import Badge from '@/components/ui/Badge.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { buttonVariants } from '@/lib/ui/buttonVariants'

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

function onSearchInput(e: Event) {
  searchQuery.value = (e.target as HTMLInputElement).value
}

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
