<template>
  <section class="relative mx-auto w-full max-w-5xl px-4 pb-24 pt-8 sm:px-6 md:pt-12 lg:px-8">
    <div
      v-if="loading"
      role="status"
      aria-busy="true"
      class="space-y-6"
    >
      <span class="sr-only">Loading</span>
      <div
        class="h-48 rounded-3xl bg-muted motion-safe:animate-pulse md:h-56"
        aria-hidden="true"
      />
      <div
        class="h-8 w-2/3 rounded-lg bg-muted motion-safe:animate-pulse"
        aria-hidden="true"
      />
      <div
        class="h-40 rounded-3xl bg-muted motion-safe:animate-pulse"
        aria-hidden="true"
      />
    </div>

    <Card
      v-else-if="error"
      class="items-center gap-0 rounded-3xl p-12 text-center"
    >
      <p
        role="alert"
        class="text-sm text-destructive"
      >
        {{ error }}
      </p>
      <Button
        as-child
        variant="ghost"
        class="mt-6"
      >
        <router-link to="/orgs">
          ← Back to directory
        </router-link>
      </Button>
    </Card>

    <template v-else-if="profile">
      <div
        v-if="isPreview"
        class="mb-6 rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm"
      >
        Preview mode: showing unsaved changes. Save your profile in org settings to publish.
      </div>

      <!-- Hero -->
      <Card class="mb-8 gap-0 overflow-hidden rounded-3xl p-0">
        <div class="relative">
          <div
            class="relative h-44 md:h-52"
            :class="profile.bannerUrl ? '' : 'bg-gradient-to-br from-primary/40 to-muted'"
          >
            <img
              v-if="profile.bannerUrl"
              :src="profile.bannerUrl"
              :alt="`${profile.name} banner`"
              class="h-full w-full object-cover"
            />
          </div>

          <!-- Logo sits on the banner, overlapping into the content area -->
          <div class="absolute bottom-0 left-6 z-10 translate-y-1/2 sm:left-8">
            <div
              v-if="profile.logoUrl"
              class="size-28 shrink-0 overflow-hidden rounded-2xl border-4 border-card bg-card shadow-lg md:size-32"
            >
              <img
                :src="profile.logoUrl"
                :alt="`${profile.name} logo`"
                class="h-full w-full object-cover"
              />
            </div>
            <div
              v-else
              class="flex size-28 shrink-0 items-center justify-center rounded-2xl border-4 border-card bg-primary font-mono text-2xl font-black text-primary-foreground shadow-lg md:size-32"
            >
              {{ orgInitials(profile.name) }}
            </div>
          </div>
        </div>

        <div class="px-6 pb-8 pt-16 sm:px-8 md:pt-[4.5rem]">
          <h1 class="break-words font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            {{ profile.name }}
          </h1>

          <p
            v-if="profile.tagline"
            class="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground"
          >
            {{ profile.tagline }}
          </p>

          <Badge
            v-if="orgTypeDisplay"
            variant="secondary"
            class="h-6 px-3"
            :class="profile.tagline ? 'mt-2' : 'mt-3'"
          >
            {{ orgTypeDisplay }}
          </Badge>
        </div>
      </Card>

      <!-- Tabs -->
      <div class="mb-6 flex gap-2 overflow-x-auto sm:flex-wrap sm:overflow-visible">
        <Button
          v-for="(tab, i) in TABS"
          :key="tab"
          type="button"
          :variant="activeTab === i ? 'secondary' : 'ghost'"
          :aria-pressed="activeTab === i"
          class="shrink-0 px-4 text-sm"
          @click="activeTab = i"
        >
          {{ tab }}
        </Button>
      </div>

      <!-- About -->
      <Card
        v-if="activeTab === 0"
        class="gap-0 rounded-3xl p-6 sm:p-8"
      >
        <div
          v-if="aboutHtml"
          class="max-w-none text-sm leading-relaxed [&_a]:text-primary [&_a]:underline [&_h1]:mb-2 [&_h1]:mt-5 [&_h1]:font-heading [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:mt-5 [&_h2]:font-heading [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:mt-5 [&_h3]:font-heading [&_h3]:font-semibold [&_ol]:mb-3 [&_ol]:ml-5 [&_p]:mb-3 [&_ul]:mb-3 [&_ul]:ml-5"
          v-html="aboutHtml"
        />
        <p
          v-else
          class="text-sm leading-relaxed text-muted-foreground"
        >
          This organization hasn't added a description yet.
        </p>

        <nav
          v-if="hasSocialLinks"
          class="mt-8 flex flex-wrap gap-2 border-t border-border pt-6"
        >
          <Button
            v-for="link in visibleSocialLinks"
            :key="link.key"
            as-child
            variant="outline"
            class="rounded-full px-4 text-sm"
          >
            <a
              :href="link.url"
              target="_blank"
              rel="noopener noreferrer"
              :aria-label="link.label"
            >
              {{ link.label }}
            </a>
          </Button>
        </nav>
      </Card>

      <!-- Events -->
      <div
        v-else
        class="grid gap-6 md:grid-cols-2"
      >
        <Card
          v-for="group in eventGroups"
          :key="group.title"
          class="gap-0 rounded-3xl p-6 sm:p-8"
        >
          <h2
            class="mb-4 font-heading text-lg font-semibold"
            :class="group.muted ? 'text-muted-foreground' : 'text-primary'"
          >
            {{ group.title }}
          </h2>
          <p
            v-if="group.items.length === 0"
            class="text-sm leading-relaxed text-muted-foreground"
          >
            {{ group.empty }}
          </p>
          <ul
            v-else
            class="space-y-4"
          >
            <li
              v-for="event in group.items"
              :key="event.slug"
              class="border-t border-border pt-4 first:border-t-0 first:pt-0"
            >
              <router-link
                :to="`/tix/${event.slug}`"
                class="group block rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <p class="text-sm font-semibold group-hover:text-primary">
                  {{ event.name }}
                </p>
                <p class="mt-1 font-mono text-xs text-muted-foreground">
                  {{ formatEventDate(event.eventDate) }} · {{ event.eventTime }}
                </p>
                <p class="mt-0.5 text-sm text-muted-foreground">{{ event.location }}</p>
              </router-link>
            </li>
          </ul>
        </Card>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { api } from '@/lib/api'
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { renderMarkdown } from '@/composables/useMarkdown'
import {
  orgInitials,
  type PublicOrgProfile,
  type PublicOrgEvent,
  type PublicOrgProfileResponse,
  type OrgSocialLinks,
} from '@/types/orgs'
import { orgTypeLabel } from '@/constants/orgTypes'

