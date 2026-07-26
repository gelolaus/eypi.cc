<template>
  <section
    class="relative flex min-h-0 flex-1 w-full flex-col items-center justify-center px-6 py-12 md:py-24"
  >
    <div class="mx-auto flex w-full max-w-5xl flex-col items-center justify-center text-center">
      <h1
        class="reveal hero-title mb-6"
      >
        The toolkit for <span class="text-[#DEAC4B]">APC</span> orgs.
      </h1>
      <p
        class="reveal delay-1 mb-10 max-w-2xl text-g-muted"
        style="font-size: clamp(1.15rem, 2.2vw, 1.5rem); line-height: 1.65;"
      >
        Short links, official paperwork, event tickets, and org pages. One APC login, zero ads.
      </p>

      <div class="reveal delay-2 mb-12 flex flex-wrap items-center justify-center gap-4">
        <router-link
          to="/login"
          class="tap-scale inline-flex items-center rounded-full bg-[#DEAC4B] px-8 py-4 text-base font-bold uppercase tracking-wide text-white shadow-md transition-all hover:-translate-y-0.5 hover:opacity-90"
          data-cursor="cta"
        >
          Get started
        </router-link>
        <a
          href="#features"
          class="tap-scale inline-flex items-center rounded-full border-2 border-[#34418F] px-8 py-4 text-base font-semibold text-[#34418F] transition-all hover:bg-[#34418F] hover:text-white dark:border-g-border dark:text-g-text dark:hover:border-g-accent dark:hover:bg-g-accent dark:hover:text-white"
          data-cursor="nav"
          @click.prevent="scrollToFeatures"
        >
          See what's inside
        </a>
      </div>

      <div class="reveal delay-3 mb-10 flex flex-wrap items-center justify-center gap-3">
        <router-link
          v-for="badge in moduleBadges"
          :key="badge.name"
          :to="badge.to"
          class="mica-card tap-scale inline-flex items-center gap-2 rounded-full border border-g-border px-4 py-2 text-sm font-medium text-g-text transition-all hover:-translate-y-0.5 hover:border-g-accent/40"
          data-cursor="nav"
        >
          <span
            class="flex h-7 w-7 items-center justify-center rounded-lg"
            :style="{ color: badge.accent, background: badge.bg }"
            aria-hidden="true"
          >
            <component :is="badge.icon" />
          </span>
          {{ badge.name }}
        </router-link>
      </div>

      <a
        href="#features"
        class="reveal delay-4 group flex flex-col items-center gap-2 text-eyebrow transition-colors hover:text-[#DEAC4B]"
        data-cursor="nav"
        @click.prevent="scrollToFeatures"
      >
        <span>Scroll to features</span>
        <span class="flex flex-col items-center justify-center text-[#34418F]/50 transition-colors group-hover:text-[#DEAC4B] dark:text-slate-400">
          <svg class="h-6 w-6 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </span>
      </a>
    </div>
  </section>
</template>

<script setup lang="ts">
import { h, type Component } from 'vue'

const IconLinks = {
  render: () =>
    h('svg', { xmlns: 'http://www.w3.org/2000/svg', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor', 'stroke-width': '2', class: 'h-4 w-4' }, [
      h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1' }),
    ]),
}

const IconForms = {
  render: () =>
    h('svg', { xmlns: 'http://www.w3.org/2000/svg', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor', 'stroke-width': '2', class: 'h-4 w-4' }, [
      h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' }),
    ]),
}

const IconTix = {
  render: () =>
    h('svg', { xmlns: 'http://www.w3.org/2000/svg', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor', 'stroke-width': '2', class: 'h-4 w-4' }, [
      h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z' }),
    ]),
}

const IconFrames = {
  render: () =>
    h('svg', { xmlns: 'http://www.w3.org/2000/svg', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor', 'stroke-width': '2', class: 'h-4 w-4' }, [
      h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' }),
    ]),
}

const IconOrgs = {
  render: () =>
    h('svg', { xmlns: 'http://www.w3.org/2000/svg', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor', 'stroke-width': '2', class: 'h-4 w-4' }, [
      h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' }),
    ]),
}

interface ModuleBadge {
  name: string
  to: string
  accent: string
  bg: string
  icon: Component
}

const moduleBadges: ModuleBadge[] = [
  { name: 'Links', to: '/login', accent: '#34418F', bg: 'rgba(52, 65, 143, 0.08)', icon: IconLinks },
  { name: 'Forms', to: '/login', accent: '#DEAC4B', bg: 'rgba(222, 172, 75, 0.12)', icon: IconForms },
  { name: 'Tix', to: '/login', accent: '#34418F', bg: 'rgba(52, 65, 143, 0.08)', icon: IconTix },
  { name: 'Frames', to: '/login', accent: '#DEAC4B', bg: 'rgba(222, 172, 75, 0.12)', icon: IconFrames },
  { name: 'Orgs', to: '/orgs', accent: '#34418F', bg: 'rgba(52, 65, 143, 0.08)', icon: IconOrgs },
]

function scrollToFeatures() {
  const target = document.getElementById('features')
  if (!target) return
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' })
}
</script>

<style scoped>
.hero-title {
  font-family: 'Geist', system-ui, sans-serif;
  font-size: clamp(2.5rem, 6.5vw, 5.5rem);
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: -0.04em;
  color: var(--color-primary);
}

html.dark .hero-title {
  color: var(--color-text);
}
</style>
