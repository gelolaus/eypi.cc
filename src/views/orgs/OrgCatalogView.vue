<template>
  <AppPage
    title="Orgs"
    description="APC student organizations"
  >
    <div v-if="isAuthenticated && activeOrg">
      <Button
        as-child
        class="w-full sm:w-auto"
      >
        <router-link :to="`/orgs/modify/${activeOrg.org_id}`">
          Modify {{ activeOrg.org_name }}
        </router-link>
      </Button>
    </div>

    <template v-if="!loading && orgs.length > 0">
      <Input
        v-model="searchQuery"
        type="search"
        placeholder="Search organizations..."
        aria-label="Search organizations"
      />

      <div class="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible">
        <Button
          v-for="option in typeFilterOptions"
          :key="option.value ?? 'all'"
          type="button"
          :variant="selectedOrgType === option.value ? 'default' : 'outline'"
          :aria-pressed="selectedOrgType === option.value"
          class="shrink-0 rounded-full px-4 text-sm"
          @click="selectedOrgType = option.value"
        >
          {{ option.label }}
        </Button>
      </div>
    </template>

    <CardGridSkeleton
      v-if="loading"
      :count="6"
      :card-height="192"
    />

    <Card
      v-else-if="error"
      class="rounded-3xl p-12 text-center"
    >
      <p
        role="alert"
        class="text-sm text-destructive"
      >
        {{ error }}
      </p>
    </Card>

    <Card
      v-else-if="orgs.length === 0"
      class="rounded-3xl p-12 text-center"
    >
      <p class="text-base font-medium">
        No organizations in the directory yet
      </p>
      <p class="mt-2 text-sm leading-relaxed text-muted-foreground">
        Org officers can opt in from Settings → Org Management.
      </p>
    </Card>

    <Card
      v-else-if="!filteredOrgs.length"
      class="rounded-3xl p-12 text-center"
    >
      <p class="text-base font-medium">
        No matching organizations
      </p>
      <p class="mt-2 text-sm leading-relaxed text-muted-foreground">
        {{ searchQuery.trim() || selectedOrgType ? 'Try another search term or filter.' : 'Try another search term.' }}
      </p>
    </Card>

    <div
      v-else
      class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      <router-link
        v-for="org in filteredOrgs"
        :key="org.slug"
        :to="`/orgs/${org.slug}`"
        class="group block h-full rounded-3xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Card class="h-full gap-4 rounded-3xl p-6 transition-colors group-hover:ring-foreground/25">
          <div class="flex flex-col items-start gap-4">
            <div
              v-if="org.logoUrl"
              class="size-14 shrink-0 overflow-hidden rounded-2xl border border-border bg-card"
            >
              <AppImage
                :src="org.logoUrl"
                :meta="org.logoMeta"
                sizes="56px"
                :alt="`${org.name} logo`"
                class="h-full w-full object-cover"
              />
            </div>
            <div
              v-else
              class="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-border bg-primary/10 font-mono text-sm font-bold uppercase tracking-wider text-primary"
            >
              {{ orgInitials(org.name) }}
            </div>
            <h2 class="w-full break-words font-heading text-lg font-semibold leading-snug">
              {{ org.name }}
            </h2>
          </div>
          <div class="flex flex-1 flex-col gap-2">
            <p
              v-if="org.tagline"
              class="line-clamp-2 text-sm leading-relaxed text-muted-foreground"
            >
              {{ org.tagline }}
            </p>
            <Badge
              v-if="orgTypeLabel(org.orgType)"
              variant="secondary"
              class="h-6 px-3"
            >
              {{ orgTypeLabel(org.orgType) }}
            </Badge>
          </div>
        </Card>
      </router-link>
    </div>
  </AppPage>
</template>

<script setup lang="ts">
import AppImage from '@/components/AppImage.vue'
import AppPage from '@/components/layout/AppPage.vue'
import CardGridSkeleton from '@/components/skeletons/CardGridSkeleton.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useQuery } from '@/lib/queryCache'
import { ref, computed, onMounted } from 'vue'
import { useSession } from '@/stores/session'
import { useActiveOrg } from '@/composables/useActiveOrg'
import { ORGS_CATALOG_KEY, fetchOrgsCatalog } from '@/lib/queries'
import { orgInitials } from '@/types/orgs'
import { ORG_TYPE_OPTIONS, orgTypeLabel, type OrgType } from '@/constants/orgTypes'

const session = useSession()
const { activeOrg, fetchOrgs } = useActiveOrg()

const catalog = useQuery(ORGS_CATALOG_KEY, fetchOrgsCatalog)
const orgs = computed(() => catalog.data.value ?? [])
const loading = computed(() => catalog.status.value === 'loading')
const error = computed(() => {
  if (catalog.status.value !== 'error') return ''
  return catalog.error.value instanceof Error ? catalog.error.value.message : 'Failed to load organizations.'
})
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

onMounted(() => {
  if (isAuthenticated.value) {
    fetchOrgs()
  }
})
</script>