const TABS = ['About', 'Events'] as const
const route = useRoute()

const loading = ref(true)
const error = ref('')
const isPreview = ref(false)
const profile = ref<PublicOrgProfile | null>(null)
const events = ref<{ upcoming: PublicOrgEvent[]; past: PublicOrgEvent[] }>({
  upcoming: [],
  past: [],
})
const activeTab = ref(0)

const eventGroups = computed(() => [
  { title: 'Upcoming events', items: events.value.upcoming, empty: 'No upcoming events.', muted: false },
  { title: 'Past events', items: events.value.past, empty: 'No past events yet.', muted: true },
])

const aboutHtml = computed(() => renderMarkdown(profile.value?.aboutMarkdown))

const orgTypeDisplay = computed(() => orgTypeLabel(profile.value?.orgType))

const hasSocialLinks = computed(() => visibleSocialLinks.value.length > 0)

const visibleSocialLinks = computed(() => {
  const links = profile.value?.socialLinks ?? {}
  const entries: { key: string; url: string; label: string }[] = []
  const map: { key: keyof OrgSocialLinks; label: string }[] = [
    { key: 'website', label: 'Website' },
    { key: 'facebook', label: 'Facebook' },
    { key: 'instagram', label: 'Instagram' },
    { key: 'twitter', label: 'X' },
    { key: 'linkedin', label: 'LinkedIn' },
    { key: 'github', label: 'GitHub' },
  ]
  for (const item of map) {
    const url = links[item.key]?.trim()
    if (url) entries.push({ key: item.key, url, label: item.label })
  }
  return entries
})

function formatEventDate(d: string) {
  if (!d) return ''
  try {
    return new Date(d.replace(' ', 'T')).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return d
  }
}

function loadPreviewDraft(slug: string): PublicOrgProfile | null {
  if (route.query.preview !== '1') return null
  try {
    const raw = sessionStorage.getItem(`eypi_org_preview_${slug}`)
    if (!raw) return null
    const draft = JSON.parse(raw) as PublicOrgProfile
    return draft.slug === slug ? draft : null
  } catch {
    return null
  }
}

async function fetchEvents(slug: string) {
  try {
    const res = await api.raw(`/api/orgs/public/${encodeURIComponent(slug)}`)
    const data = await res.json() as PublicOrgProfileResponse
    if (res.ok) {
      events.value = data.events ?? { upcoming: [], past: [] }
    }
  } catch {
    // Events are optional in preview mode.
  }
}

async function fetchProfile(slug: string) {
  loading.value = true
  error.value = ''
  isPreview.value = false
  profile.value = null
  events.value = { upcoming: [], past: [] }

  const previewDraft = loadPreviewDraft(slug)
  if (previewDraft) {
    profile.value = previewDraft
    isPreview.value = true
    loading.value = false
    await fetchEvents(slug)
    return
  }

  try {
    const res = await api.raw(`/api/orgs/public/${encodeURIComponent(slug)}`)
    const data = await res.json() as PublicOrgProfileResponse & { error?: string }
    if (!res.ok) throw new Error(data.error || 'Organization not found.')
    profile.value = data.org
    events.value = data.events ?? { upcoming: [], past: [] }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Organization not found.'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchProfile(route.params.slug as string)
})

watch(
  () => [route.params.slug, route.query.preview] as const,
  ([slug]) => {
    if (typeof slug === 'string') {
      activeTab.value = 0
      fetchProfile(slug)
    }
  },
)
</script>

