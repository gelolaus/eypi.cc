<template>
  <section class="relative mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-5xl flex-col px-4 py-8 sm:px-6 md:py-16 lg:px-8">
    <header class="reveal mb-8 flex flex-col gap-4 border-b border-g-border pb-8 md:flex-row md:items-end md:justify-between">
      <div>
        <p class="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-g-muted">
          orgs
        </p>
        <h1
          class="font-mono font-black tracking-tight text-g-primary dark:text-slate-200"
          style="font-size: clamp(2rem, 5vw, 3.5rem); letter-spacing: -0.03em;"
          data-cursor="text"
        >
          Org directory
        </h1>
        <p class="mt-2 max-w-2xl font-mono text-sm leading-relaxed text-g-muted">
          Discover APC student orgs and explore their public profiles.
        </p>
      </div>
    </header>

    <input
      v-if="!loading && orgs.length > 0"
      v-model="searchQuery"
      type="search"
      placeholder="Search organizations..."
      class="reveal delay-1 mb-6 w-full rounded-2xl border-2 border-g-border bg-g-surface px-6 py-4 font-mono text-sm text-g-text outline-none transition-colors placeholder:text-g-muted focus:border-g-accent"
    />

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
        Check back soon as student organizations opt in to the public catalog.
      </p>
    </div>

    <div
      v-else-if="!filteredOrgs.length"
      class="mica-card rounded-3xl border border-g-border p-12 text-center"
    >
      <p class="font-mono text-sm uppercase tracking-widest text-g-muted">No matching organizations</p>
      <p class="mt-3 font-mono text-xs leading-relaxed text-g-muted">Try another search term.</p>
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
            <h2 class="font-mono text-base font-bold leading-snug tracking-[0.04em] text-g-text group-hover:text-g-accent break-words">
              {{ org.name }}
            </h2>
            <p class="mt-1 font-mono text-[0.65rem] uppercase tracking-[0.12em] text-g-muted">
              /orgs/{{ org.slug }}
            </p>
          </div>
        </div>
        <p
          v-if="org.tagline"
          class="line-clamp-2 flex-1 font-mono text-xs leading-relaxed text-g-muted"
        >
          {{ org.tagline }}
        </p>
      </router-link>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { API_BASE_URL } from '@/config/api'
import { useReveal } from '@/composables/useReveal'
import { orgInitials, type PublicOrgCatalogItem } from '@/types/orgs'

useReveal()

const orgs = ref<PublicOrgCatalogItem[]>([])
const loading = ref(true)
const error = ref('')
const searchQuery = ref('')

const filteredOrgs = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return orgs.value
  return orgs.value.filter((org) =>
    org.name.toLowerCase().includes(q)
    || org.slug.toLowerCase().includes(q)
    || (org.tagline?.toLowerCase().includes(q) ?? false),
  )
})

onMounted(async () => {
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
