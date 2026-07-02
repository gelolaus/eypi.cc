<template>
  <section class="relative mx-auto w-full max-w-5xl px-4 pb-24 pt-8 sm:px-6 md:pt-12 lg:px-8">
    <div v-if="loading" class="space-y-6">
      <div class="h-48 animate-pulse rounded-3xl bg-gray-200 dark:bg-slate-800/60 md:h-56" />
      <div class="h-8 w-2/3 animate-pulse rounded-lg bg-gray-200 dark:bg-slate-800/60" />
      <div class="h-40 animate-pulse rounded-3xl bg-gray-200 dark:bg-slate-800/60" />
    </div>

    <div
      v-else-if="error"
      class="mica-card rounded-3xl border border-g-border p-12 text-center"
    >
      <p class="font-mono text-sm uppercase tracking-widest text-red-500">{{ error }}</p>
      <router-link
        to="/orgs"
        class="mt-6 inline-block font-mono text-xs uppercase tracking-widest text-[#34418F] hover:text-[#DEAC4B] dark:text-slate-300"
        data-cursor="nav"
      >
        ← Back to directory
      </router-link>
    </div>

    <template v-else-if="profile">
      <div
        v-if="isPreview"
        class="mb-6 rounded-2xl border border-[#DEAC4B]/40 bg-[#DEAC4B]/10 px-4 py-3 font-mono text-xs text-g-text"
      >
        Preview mode — showing unsaved changes. Save your profile in org settings to publish.
      </div>

      <!-- Hero -->
      <header class="reveal mb-8 overflow-hidden rounded-3xl border border-g-border bg-g-surface">
        <div class="relative">
          <div
            class="relative h-44 md:h-52"
            :class="profile.bannerUrl ? '' : 'bg-gradient-to-br from-[#34418F] to-[#DEAC4B]'"
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
              class="h-28 w-28 shrink-0 overflow-hidden rounded-2xl border-4 border-g-surface bg-white shadow-lg dark:border-slate-900 md:h-32 md:w-32"
            >
              <img :src="profile.logoUrl" :alt="`${profile.name} logo`" class="h-full w-full object-cover" />
            </div>
            <div
              v-else
              class="flex h-28 w-28 shrink-0 items-center justify-center rounded-2xl border-4 border-g-surface bg-[#34418F] font-mono text-2xl font-black text-white shadow-lg dark:border-slate-900 md:h-32 md:w-32"
            >
              {{ orgInitials(profile.name) }}
            </div>
          </div>
        </div>

        <div class="px-6 pb-8 pt-16 sm:px-8 md:pt-[4.5rem]">
          <h1
            class="font-mono font-black leading-tight tracking-tight text-g-primary dark:text-slate-100 break-words"
            style="font-size: clamp(1.35rem, 3.5vw, 2rem); letter-spacing: -0.02em;"
            data-cursor="text"
          >
            {{ profile.name }}
          </h1>

          <p
            v-if="profile.tagline"
            class="mt-3 max-w-3xl font-mono text-sm leading-relaxed text-g-muted"
          >
            {{ profile.tagline }}
          </p>

          <nav v-if="hasSocialLinks" class="mt-5 flex flex-wrap gap-2">
            <a
              v-for="link in visibleSocialLinks"
              :key="link.key"
              :href="link.url"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center justify-center rounded-full border border-g-border bg-white/60 px-4 py-2 font-mono text-[0.65rem] font-bold uppercase tracking-wider text-g-muted transition-colors hover:border-g-accent hover:text-g-accent dark:bg-slate-900/60 dark:hover:text-g-accent"
              :aria-label="link.label"
              data-cursor="nav"
            >
              {{ link.label }}
            </a>
          </nav>
        </div>
      </header>

      <!-- Tabs -->
      <div class="reveal delay-1 mb-6 flex flex-wrap gap-2">
        <button
          v-for="(tab, i) in TABS"
          :key="tab"
          type="button"
          :class="[
            'rounded-lg px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider transition-colors',
            activeTab === i
              ? 'bg-[#34418F] text-white dark:bg-slate-700 dark:text-slate-100'
              : 'bg-transparent text-gray-400 hover:text-[#34418F] dark:text-slate-400 dark:hover:text-slate-200',
          ]"
          data-cursor="nav"
          @click="activeTab = i"
        >
          {{ tab }}
        </button>
      </div>

      <!-- About -->
      <div v-if="activeTab === 0" class="reveal delay-2 mica-card rounded-3xl border border-g-border p-6 sm:p-8">
        <div
          v-if="aboutHtml"
          class="org-markdown prose-sm max-w-none font-mono text-sm leading-relaxed text-g-text"
          v-html="aboutHtml"
        />
        <p v-else class="font-mono text-sm leading-relaxed text-g-muted">
          This organization hasn't added a description yet.
        </p>
      </div>

      <!-- Events -->
      <div v-else class="reveal delay-2 grid gap-6 md:grid-cols-2">
        <section class="mica-card rounded-3xl border border-g-border p-6 sm:p-8">
          <h2 class="mb-4 font-mono text-xs font-bold uppercase tracking-[0.16em] text-g-accent">
            Upcoming Events
          </h2>
          <p
            v-if="events.upcoming.length === 0"
            class="font-mono text-sm leading-relaxed text-g-muted"
          >
            There are currently no upcoming events. Please check again soon.
          </p>
          <ul v-else class="space-y-4">
            <li
              v-for="event in events.upcoming"
              :key="event.slug"
              class="border-t border-g-border pt-4 first:border-t-0 first:pt-0"
            >
              <router-link
                :to="`/tix/${event.slug}`"
                class="group block"
                data-cursor="nav"
              >
                <p class="font-mono text-sm font-bold uppercase tracking-[0.06em] text-g-text group-hover:text-g-accent">
                  {{ event.name }}
                </p>
                <p class="mt-1 font-mono text-xs text-g-muted">
                  {{ formatEventDate(event.eventDate) }} · {{ event.eventTime }}
                </p>
                <p class="mt-0.5 font-mono text-xs text-g-muted">{{ event.location }}</p>
              </router-link>
            </li>
          </ul>
        </section>

        <section class="mica-card rounded-3xl border border-g-border p-6 sm:p-8">
          <h2 class="mb-4 font-mono text-xs font-bold uppercase tracking-[0.16em] text-g-muted">
            Past Events
          </h2>
          <p
            v-if="events.past.length === 0"
            class="font-mono text-sm leading-relaxed text-g-muted"
          >
            No past events yet.
          </p>
          <ul v-else class="space-y-4">
            <li
              v-for="event in events.past"
              :key="event.slug"
              class="border-t border-g-border pt-4 first:border-t-0 first:pt-0"
            >
              <router-link
                :to="`/tix/${event.slug}`"
                class="group block"
                data-cursor="nav"
              >
                <p class="font-mono text-sm font-bold uppercase tracking-[0.06em] text-g-text group-hover:text-g-accent">
                  {{ event.name }}
                </p>
                <p class="mt-1 font-mono text-xs text-g-muted">
                  {{ formatEventDate(event.eventDate) }} · {{ event.eventTime }}
                </p>
                <p class="mt-0.5 font-mono text-xs text-g-muted">{{ event.location }}</p>
              </router-link>
            </li>
          </ul>
        </section>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { API_BASE_URL } from '@/config/api'
import { useReveal } from '@/composables/useReveal'
import { renderMarkdown } from '@/composables/useMarkdown'
import {
  orgInitials,
  type PublicOrgProfile,
  type PublicOrgEvent,
  type OrgSocialLinks,
} from '@/types/orgs'

useReveal()

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

const aboutHtml = computed(() => renderMarkdown(profile.value?.aboutMarkdown))

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
    const res = await fetch(`${API_BASE_URL}/api/orgs/public/${encodeURIComponent(slug)}`)
    const data = await res.json()
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
    const res = await fetch(`${API_BASE_URL}/api/orgs/public/${encodeURIComponent(slug)}`)
    const data = await res.json()
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

<style scoped>
.org-markdown :deep(h1),
.org-markdown :deep(h2),
.org-markdown :deep(h3) {
  font-family: 'Geist Mono', monospace;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  margin-top: 1.25rem;
  margin-bottom: 0.5rem;
}

.org-markdown :deep(p) {
  margin-bottom: 0.75rem;
}

.org-markdown :deep(a) {
  color: #34418F;
  text-decoration: underline;
}

.org-markdown :deep(ul),
.org-markdown :deep(ol) {
  margin-left: 1.25rem;
  margin-bottom: 0.75rem;
}
</style>
